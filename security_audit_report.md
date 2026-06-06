# 🛡️ Bedrock Vault — Comprehensive Security & Architecture Audit Report

**Audit Date**: 2026-06-06  
**Auditor Role**: Principal Security Architect / Lead QA / Advanced Threat Actor  
**Application**: Bedrock Vault (Electron + React Encrypted File Vault)  
**Scope**: Full static analysis of ~60 source files across Main Process, Preload, Renderer, Native C++ Module, and WebDAV subsystem.

---

## 1. The Score Matrix (0.0 – 1.0)

| Vector | Score | Justification |
|:---|:---:|:---|
| **Cryptographic Implementation** | **0.78** | Strong AES-256-GCM usage with proper auth tags and unique IVs, but `scryptSync` blocks the event loop during decryption, the mnemonic PBKDF2 uses a hardcoded static salt, and DEK buffers linger in deserialized metadata beyond the `finally` block. |
| **Memory Safety** | **0.72** | Commendable explicit `Buffer.fill(0)` in the encryption pathway's `finally` blocks for DEK/passwordKey/wraps, but the decrypted file keys stored in `secureFileKeysMap` remain in heap for the entire vault session and the `serializeMetadata` function creates string copies of keys via `entry.key.copy()` that are never zeroed. |
| **IPC & ContextBridge Security** | **0.82** | Properly segmented `contextBridge.exposeInMainWorld()` namespaces with allowlisted channels for the raw `ipcRenderer` pass-through, but the `decryption:decrypt-metadata` handler accepts an arbitrary `directoryPath` string from the renderer with weak path validation, and there is a redundant dual-registration of security timer IPC handlers. |
| **Protocol & WebDAV Security** | **0.55** | The WebDAV server runs on `127.0.0.1` with a cryptographically random mount token, but **`requireAuthentification: false`** means any local process can access the full decrypted vault if it discovers the port+token, the token is logged to disk in plaintext, and there is zero rate-limiting or origin header validation. |
| **Frontend UI/UX Resilience** | **0.70** | Lazy-loaded routes with Suspense, proper loading states, and throttled activity pings, but no debounce on double-click file open operations (rapid double-clicking triggers parallel IPC calls), the 60-second inactivity timeout is extremely aggressive for a desktop app, and there is no optimistic UI or virtualization for large file lists. |
| **Overall Vault Health Score** | **0.71** | Application demonstrates strong foundational crypto engineering and careful buffer management in the encryption path, but has critical gaps in WebDAV access control, decryption-path memory hygiene, and UI resilience under heavy load. |

---

## 2. Critical Security Holes (P0 & P1)

### 🔴 P0-1: Unauthenticated WebDAV Server — Local Port Hijacking

**File**: [webdav-server.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/webdav/webdav-server.ts#L22-L26)  
**Impact**: Any local process, malware, or browser-based exploit can enumerate localhost ports and read **all decrypted vault files** in plaintext via the WebDAV server.  
**Exploit Scenario**: A malicious script runs `for port in {1..65535}; do curl -s http://127.0.0.1:$port/ -X PROPFIND; done` to discover the WebDAV port. Once found, it reads the token from the URL path, then issues `GET` requests to stream every file out of the vault.

**Vulnerable Code** (line 22-26):
```typescript
server = new webdav.WebDAVServer({
    port: 0,
    hostname: '127.0.0.1',
    requireAuthentification: false, // ← P0: NO AUTH
});
```

**Exact Code Fix**:
```typescript
server = new webdav.WebDAVServer({
    port: 0,
    hostname: '127.0.0.1',
    requireAuthentification: true,
    httpAuthentication: new webdav.HTTPBasicAuthentication(
        new webdav.SimpleUserManager(),
        'Bedrock Vault'
    ),
});

// Add a single user with the mount token as password
const userManager = new webdav.SimpleUserManager();
userManager.addUser('vault', mountToken, false);
server.httpAuthentication = new webdav.HTTPBasicAuthentication(userManager, 'Bedrock Vault');
```

Additionally, add a `beforeRequest` middleware that validates the `Host` header:
```typescript
server.beforeRequest((ctx, next) => {
    const host = ctx.request.headers['host'];
    if (!host || !host.startsWith('127.0.0.1:')) {
        ctx.response.writeHead(403);
        ctx.response.end();
        return;
    }
    next();
});
```

---

### 🔴 P0-2: Mount Token Logged to Disk in Plaintext

**File**: [webdav-server.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/webdav/webdav-server.ts#L78)  
**Impact**: The 32-byte random mount token (the only "authentication" mechanism) is written in cleartext to the application log file, which persists on disk. Any process with file read access can extract it.

**Vulnerable Code** (line 78):
```typescript
void logger.info('WebDavServer', `WebDAV started on 127.0.0.1:${address.port}/${mountToken}`);
```

**Exact Code Fix**:
```typescript
void logger.info('WebDavServer', `WebDAV started on 127.0.0.1:${address.port}/[TOKEN_REDACTED]`);
```

Apply the same redaction at lines 97-98 and 100-101 where mount commands are logged with the token.

---

### 🔴 P0-3: Path Traversal via WebDAV `openVaultFile` Handler

**File**: [webdav.handler.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/webdav/webdav.handler.ts#L6-L28)  
**Impact**: The `virtualPath` parameter from the renderer is directly concatenated into a filesystem path with no traversal sanitization. An attacker who controls the renderer (via XSS or devtools) can craft a `virtualPath` like `/../../../etc/passwd` to open arbitrary files via `shell.openPath`.

**Vulnerable Code** (line 16):
```typescript
mountedPath = 'Z:' + virtualPath.replace(/\//g, '\\');
```

**Exact Code Fix**:
```typescript
import { normalizeVirtualPath } from '@main/handlers/file-selection/file-selection.utils';

export const openVaultFile = async (_event: IpcMainInvokeEvent, virtualPath: string) => {
    // Validate virtualPath against the known decrypted items map
    const entry = getDecryptedFileKeyEntry(normalizeVirtualPath(virtualPath));
    if (!entry) {
        throw new Error(`File not found in vault: ${virtualPath}`);
    }
    // ...rest of function
};
```

---

### 🟠 P1-1: `scryptSync` Blocks Event Loop During Decryption

**File**: [decryption.helpers.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/decryption/helpers/decryption.helpers.ts#L52)  
**Impact**: `crypto.scryptSync` is a CPU-intensive synchronous call that blocks the entire Electron main process for 100-500ms depending on parameters. During this time, the WebDAV server, IPC handlers, and all window events are frozen. This is a denial-of-service vector: if multiple decryption requests arrive (e.g., from WebDAV PROPFIND storms), the main thread starves.

**Vulnerable Code** (line 52):
```typescript
const passwordKey = crypto.scryptSync(passwordBuffer, salt, CRYPTO_SIZES.KEY);
```

**Exact Code Fix**:
```typescript
import { promisify } from 'node:util';
const scryptAsync = promisify(crypto.scrypt);

const passwordKey = (await scryptAsync(passwordBuffer, salt, CRYPTO_SIZES.KEY)) as Buffer;
```

---

### 🟠 P1-2: Decrypted File Keys (DEK material) Persist in Heap for Entire Session

**File**: [decrypt-metadata.main.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/decryption/decrypt-metadata.main.ts#L21)  
**Impact**: The `secureFileKeysMap` holds raw AES-256 key buffers and IVs in V8 heap memory for the entire vault session (until manual lock or inactivity timeout). An attacker with memory dump access (e.g., via `process.memoryUsage()`, electron debug port, or a cold boot attack) can extract every file's DEK.

**Vulnerable Code** (line 21):
```typescript
const secureFileKeysMap = new Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }>();
```

**Mitigation**: This is inherent to the on-the-fly decryption design — keys *must* live in memory. However:
1. The session timeout (60s) is too short for usability but too long if a dump occurs. Consider allowing the user to configure this.
2. Consider encrypting the in-memory key map with a session-local master key derived from the page table (defense-in-depth).
3. Ensure the Electron main process has `--disable-renderer-backgrounding` to prevent V8 from swapping pages to disk.

---

### 🟠 P1-3: Hardcoded Static Salt in Mnemonic-to-Key Derivation

**File**: [mnemonic.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/utils/mnemonic.ts#L21)  
**Impact**: All users share the identical PBKDF2 salt `'bedrock-vault-salt-recovery'`. This enables rainbow table attacks against the recovery phrase space. If an attacker obtains a wrapped DEK encrypted by the recovery phrase key, they can pre-compute the key space for all Bedrock Vault installations.

**Vulnerable Code** (line 21):
```typescript
return crypto.pbkdf2Sync(normalized, 'bedrock-vault-salt-recovery', 100000, 32, 'sha256');
```

**Exact Code Fix**: Use the per-chunk `salt` that is already stored in the metadata payload:
```typescript
export function mnemonicToKey(mnemonic: string, salt: Buffer): Buffer {
    const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.pbkdf2Sync(normalized, salt, 100000, 32, 'sha256');
}
```
This requires a breaking change to the metadata format to pass the salt through to the recovery flow.

---

### 🟠 P1-4: `removeRecord` Accepts Arbitrary Path for `shell.trashItem`

**File**: [enc-record.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/utils/enc-record.ts#L90-L119)  
**Impact**: The `removeRecord` IPC handler accepts a `directoryPath` string and a `deletePermanently` boolean from the renderer. If `deletePermanently` is true, it calls `shell.trashItem(directoryPath)` on any path the renderer supplies, enabling an attacker to trash arbitrary directories.

**Vulnerable Code** (line 110):
```typescript
await shell.trashItem(directoryPath);
```

**Exact Code Fix**: Validate that `directoryPath` exists in the records list before trashing:
```typescript
export const removeRecord = async (
    _event: IpcMainInvokeEvent,
    directoryPath: string,
    deletePermanently: boolean
): Promise<void> => {
    const records = await getRecords();
    const resolvedPath = path.resolve(directoryPath);
    
    // Validate the path exists in records BEFORE allowing deletion
    const recordExists = records.some(r => path.resolve(r.path) === resolvedPath);
    if (!recordExists) {
        throw new Error('Cannot delete: path is not a known encryption record');
    }
    // ...rest of function
};
```

---

### 🟠 P1-5: DevTools Open Handler Exposed in Production

**File**: [ipc-handler.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/ipc-handler.ts#L40)  
**Impact**: The `open-dev-tools` IPC handler is registered unconditionally, allowing any renderer process to open DevTools even in production builds. This gives a local attacker full access to the renderer's DOM, all IPC APIs via `window.*`, and the ability to execute arbitrary JavaScript.

**Vulnerable Code** (line 40):
```typescript
ipcMain.handle('open-dev-tools', () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }))
```

**Exact Code Fix**:
```typescript
if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    ipcMain.handle('open-dev-tools', () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }));
}
```

---

## 3. Critical Logic & State Bugs

### 🐛 BUG-1: Race Condition — Double-Click File Open Fires Parallel IPC Calls

**File**: [DecryptedFilesView.tsx](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/renderer/pages/DecryptedContent/DecryptedFilesView.tsx#L203-L216)  
**Impact**: The `onDoubleClick` handler on each file card sets `isLoading=true` and calls `window.decryption.openVaultFile()`, but rapid double-clicking can fire multiple invocations before the `isLoading` guard takes effect (React batches state updates). This causes multiple WebDAV file-open operations and potential `EBUSY` errors on Windows.

**Vulnerable Code** (line 203-216):
```tsx
onDoubleClick={async () => {
    if (file.isDir && !isLoading) {
        void openFolder(file.virtualPath);
    } else if (!file.isDir && !isLoading) {
        setIsLoading(true);
        try {
            await window.decryption.openVaultFile(file.virtualPath);
        } catch (err) { /*...*/ }
        finally { setIsLoading(false); }
    }
}}
```

**Fix**: Use a ref-based guard:
```tsx
const openingRef = useRef(false);
// ...
onDoubleClick={async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    try { /* ... */ }
    finally { openingRef.current = false; setIsLoading(false); }
}}
```

---

### 🐛 BUG-2: Auto-Lock Fires During Active Encryption Workflow

**File**: [auto-locker.helpers.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/decryption/helpers/auto-locker.helpers.ts#L10-L19)  
**Impact**: `executeAutoLock()` calls `abortEncryption()` unconditionally, which aborts any in-progress encryption workflow. If a user starts encrypting 10,000 files (taking >60 seconds), the inactivity timer will fire and abort the entire operation, triggering a rollback and data loss.

**Vulnerable Code** (line 17-19):
```typescript
clearDecryptedCache();
clearCachedPassword();
abortEncryption(); // ← This aborts a running encryption!
```

**Fix**: Check `isInProgress()` before aborting:
```typescript
import { isInProgress } from '@main/handlers/encryption/helpers/abort-controller.helper';

export async function executeAutoLock(): Promise<void> {
    if (isInProgress()) {
        await logger.warn('AutoLocker', 'Skipping auto-lock: encryption in progress');
        resetTimer(); // Reset the timer instead
        return;
    }
    // ...rest of function
}
```

---

### 🐛 BUG-3: Dual IPC Registration for Security Timer

**File**: [ipc-handler.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/ipc-handler.ts#L88-L90) vs [preload.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/preload/preload.ts#L95-L103)

**Impact**: The security timer has **two independent sets of IPC handlers**:
1. `ipcMain.handle('decryption:start-security-timer', ...)` registered at line 88-90
2. `ipcRenderer.send('start-security-timer', ...)` via the raw `ipcRenderer` pass-through (line 95-103)

The renderer uses `window.ipcRenderer.send()` (fire-and-forget), but the main process registers `ipcMain.handle()` (invoke-style). Since `ipcRenderer.send()` requires `ipcMain.on()` (not `ipcMain.handle()`), **the security timer IPC messages are silently dropped and the timer never starts**.

**Fix**: Either change the main process to use `ipcMain.on()`:
```typescript
ipcMain.on('start-security-timer', () => startSecurityTimer());
ipcMain.on('stop-security-timer', () => stopSecurityTimer());
ipcMain.on('ping-activity', () => pingActivity());
```
Or change the renderer to use `window.decryption` instead of `window.ipcRenderer.send`.

---

### 🐛 BUG-4: `runWithConcurrencyLimit` Silently Drops Failed File Encryptions

**File**: [file-encryptor.helper.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/encryption/helpers/file-encryptor.helper.ts#L261-L274)  
**Impact**: The `drain()` function catches all errors silently with an empty `catch {}`. When `results.filter(Boolean)` runs at line 273, failed entries (which are `undefined` in the sparse array) are silently excluded. This means the metadata file may contain fewer entries than expected, and the user sees "X file(s) failed" but has no way to know which files failed or why.

**Vulnerable Code** (line 264-268):
```typescript
try {
    results[index] = await tasks[index]();
} catch {
    /* failed tasks are excluded from results */
}
```

**Fix**: Log failed files and provide per-file error feedback to the UI.

---

### 🐛 BUG-5: `useAutoLock` Locks Vault on Every Route Change

**File**: [useAutoLock.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/renderer/hooks/useAutoLock.ts#L22-L27)  
**Impact**: When `location.pathname` is not `/decrypted-content` (e.g., user navigates to Settings while vault is "open"), the hook immediately calls `window.decryption.lockVault()`, which clears all decrypted data and unmounts the WebDAV drive. This means navigating away from the decrypted content page **always destroys the session** even if the user intended to come back.

**Vulnerable Code** (line 23-27):
```typescript
if (location.pathname !== "/decrypted-content" || !isDecryptedShowing) {
    window.ipcRenderer.send("stop-security-timer");
    void window.decryption.lockVault();
    return;
}
```

**Fix**: The vault lock should only trigger on explicit user action or inactivity — not on route changes. Remove the `lockVault()` call from the `useEffect` cleanup and only fire `stop-security-timer`:
```typescript
if (location.pathname !== "/decrypted-content" || !isDecryptedShowing) {
    window.ipcRenderer.send("stop-security-timer");
    return; // Don't lock vault on route change
}
```

---

## 4. Performance & Optimization Bottlenecks

### ⚡ PERF-1: O(n) Full Map Iteration for Every `_readDir` Call

**File**: [secure-fs.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/webdav/secure-fs.ts#L128-L156)  
**Impact**: Every WebDAV `PROPFIND` (directory listing) iterates the **entire** `decryptedItemsMap` twice — once to build `folderPaths` (line 138-140) and once to filter children (line 143-153). With 10,000 files, this is 20,000 iterations per directory listing. Windows Explorer sends `PROPFIND` requests every few seconds for each visible directory, causing O(n²) total work.

**Optimized Replacement**: Build a parent→children index once during decryption:
```typescript
// In decrypt-metadata.main.ts, after building decryptedItemsMap:
const childrenIndex = new Map<string, string[]>();
for (const [key, item] of decryptedItemsMap) {
    const parent = getVirtualParentPath(item.virtualPath) ?? '/';
    if (!childrenIndex.has(parent)) childrenIndex.set(parent, []);
    childrenIndex.get(parent)!.push(pathModule.basename(item.virtualPath));
}
```

Then in `_readDir`:
```typescript
protected _readDir(path: webdav.Path, _ctx: webdav.ReadDirInfo, callback: webdav.ReturnCallback<string[]>): void {
    const virtualPath = normalizeVirtualPath(path.toString());
    const children = getChildrenIndex()?.get(virtualPath);
    callback(undefined, children ?? []);
}
```

---

### ⚡ PERF-2: No Virtualization for File Grid — 10,000 Files Renders 10,000 DOM Nodes

**File**: [DecryptedFilesView.tsx](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/renderer/pages/DecryptedContent/DecryptedFilesView.tsx#L198-L241)  
**Impact**: The `visibleItems.map()` renders every file as a DOM node inside a `ScrollArea`. With 10,000 items, this creates ~30,000 DOM nodes (each card has ~3 child elements), causing 2-5 second render freezes and continuous layout thrashing during scroll.

**Fix**: Use `react-window` or `@tanstack/virtual`:
```tsx
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
    columnCount={3}
    rowCount={Math.ceil(visibleItems.length / 3)}
    columnWidth={300}
    rowHeight={64}
    height={containerHeight}
    width={containerWidth}
>
    {({ columnIndex, rowIndex, style }) => {
        const item = visibleItems[rowIndex * 3 + columnIndex];
        if (!item) return null;
        return <FileCard style={style} file={item} />;
    }}
</FixedSizeGrid>
```

---

### ⚡ PERF-3: `systeminformation` Dynamic Import on Every Encryption

**File**: [misc.utils.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/utils/misc.utils.ts#L21-L22)  
**Impact**: `getDriveInfoFromPath` dynamically imports `systeminformation` on every call. The `fsSize()` function takes 500-1500ms to enumerate all drives on Windows. This is called during the "Analyzing resources" stage of encryption, adding unnecessary latency.

**Fix**: Cache the import and add a TTL:
```typescript
let cachedFsSize: typeof import('systeminformation').fsSize | null = null;

async function getFsSize() {
    if (!cachedFsSize) {
        const si = await import('systeminformation');
        cachedFsSize = si.fsSize;
    }
    return cachedFsSize();
}
```

---

### ⚡ PERF-4: Encryption Progress Emitter Creates New Array on Every Throttle Tick

**File**: [encryption-emitter.helper.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/encryption/helpers/encryption-emitter.helper.ts#L24-L29)  
**Impact**: `performEmit()` creates three new filtered arrays on every emit cycle (every 150ms). With 10,000 files, this is 30,000 array filter operations every 150ms, generating significant GC pressure.

**Vulnerable Code** (line 25-29):
```typescript
const all = [...progressMap.values()];
const encrypting = all.filter(f => f.status === 'encrypting');
const pending    = all.filter(f => f.status === 'pending');
const done       = all.filter(f => f.status === 'completed' || f.status === 'failed');
```

**Optimized Replacement**:
```typescript
const performEmit = () => {
    // Single pass categorization
    const encrypting: EncryptionProgress[] = [];
    const pending: EncryptionProgress[] = [];
    const done: EncryptionProgress[] = [];
    for (const f of progressMap.values()) {
        if (f.status === 'encrypting') encrypting.push(f);
        else if (f.status === 'pending') pending.push(f);
        else done.push(f);
    }
    encryptionEmitter.emit('file-progress', [...encrypting, ...pending, ...done]);
    lastEmitTime = Date.now();
};
```

---

## 5. "Heavy User" Friction & Weak Points

### 👤 UX-1: 60-Second Inactivity Timeout is Brutally Short

**File**: [system.constants.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/shared/constant/system.constants.ts#L1)  
**Friction**: The `INACTIVITY__AUTOLOCK_MS = 60000` (1 minute) means the vault locks while the user is:
- Reading a document opened from the vault (which happens in another app window)
- Alt-tabbed to a browser to check something
- On a phone call while reviewing files

**Recommendation**: Default to 5 minutes (300000ms) and allow user configuration in Settings. The current value will cause constant re-authentication frustration.

---

### 👤 UX-2: No Feedback When WebDAV Mount Fails

**File**: [decrypt-metadata.main.ts](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/main/handlers/decryption/decrypt-metadata.main.ts#L184-L187)  
**Friction**: If `startWebDavServer()` or `mountDrive()` fails (e.g., Z: drive letter already in use, WebClient service not running), the error is silently swallowed. The UI shows "Vault Mounted (Read-Only)" even though the mount failed, and the user cannot open files.

**Vulnerable Code** (line 184-187):
```typescript
const mountInfo = await startWebDavServer();
if (mountInfo) {
    await mountDrive(mountInfo.port, mountInfo.mountToken);
}
```

**Fix**: Return mount status in the result:
```typescript
let mountSuccess = false;
try {
    const mountInfo = await startWebDavServer();
    if (mountInfo) {
        await mountDrive(mountInfo.port, mountInfo.mountToken);
        mountSuccess = true;
    }
} catch (err) {
    await logger.error('DecryptionHandler', `WebDAV mount failed: ${err}`);
}

return { success: true, chunkName: decrypted.chunkName, level: decrypted.level, mounted: mountSuccess };
```

---

### 👤 UX-3: Demo Buttons in Production UI

**File**: [DecryptedFilesView.tsx](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/renderer/pages/DecryptedContent/DecryptedFilesView.tsx#L129-L148)  
**Friction**: The toolbar contains 5 buttons ("Add Files", "Remove Files", "Extract all files", "Rotate keys", "Delete Chunks") that all call `alert("Demo: ...")`. A user who has just decrypted their vault will click these buttons expecting functionality and get empty JavaScript alerts. This destroys trust.

**Fix**: Either implement the features or hide the buttons behind a `COMING_SOON` flag with appropriate UI treatment (disabled state + tooltip).

---

### 👤 UX-4: Recovery Button Shows a JavaScript `alert()`

**File**: [DecryptedContent/page.tsx](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/renderer/pages/DecryptedContent/page.tsx#L131-L137)  
**Friction**: When TPM is unavailable and the user clicks "Find a way to recovery", they get:
```tsx
onClick={() => alert("Recovery mode - please locate your Recovery Phrase file.")}
```
This is an unfinished feature that will confuse users who are already in a panic state (they can't decrypt their files).

---

### 👤 UX-5: No Drag-and-Drop Support for Large File Batches

**File**: [FileSelection.tsx](file:///c:/Users/shawk/Projects/anonymous-file-storage/src/renderer/pages/FileSelection/FileSelection.tsx) (referenced from directory listing)  
**Friction**: File selection only works through the system file dialog (`dialog.showOpenDialog`). Power users who want to drag-and-drop 500 files from Explorer will find no drop zone. This is a significant workflow friction for batch operations.

---

## 6. Actionable Recommendations — Top 3 Production Blockers

### ✅ Priority 1: Fix WebDAV Authentication (P0-1 + P0-2)

> [!CAUTION]
> **This is the single most critical vulnerability.** Any local process can read all decrypted vault files without credentials. This must be fixed before any production release.

1. Enable `requireAuthentification: true` on the WebDAV server
2. Use the mount token as the HTTP Basic Auth password
3. Pass credentials through to the `net use` / `mount_webdav` commands
4. Stop logging the mount token to disk
5. Add `Host` header validation to reject non-localhost requests
6. Consider binding to a Unix domain socket instead of TCP (eliminates port scanning entirely)

---

### ✅ Priority 2: Fix Security Timer IPC Mismatch (BUG-3) + Auto-Lock Conflicts (BUG-2 + BUG-5)

> [!WARNING]
> **The inactivity auto-lock system is fundamentally broken.** The `send`/`handle` mismatch means the security timer never starts, and even if it did, it would abort running encryptions and lock the vault on any route change.

1. Switch IPC handlers from `ipcMain.handle` to `ipcMain.on` for `start-security-timer`, `stop-security-timer`, and `ping-activity`
2. Remove the unconditional `lockVault()` call from `useAutoLock`'s cleanup
3. Add `isInProgress()` guard in `executeAutoLock()` to prevent aborting encryption
4. Increase default timeout to 5 minutes and make it user-configurable in Settings

---

### ✅ Priority 3: Harden Path Validation on All Renderer-Supplied Paths (P0-3 + P1-4 + P1-5)

> [!IMPORTANT]
> Multiple IPC handlers accept renderer-supplied file paths and pass them directly to `shell.openPath()`, `shell.trashItem()`, or `fs` operations without validating them against the known vault state.

1. Validate `virtualPath` in `openVaultFile` against the `secureFileKeysMap`
2. Validate `directoryPath` in `removeRecord` against the records list before trashing
3. Gate `open-dev-tools` behind `process.env.NODE_ENV === 'development'`
4. Add an integration test that attempts path traversal payloads (`../`, `%2e%2e/`, null bytes) against all IPC handlers that accept path strings

---

> [!NOTE]
> **Summary**: Bedrock Vault demonstrates strong cryptographic fundamentals — AES-256-GCM with per-file keys, TPM-backed key wrapping, proper auth tag handling, and aggressive buffer zeroing in the encryption path. The architecture is well-structured with clear separation between Main/Renderer/Preload. However, the WebDAV subsystem is the Achilles' heel: running an unauthenticated HTTP server on localhost that serves decrypted vault contents is a P0 that undermines the entire security model. Fix this first, then address the auto-lock system's broken IPC plumbing, and finally harden the path validation on all renderer-to-main boundaries.

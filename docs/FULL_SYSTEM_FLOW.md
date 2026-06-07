# Bedrock Vault — Full System Flow Documentation

> **Application:** Bedrock Vault v1.0.3-beta  
> **Architecture:** Electron (Main + Renderer + Preload) with Native C++ Addon  
> **Audience:** Developers, Auditors, Future Maintainers  
> **Generated From:** Complete codebase analysis — every step verified against actual implementation code.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Entry Flow](#2-user-entry-flow)
3. [Encryption Flow](#3-encryption-flow)
4. [Decryption & Virtual Mount Flow](#4-decryption--virtual-mount-flow)
5. [Metadata Flow](#5-metadata-flow)
6. [Recovery Flow](#6-recovery-flow)
7. [Threading Flow](#7-threading-flow)
8. [IPC Flow](#8-ipc-flow)
9. [Validation Flow](#9-validation-flow)
10. [Error Handling Flow](#10-error-handling-flow)
11. [Logging Flow](#11-logging-flow)
12. [Security Flow](#12-security-flow)

---

## 1. System Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph Renderer["Renderer Process (React + TailwindCSS)"]
        UI["React Pages & Components"]
        CTX["AppConfigContext"]
        RHF["React Hook Form + Zod"]
        AL_H["useAutoLock Hook"]
    end

    subgraph Preload["Preload Script (contextBridge)"]
        API["window.appWindow / appConfig / fileSelection / encryptionOptions / encryptionProgress / cloudDrive / appLogs / appDecryption"]
    end

    subgraph Main["Main Process (Node.js)"]
        IPC["IPC Handler Hub"]
        WM["Window Manager"]
        FS_H["File Selection Handler"]
        ENC_W["Encryption Workflow Handler"]
        DEC_W["Decryption Workflow Handler"]
        REC_W["Encryption Record Store"]
        ENC_O["Encryption Options Store"]
        CFG["App Config Handler"]
        LOG["Logger"]
        MISC["Shell Commands / Popup Emitter"]
        AL_A["AutoLocker Helper"]

        subgraph EncryptionEngine["Encryption Engine"]
            AQ["Acquire & Validate Files"]
            EF["Encrypt Files Orchestrator"]
            EFC["Encrypt File Core (Streaming)"]
            KM["Key Management (3-Level)"]
            ECJ["Encryption Change Journal"]
            EMT["Encryption Emitter"]
        end

        subgraph DecryptionEngine["Decryption Engine"]
            DM["decryptMetadata / decryptMetadataPayload"]
            WDS["WebDAV Server Daemon"]
            SFS["SecureFileSystem (Virtual FS)"]
            DKM["Decrypted Cache Map"]
        end

        subgraph Workers["Worker Threads (Piscina)"]
            WK["run-pool-job.ts → encryptFileStream()"]
        end
    end

    subgraph Native["Native Addon (C++ / N-API)"]
        PWD["Password Prompt (Windows CredUI)"]
        TPM["TPM Encrypt/Decrypt"]
        KSP["Software KSP Check"]
    end

    subgraph OS["Operating System"]
        DISK["File System"]
        TPM_HW["TPM 2.0 Hardware"]
        CRED["Windows Credential UI"]
        MNT["Mounted Virtual Disk (Drive Z: / Volumes)"]
    end

    UI -->|"ipcRenderer.invoke/send"| API
    API -->|"contextBridge"| IPC
    IPC --> FS_H
    IPC --> ENC_W
    IPC --> DEC_W
    IPC --> REC_W
    IPC --> ENC_O
    IPC --> CFG
    IPC --> LOG
    IPC --> MISC
    IPC --> AL_A
    
    ENC_W --> AQ
    ENC_W --> EF
    ENC_W --> KM
    EF --> EFC
    EF --> WK
    ENC_W --> ECJ
    ENC_W --> EMT
    EMT -->|"webContents.send"| UI
    
    DEC_W --> DM
    DEC_W --> WDS
    WDS --> SFS
    SFS --> DKM
    WDS --> MNT
    
    ENC_O --> Native
    KM --> Native
    DM --> Native
    
    Native --> TPM_HW
    Native --> CRED
    FS_H --> DISK
    EFC --> DISK
    KM --> DISK
    DM --> DISK
    SFS -->|"Read Encrypted Chunks"| DISK
    LOG --> DISK
    CFG --> DISK
    AL_H -->|"ping-activity"| AL_A
    AL_A -->|"vault-locked-inactivity"| UI
```

### Process Model

| Process | Technology | Role |
|---|---|---|
| Main Process | Node.js (Electron) | App lifecycle, IPC hub, file I/O, encryption engine, WebDAV server hosting, native addon loading, config and logs management |
| Renderer Process | React 19, TailwindCSS 4, React Hook Form, Framer Motion | User interface, client-side validation, routing, activity tracking |
| Preload Script | Electron contextBridge | Exposes secure, isolated, and typed API namespaces to the renderer |
| Worker Threads | Piscina thread pool | Parallel file chunk encryption for large files (>512 KB) |
| Native Addon | C++ (N-API, node-addon-api) | Windows Credential UI integration, Platform Key Storage Provider (TPM 2.0) bindings |

### Key Dependencies

| Dependency | Purpose |
|---|---|
| `piscina` | Multi-threaded worker pool management for offloading large-file encryption |
| `proper-lockfile` | Enforces mandatory file locks on source paths before processing |
| `webdav-server` | Hosts the local, authenticated WebDAV virtual drive server |
| `systeminformation` | Disk storage space queries for system pre-flight checks |
| `zod` | Runtime schema validation for preferences, configuration, and state schemas |
| `react-hook-form` | Form bindings and UI error mapping |
| `framer-motion` | Micro-animations and interface transition effects |

---

## 2. User Entry Flow

### Application Bootstrap

```mermaid
flowchart TD
    A["app.disableHardwareAcceleration()"] --> B{"requestSingleInstanceLock()"}
    B -->|"Lock failed (another instance running)"| C["app.quit()"]
    B -->|"Lock acquired"| D["registerIpcHandlers()"]
    D --> E["app.whenReady()"]
    E --> F["logger.initialize()"]
    F --> G["initializeFileSelectionHandler()"]
    G --> H["logger.info('APP_START', version)"]
    H --> I["createWindow(devServerUrl?)"]
    I --> J{"VITE_DEV_SERVER_URL exists?"}
    J -->|"Yes"| K["mainWindow.loadURL(devServerUrl)"]
    J -->|"No"| L["mainWindow.loadFile('dist/renderer/index.html')"]
    K --> M["Renderer Process Starts"]
    L --> M
```

**Module:** `src/main/main.ts`

**Decision Points:**
* **Single Instance Check:** Uses `app.requestSingleInstanceLock()`. If locked, the secondary instance logs an exit and terminates immediately.
* **Launch Routing:** Detects development server ports vs built production assets in `dist/renderer`.

### Renderer Bootstrap

```mermaid
flowchart TD
    A["main.tsx: bootstrap()"] --> B["await window.appConfig.getAppConfig()"]
    B --> C["createRoot().render(<App appConfig={config} />)"]
    C --> D["<AppConfigProvider initialConfig={config}>"]
    D --> E["<AppContent /> → useTheme()"]
    E --> F["<HashRouter> with RouteTracker"]
    F --> G{"Route requires SafeRouting?"}
    G -->|"Yes"| H{"config.initialized === true?"}
    H -->|"No"| I["Navigate to /setup"]
    H -->|"Yes"| J["Render protected page"]
    G -->|"No (SetupWizard, NotFound)"| K["Render directly"]
```

**Module:** `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/components/SafeRouting.tsx`

**SafeRouting Guard:** Routes except `/setup` and `*` are wrapped in `<SafeRouting>`. If the application configuration `initialized` parameter is false, users are redirected to `/setup` (the Setup Wizard) to set up encryption directories and system options.

---

## 3. Encryption Flow

### Master Encryption Workflow

Orchestrated by `handleStartEncryptionWorkflow()` in `src/main/handlers/encryption/encryption-workflow.main.ts`.

```mermaid
flowchart TD
    START["handleStartEncryptionWorkflow()"] --> GUARD{"inProgress?"}
    GUARD -->|"Yes"| SKIP["Return (no-op)"]
    GUARD -->|"No"| INIT["Set inProgress=true, create AbortController, ChangeJournal"]

    INIT --> STAGE1["emitStage('Preparing', 0)"]
    STAGE1 --> FETCH["Fetch selected files & encryption options"]
    FETCH --> CHECK_FILES{"selectedFiles.length > 0?"}
    CHECK_FILES -->|"No"| ERR1["Throw 'No files selected'"]
    CHECK_FILES -->|"Yes"| RESOLVE_OUT["resolveOutputDirectory(baseDir)"]

    RESOLVE_OUT --> OUT_NULL{"Output directory resolved?"}
    OUT_NULL -->|"null (user cancelled)"| ERR2["Throw 'USER_ABORTED'"]
    OUT_NULL -->|"Valid path"| STAGE2["emitStage('Analyzing files', 2)"]

    STAGE2 --> ACQUIRE["acquireAndValidateFiles(selectedFiles)"]
    ACQUIRE --> ABORT1{"signal.aborted?"}
    ABORT1 -->|"Yes"| ERR3["Throw 'USER_ABORTED'"]
    ABORT1 -->|"No"| SKIP_CHECK{"skippedCount > 0?"}
    SKIP_CHECK -->|"Yes"| WARN_SKIP["emitStage(WARNING: skipped files)"]
    SKIP_CHECK -->|"No"| VALID_CHECK

    WARN_SKIP --> VALID_CHECK{"lockedFiles.length > 0?"}
    VALID_CHECK -->|"No"| ERR4["Throw 'No valid files found'"]
    VALID_CHECK -->|"Yes"| BUILD_MAP["Build progressMap (Map<path, EncryptionProgress>)"]

    BUILD_MAP --> STAGE3["emitStage('Analyzing resources', 8)"]
    STAGE3 --> MKDIR["fs.mkdir(outputDirectory, recursive)"]
    MKDIR --> RESOURCES["checkSystemResources(outputDir, totalSize)"]

    RESOURCES --> RES_WARN["Loop: emit each resource warning"]
    RES_WARN --> RES_OK{"resources.ok?"}
    RES_OK -->|"No"| ERR5["Throw fatalMessage"]
    RES_OK -->|"Yes"| ABORT2{"signal.aborted?"}
    ABORT2 -->|"Yes"| ERR6["Throw 'USER_ABORTED'"]
    ABORT2 -->|"No"| ENCRYPT["encryptFiles(lockedFiles, key, options, ...)"]

    ENCRYPT --> ABORT3{"signal.aborted?"}
    ABORT3 -->|"Yes"| ERR7["Throw 'USER_ABORTED'"]
    ABORT3 -->|"No"| FAIL_COUNT{"failedCount > 0?"}
    FAIL_COUNT -->|"Yes"| WARN_FAIL["emitStage(WARNING: N files failed)"]
    FAIL_COUNT -->|"No"| METADATA_STAGE

    WARN_FAIL --> METADATA_STAGE["emitStage('Finalizing metadata', 95)"]
    METADATA_STAGE --> GET_PWD["getCachedPassword()"]
    GET_PWD --> PWD_NULL{"password !== null?"}
    PWD_NULL -->|"No"| ERR8["Throw 'No password'"]
    PWD_NULL -->|"Yes"| LEVEL_SWITCH{"encryptionLevel?"}

    LEVEL_SWITCH -->|"1"| L1["level1Enc(fileKeys, password, outputPaths)"]
    LEVEL_SWITCH -->|"2"| L2["level2Enc(fileKeys, password, outputPaths)"]
    LEVEL_SWITCH -->|"3"| L3["level3Enc(fileKeys, password, outputPaths)"]

    L1 --> CLEANUP_CHECK
    L2 --> CLEANUP_CHECK
    L3 --> CLEANUP_CHECK

    CLEANUP_CHECK{"cleanupAfterEncryption && failedCount === 0?"}
    CLEANUP_CHECK -->|"Yes"| TRASH["Release locks → shell.trashItem(source files)"]
    CLEANUP_CHECK -->|"No"| CLEAR

    TRASH --> CLEAR["clearSelectedItems()"]
    CLEAR --> DONE["emitStage('Encryption completed', 99)"]

    ERR1 --> CATCH
    ERR2 --> CATCH
    ERR3 --> CATCH
    ERR4 --> CATCH
    ERR5 --> CATCH
    ERR6 --> CATCH
    ERR7 --> CATCH
    ERR8 --> CATCH

    CATCH["CATCH block"] --> IS_ABORT{"error === 'USER_ABORTED'?"}
    IS_ABORT -->|"Yes"| ROLLBACK_A["journal.rollback() → emitStage(ABORT)"]
    IS_ABORT -->|"No"| ROLLBACK_F["journal.rollback() → emitStage(FAILED, error)"]

    DONE --> FINALLY
    ROLLBACK_A --> FINALLY
    ROLLBACK_F --> FINALLY

    FINALLY["FINALLY: releaseAllLocks(), scrub all key/IV buffers, clearCachedPassword(), clearThrottle, set inProgress=false"]
```

### Output Directory Resolution

If the target output directory exists and is not empty, the user is prompted with an Electron dialog containing three choices:
1. **Overwrite**: Uses the folder directly.
2. **Create New Folder**: Resolves the next available folder name suffix (e.g. `Folder (1)`).
3. **Cancel**: Halts the workflow and triggers an abort rollback.

### File Encryption Pipeline

Large files are partitioned from small files to maximize thread efficiency:
* **Threshold Boundary:** 512 KB (`INLINE_THRESHOLD_BYTES`).
* **Small Files (<= 512 KB):** Processed inline on the Electron main process thread with a maximum concurrency limit of 50 tasks.
* **Large Files (> 512 KB):** Offloaded to worker threads via **Piscina** with a concurrency limit defined as `Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)))`.
* **Change Journal:** Tracked via `EncryptionChangeJournal`. If an error or user abort occurs, the journal removes all output files written during the session to avoid partial artifacts.

### Core File Encryption (Streaming)

```mermaid
flowchart TD
    A["encryptFileStream(params)"] --> B["Convert rawKeyHex → Buffer key"]
    B --> C["Generate random 12-byte IV"]
    C --> D["Create AES-256-GCM cipher"]
    D --> E["Stat source file for size"]
    E --> F["Create readStream & writeStream"]
    F --> G["Write IV as first bytes of output file"]
    G --> H["Create Transform tracker (progress %, deduplicated)"]
    H --> I["Pipeline: readStream → tracker → cipher → writeStream"]
    I --> J["Get authTag (16 bytes)"]
    J --> K["Append authTag to end of output file"]
    K --> L["End writeStream, Await 'finish' event"]
    L --> M["Return { ivHex, authTagHex }"]

    I -->|"Error"| N{"signal.aborted or AbortError?"}
    N -->|"Yes"| O["Throw 'USER_ABORTED'"]
    N -->|"No"| P["Destroy writeStream, rethrow"]
```

**Encrypted File Binary Layout:**
```
┌──────────────┬─────────────────────────┬──────────────────┐
│  IV (12 B)   │  Encrypted Data (var)   │  AuthTag (16 B)  │
└──────────────┴─────────────────────────┴──────────────────┘
```

---

## 4. Decryption & Virtual Mount Flow

Decryption reads metadata, initializes a local virtual WebDAV server, and mounts the vault on the host operating system, performing on-the-fly streaming decryption.

```mermaid
flowchart TD
    A["User triggers Open Vault"] --> B["Select chunk directory"]
    B --> C["Check directory contains 'v' metadata"]
    C --> D["Native Prompt: CredUIPromptForWindowsCredentialsW"]
    D --> E["decryptMetadataPayload(metadataBuffer, password)"]
    E --> F["Parse Magic Bytes and check TPM (Level 2/3)"]
    F --> G["Derive Password Key via Scrypt and decrypt DEK"]
    G --> H["Deserialize metadata bytes to memory structures"]
    H --> I["Start local WebDAV Server (random port, 32-byte token)"]
    I --> J["Mount virtual drive (Drive Z: on Win / Volumes on macOS)"]
    J --> K["Renderer navigates to /decrypted-content page"]
```

### Steps in the Decryption Pipeline

1. **Vault Importing:** The user selects an encrypted vault directory. The handler verifies the metadata file named `v` exists.
2. **Native Password Collection:** If a password is not cached, the application halts the main UI and calls `askPassword()`. The native compiled C++ module displays the secure OS-level credential dialog (`CredUIPromptForWindowsCredentialsW`).
3. **DEK Wrapping Resolution:**
   * **Level 1:** Uses the Scrypt-derived key to decrypt `passWrap` and extract the DEK.
   * **Level 2:** Decrypts `passWrap` to get the TPM-wrapped DEK, then passes it to the physical TPM via Windows NCrypt (`tpmDecrypt`) to recover the DEK.
   * **Level 3:** Recovers the DEK via the TPM and password. For recovery-phrase-only workflows, combines the derived PBKDF2 phrase key and the physical `key_file` payload using `HMAC-SHA256` to decrypt `backupWrap`.
4. **Metadata Deserialization:** The decrypted binary payload is parsed using the matching binary deserialization protocol. It loads files, virtual directories, and key mappings into memory cache maps:
   * `decryptedItemsMap`: Map of virtual file names and structures.
   * `childrenIndexMap`: Directory layouts.
   * `secureFileKeysMap`: Wires keys and IVs for streaming decryption.
5. **Local WebDAV Daemon Lifecycle:**
   * Spins up a `webdav-server` instance bound to localhost (`127.0.0.1`) on a random available port.
   * Restricts server path access using a secure, randomized 32-byte hexadecimal `mountToken` (e.g. `http://127.0.0.1:53213/f8c2e9...`).
   * Bypasses client browser authentication prompts by mapping HTTP `401` responses to `403` and dropping `WWW-Authenticate` response headers.
6. **OS Mounting:**
   * **Windows:** Executes `net use Z: http://127.0.0.1:${port}/${mountToken} /persistent:no` (falls back to UNC path format `\\\\127.0.0.1@${port}\\DavWWWRoot...` if standard mount fails).
   * **macOS:** Creates `/Volumes/SecureVault` mount point and executes `mount_webdav`.
7. **On-the-Fly Stream Decryption (`SecureFileSystem`):**
   * When the OS requests a read operation on a file inside the mounted drive, `SecureFileSystem._openReadStream` maps the virtual path to the corresponding physical encrypted file (`encName`).
   * Opens the file handle and reads the trailing 16-byte authentication tag (`12 + size`).
   * Instantiates a file read stream starting at byte index 12 (skipping the IV) and ending at `12 + size - 1`.
   * Pipes the file stream directly into `crypto.createDecipheriv('aes-256-gcm', key, iv)` bound with the authentication tag.
   * Outputs the decrypted stream directly to the OS file reader.
8. **Strict Read-Only Enforcement:**
   * Any writing, renaming, moving, or deleting requests directed at the virtual drive automatically fail, returning `webdav.Errors.Locked`.

---

## 5. Metadata Flow

### Metadata Serialization Protocol

To prevent raw file names, key lists, and IV maps from lingering in the V8 heap as garbage-collected string variables, the application uses a binary serialization format:

```
┌──────────────────────────┐
│  chunkName length (u32)  │
│  chunkName (UTF-8)       │
├──────────────────────────┤
│  entry count (u32)       │
├──────────────────────────┤
│  Entry 1:                │
│    name len (u32) + data │
│    encName len + data    │
│    virtualPath len + data│
│    key (32 bytes raw)    │
│    iv (12 bytes raw)     │
│    algorithm len + data  │
│    size (BigInt64)       │
│    ext len + data        │
├──────────────────────────┤
│  Entry 2: ...            │
└──────────────────────────┘
```

**Module:** `src/main/handlers/crypto-core.helpers.ts`

### Metadata Encryption Wrapper Layouts

Once serialized, the metadata buffer is encrypted with a random 32-byte DEK and packed with Level-specific wraps:

* **Level 1 (Standard Software):**
  * Magic Bytes: `"BEV1"` (4 bytes)
  * Level indicator (1 byte)
  * BigInt timestamp (8 bytes)
  * Length-prefixed chunk name
  * Salt (16 bytes)
  * `passWrap` (12-byte IV + 16-byte GCM Tag + 32-byte encrypted DEK)
  * `backupWrap` (12-byte IV + 16-byte GCM Tag + 32-byte encrypted DEK)
  * `metadataEnc` (12-byte IV + 16-byte GCM Tag + variable encrypted metadata payload)
* **Level 2 (Hardware-Bound TPM):**
  * Magic Bytes: `"BVK2"`
  * Similar structure, but `passWrap.encryptedData` is a 256-byte buffer containing the TPM-encrypted DEK wrapped with the user's password key.
* **Level 3 (Strict Hardware-Bound + Dual-Factor):**
  * Magic Bytes: `"BVK3"`
  * Generates an additional physical 64-byte key file (`BVK3_KEYFILE` header + payload).
  * `backupWrap` is encrypted with a combined key derived via `HMAC-SHA256(recoveryPhraseKey, keyfilePayload)`.

---

## 6. Recovery Flow

### Key Derivation Primitives

* **Mnemonic Phrase Generation:** Randomly selects 12 words from a 2048-word BIP39 dictionary in `word-list.json` using `crypto.randomInt()`, producing 132 bits of cryptographic entropy.
* **Mnemonic Key Derivation:** Uses PBKDF2 with 100,000 iterations, a SHA-256 digest, and a static salt `bedrock-vault-salt-recovery` to derive a 32-byte recovery key.
* **Level 3 Key Combining:** Utilizes a SHA-256 HMAC of the 64-byte keyfile payload with the recovery key as the HMAC password.

---

## 7. Threading Flow

### Piscina Worker Pool Orchestration

To maintain 60 FPS UI performance in the renderer, CPU-heavy file encryption streams are offloaded to background threads:

```mermaid
flowchart TD
    A["Main Thread: encryptFiles()"] --> B["Partition files by size"]
    B --> C["Small files (≤512 KB): inline encryption"]
    B --> D["Large files (>512 KB): worker pool"]

    C --> E["runWithConcurrencyLimit(smallTasks, 50)"]
    D --> F["Create Piscina({ filename: WORKER_PATH, maxThreads: cpuConcurrency })"]
    F --> G["runWithConcurrencyLimit(largeTasks, cpuConcurrency)"]

    G --> H["For each large file:"]
    H --> I["Create MessageChannel"]
    I --> J["pool.run({ sourceFilePath, encryptedOutputPath, rawKeyHex, port })"]
    J --> K["Worker: run-pool-job.ts"]
    K --> L["Worker: encryptFileStream()"]
    L --> M["Worker sends progress via port.postMessage()"]
    M --> N["Main thread receives progress via port1.on('message')"]
    N --> O["updateProgress() → emitFileProgress()"]

    E --> P["Promise.all([large results, small results])"]
    G --> P
    P --> Q["pool.destroy()"]
```

**Progress Throttling:** Progress updates are gathered from the main/worker threads and throttled via `THROTTLE_INTERVAL_MS` (150ms) before being sent to the React renderer, avoiding IPC congestion.

---

## 8. IPC Flow

### Register Channels (`src/main/ipc-handler.ts`)

#### File Selection
* `get-selected-files-state` → Retrieves selected files list and configuration.
* `save-selected-files-options` → Saves checkboxes/filtering preferences.
* `add-selected-files` / `add-selected-folder` → Appends files to the selection.
* `remove-selected-item` / `clear-selected-items` → Removes selection entries.
* `get-current-path-files` → Queries file list for virtual folder navigation.

#### Encryption Config & Launch
* `get-encryption-options` / `save-encryption-options` → Manages preferences.
* `select-encrypted-output-directory` → Opens directory save dialog.
* `select-recovery-phrase-save-path` / `select-file-key-save-path` → Dialog handlers.
* `prompt-and-set-password` → Invokes native password prompt.
* `has-encryption-password` / `clear-encryption-password` → Caching checks.
* `is-tpm-available` / `is-software-ksp-available` → Hardware checks.
* `start-encryption-flow` / `abort-encryption-flow` → Lifecycle handlers.

#### Decryption & Drive Mounting
* `decryption:decrypt-metadata` → Validates, decrypts, and mounts WebDAV.
* `decryption:get-current-path-files` → Lists files inside the mounted vault.
* `decryption:open-vault-file` → Maps path to virtual drive and opens.
* `decryption:lock-vault` → Unmounts WebDAV drive and sanitizes memory.
* `start-security-timer` / `stop-security-timer` (IPC On) → Manages idle timer.
* `ping-activity` (IPC On) → Resets the auto-lock security timer.

#### Registry Records
* `encryption-record:get-records` → Loads records from `record.json`.
* `encryption-record:add-record` → Imports vault records.
* `encryption-record:remove-record` → Deletes records and optionally trashes target folders.

---

## 9. Validation Flow

### Path Security Rules (`validatePath` / `ensureIsFilePath`)

Paths are validated to prevent directory traversal and system file overwrites:
* **Null Byte Check:** Paths containing `\0` are rejected.
* **Windows Exclusions:** Rejects paths targeting `C:\Windows`, `C:\Program Files`, `C:\ProgramData`, and user `AppData` directories.
* **Unix Exclusions:** Rejects paths targeting `/etc`, `/var`, `/usr`, `/bin`, `/sbin`, `/dev`, `/proc`, `/sys`, `/root`, and hidden paths.

### Pre-Flight Resource Check

* **Space Check:** Target drive must contain free space >= total source size.
* **RAM Check:** Assesses system memory; issues a warning if free memory is < 256 MB.
* **CPU Check:** Emits a warning if a single-core CPU is detected (disables Piscina load scaling).

---

## 10. Error Handling Flow

### Transaction Integrity & Failure Rollback

```mermaid
flowchart TD
    A["EncryptionChangeJournal created"] --> B["For each encrypted file created:"]
    B --> C["journal.recordCreated(outputPath)"]
    C --> D{"Encryption succeeds?"}
    D -->|"Yes"| E["Journal discarded (no rollback needed)"]
    D -->|"No (error or abort)"| F["journal.rollback()"]
    F --> G["Promise.allSettled: fs.rm(each recorded path, { force: true })"]
    G --> H["Clear journal array"]
```

### Config Recovery Strategies

* **Config Missing (`ENOENT`):** Automatically initializes `config.json` with default theme and inactivity limits.
* **Preferences Corrupted:** Deletes the invalid Zod structure from `userData` and writes default options.
* **Select State Invalid:** Wipes selections and resets to an empty queue.

---

## 11. Logging Flow

* **Dual Log Files:** Written to `{userData}/logs/`.
  * `main-{timestamp}.log`: Electron backend logs.
  * `renderer-{timestamp}.log`: React user interface logs.
* **Format:** `[TIMESTAMP] [SEVERITY] [NAMESPACE] MESSAGE`
* **Renderer Log Transport:** Renderer logs are stringified and transported via the `app-log` channel to avoid serialization circular-reference blockages in Node.

---

## 12. Security Flow

### Password Lifespan & Memory Zeroing

```mermaid
flowchart TD
    A["User clicks 'Set Password'"] --> B["Renderer: window.encryptionOptions.promptAndSetPassword()"]
    B --> C["IPC: invoke('prompt-and-set-password')"]
    C --> D["Main: setEncryptionPassword()"]
    D --> E{"Existing cachedPassword?"}
    E -->|"Yes"| F["cachedPassword.fill(0) — Secure wipe"]
    F --> G["askPassword()"]
    E -->|"No"| G
    G --> H["Native addon: CredUIPromptForWindowsCredentialsW"]
    H --> I{"User cancelled?"}
    I -->|"Yes (USER_CANCELLED)"| J["Return false"]
    I -->|"No"| K["Return password as Buffer (not string)"]
    K --> L["Cache in module-level variable"]
    L --> M["Return true"]
```

* **Zero Memory Operations:** All cryptographic keys, IVs, wrapping variables, and password buffers are allocated as raw Node `Buffer` instances (not strings) and actively zeroed out using `Buffer.fill(0)` and native C++ `SecureZeroMemory` upon completion of the workflow.

### Auto-Lock Security Lifecycle

* **Renderer Binding:** The `useAutoLock` hook monitors active DOM interactions (`mousemove`, `keydown`, `click`, `scroll`). If the page is active and the user is on the `/decrypted-content` view, the hook pings the main process once per second via `ping-activity`.
* **Main Process Timer:** The main process runs a timer loop. If no ping is received for `inactivityTimeoutMs` (default 5 minutes), the main process executes `executeAutoLock()`:
  1. Aborts any active file selections.
  2. Unmounts the virtual drive (e.g. drive `Z:` / `/Volumes/SecureVault`).
  3. Stops the local WebDAV server instance.
  4. Calls `clearDecryptedCache()` and `clearCachedPassword()`, zeroing out all keys in memory.
  5. Sends `vault-locked-inactivity` to all windows.
  6. Opens a system message dialog alerting the user.
* **Renderer Redirection:** Upon receiving `vault-locked-inactivity`, the renderer redirects the viewport to `/` (Home page) and resets theme/routing settings.

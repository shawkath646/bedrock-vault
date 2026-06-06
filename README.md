# Bedrock Vault

[![Release Version](https://img.shields.io/badge/version-1.0.3--beta-blue.svg)](https://github.com/shawkath646/bedrock-vault)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey.svg)](#)

Bedrock Vault is a high-security, cross-platform desktop application designed to provide robust, local file encryption. Built with **ElectronJS**, **React**, and **Vite**, Bedrock Vault ensures that sensitive files remain under the user's absolute control, shielding them from external cloud environments and unauthorized access.

---

## 1. Introduction

Bedrock Vault is a local-first file encryption tool designed to address privacy risks in an increasingly cloud-connected and AI-driven digital landscape. Operating on a zero-trust model, Bedrock Vault enables users to secure documents, datasets, and archives locally before they are uploaded, synchronized, or processed by external systems. 

By keeping primary encryption keys and cryptographic operations completely local, Bedrock Vault removes dependency on cloud service providers' security policies. The application leverages system-level technologies to bind vault security directly to the host computer's hardware, providing protection against offline data harvesting.

Rather than relying on typical file-archiving methods that require manual unpacking, Bedrock Vault implements a virtual filesystem driver. Encrypted vaults can be mounted on-the-fly as read-only virtual drives, allowing the operating system and installed apps to read files dynamically via stream decryption without ever writing unencrypted temporary files back to physical storage.

---

## 2. Why Bedrock Vault?

In the modern computing landscape, data privacy faces unique endpoint challenges:

* **Expanding Trust Boundaries**: While modern cloud storage services offer seamless convenience, they expand the trust perimeter. Private files are synchronized across multiple endpoints, remote servers, and third-party hosting infrastructures.
* **Continuous AI Processing**: Operating systems and cloud ecosystems are increasingly integrated with background AI models that continually index, scan, and digest user data for analytical purposes.
* **Persistent Data Breaches**: Perimeter security and server-side encryption are vulnerable to misconfiguration, insider threats, and system-level breaches.
* **Endpoint-First Protection**: Securing data at the local source prior to sync ensures that even in the event of a cloud breach, the actual data remains unreadable.
* **Hardware-Backed Assurance**: Leveraging hardware modules like the Trusted Platform Module (TPM) ensures encryption keys cannot be cloned, even if the storage device is compromised.
* **Decoupled Security**: Users should control their own cryptographic keys, rather than delegating key management and vault access to third-party cloud hosts.

---

## 3. Purpose

Bedrock Vault provides cryptographic protection at the local endpoint. It is designed for privacy-conscious users, researchers, software engineers, students, and security enthusiasts who manage sensitive intellectual property, research data, or personal files.

The application translates key operating system and security concepts into practical features:

* **Process Isolation**: Cryptographic operations are isolated from the main user interface loop, running in separate system processes and background worker threads.
* **Secure Storage**: Sensitive key materials are encrypted at rest and sanitized in memory immediately after execution.
* **Hardware Trust Anchors**: Binding cryptographic wrapping keys directly to the physical motherboard's security chip.
* **Multi-Threading**: Distributing file blocks to thread pools to maintain UI responsiveness during heavy cryptographic operations.
* **Resource Management**: Evaluating system memory, storage, and CPU parameters before executing tasks to avoid system starvation.

---

## 4. Key Features

### Security
* **AES-256-GCM Encryption**: All files are encrypted using the Advanced Encryption Standard in Galois/Counter Mode, guaranteeing both data confidentiality and cryptographic integrity verification.
* **Multi-Level Key Wrapping**:
  * **Level 1 (Standard)**: Derives a wrapping key from the user's password using **Scrypt** to encrypt the Data Encryption Key (DEK).
  * **Level 2 (Hardware-Backed)**: Wraps the DEK with a hardware key bound to the system's **Trusted Platform Module (TPM)**, in addition to user password verification.
  * **Level 3 (Hardware-Backed + Dual-Factor)**: Extends Level 2 by requiring both a **12-word mnemonic recovery phrase** and a physical **64-byte keyfile** to bypass the hardware block.
* **On-the-Fly Stream Decryption**: Mounts vaults as read-only virtual drives, streaming decrypted chunks into memory as requested by the OS without writing decrypted temp files to disk.
* **Secure Memory Sanitization**: Actively wipes sensitive cryptographic buffers in JavaScript (`Buffer.fill(0)`) and in the C++ runtime layer (`SecureZeroMemory`) to prevent keys from lingering in the system heap.
* **Inactivity Auto-Lock**: Automatically unmounts virtual drives, clears cached keys, and resets state after a configured period of inactivity.
* **Electron Hardening**: Configured with strict Electron Fuses to disable CLI node execution, restrict debugging flags, and enforce ASAR integrity validation.

### Performance
* **Thread-Pool Offloading**: Utilizes background worker threads via **Piscina** for processing files larger than 512 KB, preventing UI lag.
* **Dual-Queue Concurrency**: Encrypts small files (<= 512 KB) inline in parallel (up to 50 concurrent tasks) to avoid thread spawning overhead, while throttling large files to match CPU cores.
* **Streaming I/O**: Implements stream pipelines (`node:stream/promises`) to read, process, and write files chunk-by-chunk, keeping memory usage constant regardless of file size.

### Architecture
* **Decoupled Processes**: Separates the React-based frontend renderer from the Electron main process, enforcing a strict IPC API.
* **Secure WebDAV Virtual FS**: Spins up a local WebDAV server restricted to `127.0.0.1` and secured with a 32-byte randomized token path to handle OS filesystem requests.
* **Lock-Enforced Concurrency**: Automatically acquires system locks via `proper-lockfile` to prevent write conflicts during vault construction.

### User Experience
* **Premium UI**: Styled with Tailwind CSS, Outfit/Inter typography, Hugeicons, and smooth Framer Motion micro-animations.
* **In-App Vault Registry**: Keeps a local history record table (`record.json`) of created vaults for quick mounting.
* **System Activity Listener**: Monitors mouse and keyboard interactions to dynamically prevent auto-locking during active sessions.
* **Resource Warnings**: Pre-checks host disk space and memory before processing to prevent incomplete operations.

---

## 5. Architecture Overview

```
           +---------------------------------------------+
           |               React Renderer                |
           +---------------------------------------------+
                                  |
                           IPC (Preload API)
                                  |
                                  v
           +---------------------------------------------+
           |            Electron Main Process            |
           +---------------+-----------------------------+
                           |
            +--------------+--------------+
            |                             |
            v                             v
  +-------------------+         +-------------------+
  |   Worker Pool     |         |   Local WebDAV    |
  | (Piscina Threads) |         |      Server       |
  +---------+---------+         +---------+---------+
            |                             |
     Stream Encryption             On-the-Fly Decrypt
            |                             |
            v                             v
  +-----------------------------------------------------+
  |                   Local File System                 |
  +-----------------------------------------------------+
            ^                             ^
            |                             |
     Windows Cryptography (NCrypt) <------+
     (TPM Platform KSP Key Store)
```

* **Electron Main Process**: Manages application lifecycles, spawns background services, and hosts native OS API bindings.
* **React Renderer**: Renders the desktop UI in an isolated process with restricted node access.
* **Worker Threads**: Offloads CPU-intensive file streaming and GCM transformations to Piscina background workers.
* **Encryption Engine**: Combines 12-byte IVs with 16-byte authentication tags at the stream boundaries of files.
* **TPM Integration**: Dynamically interfaces with Windows NCrypt libraries via a custom compiled C++ addon.
* **IPC Communication**: Exchanges serializable events and data buffers across process boundaries using context-isolated preloads.

---

## 6. Technical Highlights

### Custom Binary Metadata Serialization
To prevent sensitive file details and cryptographic keys from lingering in the V8 garbage collector heap, Bedrock Vault avoids using JSON strings for key mapping. Instead, it serializes metadata using a custom binary buffer protocol:
```typescript
// Example from src/main/handlers/crypto-core.helpers.ts
export function serializeMetadata(metadata: MetadataHandler): Buffer {
  const buffers: Buffer[] = [];
  // Packs fields (name, encName, virtualPath, key, iv, size, ext) into a single buffer...
  const result = Buffer.concat(buffers);
  // Manually sanitizes intermediate buffers
  for (const buf of buffers) {
    buf.fill(0);
  }
  return result;
}
```

### On-the-Fly Decryption Streaming
When the operating system requests a file block from the mounted virtual drive, the custom WebDAV server reads the 16-byte authentication tag from the end of the physical file and streams data blocks through the decipher pipeline:
```typescript
const readStream = fs.createReadStream(physicalPath, {
  start: 12, // Skip prepended IV
  end: 12 + entry.size - 1,
});
const decipher = crypto.createDecipheriv('aes-256-gcm', entry.key, entry.iv);
decipher.setAuthTag(authTag);
callback(undefined, readStream.pipe(decipher));
```

### Thread Pool Load Balancing
To balance low latency for configuration files and high throughput for archives, the workflow segments files by size:
* **Inline Queue**: Files <= 512 KB bypass the thread pool and encrypt inline on the main process with a high concurrency limit (up to 50 concurrent files).
* **Pool Queue**: Files > 512 KB are scheduled into Piscina worker threads. This limits thread overhead for small assets while protecting the Electron event loop from blocking on large files.

### Windows NCrypt & TPM Bindings
The C++ native addon (`native_prompt.node`) uses the Windows Platform Key Storage Provider (`MS_PLATFORM_KEY_STORAGE_PROVIDER`) to generate a hardware-bound key `BedrockVaultTpmKey`. If the system lacks a physical TPM chip, the addon falls back to the software key storage provider (`MS_KEY_STORAGE_PROVIDER`).

---

## 7. Development Challenges

* **TPM Thread Deadlocks**: Calling credential dialogs (`CredUIPromptForWindowsCredentialsW`) directly on the main thread blocked the Electron UI. This was resolved by implementing asynchronous C++ workers (`Napi::AsyncWorker`) to handle the UI dialog on a background thread.
* **V8 Cryptographic Key Retention**: In JavaScript, garbage collection is non-deterministic, posing a risk of key exposure in memory. The app mitigates this by keeping key materials as Node Buffers and immediately calling `.fill(0)` in JS, combined with `SecureZeroMemory` in C++.
* **Windows WebDAV client Loop**: The native Windows WebDAV client (`net use`) attempts to authenticate repeatedly when mounting a server. To prevent browser login dialogues, the server intercepts incoming headers, converts HTTP 401 statuses to 403, and strips `WWW-Authenticate` headers.
* **WebDAV Read-Only Lock**: Mutating files within the virtual WebDAV drive created complex caching and concurrency issues. Enforcing a strictly read-only virtual filesystem resolved these race conditions.
* **Electron Hardening**: Fuses must be carefully configured post-packaging. Flipped fuses ensure the app cannot be launched with debugging flags or load unpacked scripts, maintaining the integrity of the endpoint boundary.

---

## 8. Future Roadmap

### Planned
* **Cloud Synchronization**: Integrate active Google Drive, OneDrive, and Dropbox API handlers to synchronize encrypted vaults directly from the dashboard.
* **Multi-Provider Fragment Distribution**: Automate backup dispersion by splitting vaults across multiple storage backends.
* **Mobile Companion App**: Lightweight decryptor client (iOS/Android) leveraging mobile secure enclaves to view vaults.

### Experimental
* **Native Filesystem Driver (FUSE)**: Migrate from WebDAV to native FUSE (on macOS/Linux) or Project Reunion (on Windows) to bypass WebDAV network stack overhead.
* **Dynamic Write Mounts**: Enable real-time encryption streams for write operations directly on mounted virtual directories.

---

## 9. Disclaimer

**Bedrock Vault is currently in beta (v1.0.3-beta).** 

While it implements industry-standard cryptography (AES-256-GCM, Scrypt, PBKDF2) and hardware-backed key storage, all security software should undergo independent audit before being used to protect highly sensitive production assets. No software-based security architecture can provide absolute protection against all vectors of compromise.

---

### Project Information
* **Name**: Bedrock Vault
* **Version**: 1.0.3-beta
* **Developer**: Shawkath646
* **Website**: [shawkath646.pro](https://shawkath646.pro)
* **Published By**: CloudBurst Lab

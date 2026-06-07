# System Diagram — Image Generation Prompt

> **Target Model:** DALL-E 3 / Midjourney v6 / Infographic Generator / Stable Diffusion
> **Output Format:** PNG, high resolution (4K presentation quality)
> **Perspective:** Professional Technical Infographic — Flat clean design showing logical structure and workflows without exposed source code.

---

## Infographic Generation Prompt

Create a professional, presentation-ready system architecture and workflow infographic diagram for a desktop file encryption application called **"Bedrock Vault"**. The diagram must clearly illustrate the three core pillars of the system: **1) The Encryption Workflow**, **2) The Decryption & Virtual Mounting Workflow (On-the-Fly Streaming)**, and **3) The Security Lifeguard & Auto-Lock Lifecycle**.

### Visual Style Requirements:
* **Background:** Clean, neutral light gray or pure white background (#FFFFFF or #F9FAFB) for maximum readability.
* **Palette:**
  * **Primary:** Indigo (#4F46E5) for active processes, workflows, and primary nodes.
  * **Success/Secure:** Emerald Green (#10B981) for secure states, successfully mounted virtual drives, and completed encryption.
  * **Warning/Attention:** Amber (#F59E0B) for warnings, key files, and KDF steps.
  * **Neutral/Background:** Soft gray (#F3F4F6) with light, crisp borders and subtle drop shadows (1px-2px blur) to create card depth.
* **Nodes & Layout:** Organise the diagram into **three distinct columns or vertical lanes** reading left-to-right:
  1. **Lane 1: Encryption & Vault Packing** (Left)
  2. **Lane 2: Decryption & Virtual Mounting (On-the-Fly Service)** (Center)
  3. **Lane 3: Security auto-lock & Memory Sanitization** (Right)
* **Iconography:** Use consistent, clean line-art style icons on the left of each step (Shield, Folder, CPU, Chip/TPM, Network Drive, Timer, Lock).
* **Connections:** Use crisp, directional arrows with clean arrowheads to indicate the sequential flow of data and commands. Use dashed lines for network/virtual bindings and solid lines for direct cryptographic pipelines.
* **Typography:** Modern, legible sans-serif font (such as Inter, Roboto, or Segoe UI) with clear hierarchy (large title, lane headers, step labels, and small subtitles).

---

## Diagram Structure & Layout Elements

### [TITLE - Top Centered]
**Bedrock Vault — Core Architecture & Secure File Lifecycle**  
*Subtitle: "Hardware-bound file encryption and on-the-fly streaming virtual drives"*

---

### [LANE 1: ENCRYPTION WORKFLOW (Left Column)]
*Header: "A. Secure Vault Encryption & Packing"*

1. **File Selection**
   * Icon: Folder with plus sign (`+`)
   * Label: "Source File Selection"
   * Subtitle: "Acquire target files and apply file locks via system scheduler"

2. **Configure Settings & Level**
   * Icon: Sliders / Gears
   * Label: "Select Vault Security Level"
   * Subtitle: "Choose: Level 1 (Software Key) / Level 2 (TPM Hardware-Bound) / Level 3 (TPM + Keyfile)"

3. **Master Password Prompt**
   * Icon: Fingerprint / Key dialog
   * Label: "Secure Password Entry"
   * Subtitle: "User inputs passphrase via isolated native credential window"

4. **Multi-Threaded Encryption Engine**
   * Icon: CPU / Multi-Core indicator
   * Label: "Piscina Worker Pool"
   * Subtitle: "Files <= 512KB processed inline; files > 512KB offloaded to background threads. Encrypted using AES-256-GCM streams"

5. **Vault Package Output**
   * Icon: Encrypted Archive / Locked folder
   * Label: "Packed Vault & Recovery Key"
   * Subtitle: "Generates chunk folder with metadata header file 'v' and outputs 12-word recovery mnemonic"

---

### [LANE 2: DECRYPTION & VIRTUAL MOUNTING (Center Column)]
*Header: "B. On-the-Fly Decryption & Virtual Mounting"*

6. **Select Encrypted Vault**
   * Icon: Folder with keyhole
   * Label: "Load Chunk Folder"
   * Subtitle: "Point application to encrypted folder containing metadata file 'v'"

7. **Verify Credentials**
   * Icon: TPM Microchip / Double Key
   * Label: "TPM Key & Password Check"
   * Subtitle: "Main process queries Windows NCrypt API to unlock the hardware-bound Data Encryption Key (DEK)"

8. **Secure WebDAV Server Init**
   * Icon: Server / Local Host
   * Label: "Randomized WebDAV Daemon"
   * Subtitle: "Launches localhost WebDAV server bound only to 127.0.0.1 on a random port with a 32-byte session token path"

9. **Virtual Drive Mounting**
   * Icon: Network Drive icon / Mount disk
   * Label: "OS Virtual Mount"
   * Subtitle: "Mounts secure virtual drive (Drive Z: on Windows / Volumes/SecureVault on macOS) as a strictly read-only filesystem"

10. **On-the-Fly Streaming Decryption**
    * Icon: Play button in circle / Streaming arrow
    * Label: "Decryption on Read Requests"
    * Subtitle: "Files are decrypted chunk-by-chunk in memory during OS read operations; no decrypted files are written to physical disk"

---

### [LANE 3: SECURITY AUTO-LOCK & CLEANUP (Right Column)]
*Header: "C. Security Lifeguard & Session Lockdown"*

11. **Activity Monitor**
    * Icon: Pulse / Activity line
    * Label: "User Activity Listener"
    * Subtitle: "Monitors mouse movements, keyboard presses, and scroll inputs to track vault usage"

12. **Inactivity Timeout**
    * Icon: Hourglass / Clock
    * Label: "Idle Security Timer"
    * Subtitle: "Triggers automatically after 5 minutes (configurable) of user idle state"

13. **Drive Unmounting**
    * Icon: Disk eject icon
    * Label: "Virtual Drive Unmount"
    * Subtitle: "Instantly ejects virtual Drive Z: / Volumes folder, destroying the WebDAV server instance"

14. **Memory Purge & Sanitization**
    * Icon: Trash can with key / Sparkle shield
    * Label: "Cryptographic Memory Zeroing"
    * Subtitle: "Fills key/IV buffers with 0s and executes C++ SecureZeroMemory to prevent heap key harvesting"

15. **System Lock**
    * Icon: Locked shield
    * Label: "Vault Locked"
    * Subtitle: "Redirects user back to landing screen and prompt dialog, securing the vault"

---

### [DIAGRAM FOOTER]
"Bedrock Vault v1.0.3-beta — Built with Electron, React, Vite, and Windows Platform Key Storage Provider. Published by CloudBurst Lab"

---

### Additional Formatting Instructions for Generator:
* Ensure lanes are aligned horizontally to show progression from file selection (Lane 1) to virtual mount (Lane 2) to active protection (Lane 3).
* Color-code connection arrows: Use **Indigo** for the primary workflow path, **Emerald Green** for the mounted/active secure drive loops, and **Amber** for security timeouts and locking steps.
* Avoid code blocks, variable names, or internal class structures; focus on clean blocks, logical components, and visual clarity.

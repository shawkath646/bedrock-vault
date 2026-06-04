# System Diagram — Image Generation Prompt

> **Target Model:** Nano Banana / DALL-E / Midjourney / Similar  
> **Output Format:** PNG, high resolution (4K recommended)  
> **Perspective:** End-User View Only — No code, no algorithms, no internal details

---

## Prompt

Create a professional, presentation-ready system diagram infographic for a desktop file encryption application called **"Bedrock Vault"**.

**Visual Style:**
- Modern SaaS / product landing page style
- Clean white background
- Primary color: Indigo (#4F46E5) with lighter shades for backgrounds (#EEF2FF)
- Accent colors: Emerald green for success states, Amber for warnings, Soft gray for neutral elements
- Flat design with subtle depth (light drop shadows on cards)
- Consistent rounded-rectangle card elements for each step
- Professional iconography (shield, lock, folder, gear, checkmark icons)
- Smooth directional arrows connecting each step vertically
- Sans-serif typography (Inter or similar modern font)
- Investor/demo presentation quality
- High readability at both screen and print sizes

**Layout:** Top-to-bottom vertical flowchart with branching where noted. Each step is a rounded card with an icon on the left and a short label on the right.

---

**Flow Diagram Steps (in order):**

**[START — Top of Diagram]**

**1. Launch Bedrock Vault**
Icon: Shield with checkmark
Subtitle: "Open the application"

↓

**2. First-Time Setup** *(shown as optional branch with dashed border)*
Icon: Wizard hat / magic wand
Subtitle: "Choose theme, set default encryption preferences"

↓

**3. Home Dashboard**
Icon: Home / grid layout
Subtitle: "View local storage status, cloud sync overview, and quick actions"
Side elements: Three small cards labeled "Encrypt Files", "Open Vault (coming soon)", "Encryption History (coming soon)"

↓

**4. Select Files & Folders**
Icon: Folder with plus sign
Subtitle: "Add files or entire folders for encryption"
Side note: "Filter by file type: Documents, Audio, Video, Pictures, Programs, Others"
Side note: "Include subfolders • Set maximum file size"

↓

**5. Configure Encryption Settings**
Icon: Gear / sliders
Subtitle: "Set your encryption preferences"
Sub-items shown as a compact settings card:
- "Encryption Level: Standard (Level 1) / Hardware-Bound (Level 2) / Strict Hardware-Bound (Level 3)"
- "Encrypt file names & directory structure"
- "Set output directory"
- "Set recovery phrase save location"
- "Add to cloud sync"
- "Clean up source files after encryption"

↓

**6. Set Master Password**
Icon: Key / fingerprint
Subtitle: "Enter your password via secure system dialog"
Note: "Password never stored on disk — entered through Windows Credential UI"

↓

**7. Review & Confirm**
Icon: Clipboard with checkmark
Subtitle: "Review selected files, settings, and output location before starting"
Sub-items: "File count • Total size • Output path • Encryption level • Warnings (if any)"

↓ *(Arrow labeled "Start Encryption")*

**8. Encryption In Progress**
Icon: Loading spinner / processing animation
Subtitle: "Files are encrypted securely with real-time progress"
Sub-items: "Per-file progress tracking • Stage updates • Cancel anytime"
Side note: "Files processed in parallel using multiple CPU cores"

↓ *(Three branches from this step:)*

**Branch A — Success (Emerald green card):**
**9a. Encryption Complete**
Icon: Checkmark in circle
Subtitle: "All files encrypted successfully"
Sub-items: "Recovery phrase saved • Metadata file created • Originals optionally removed"

**Branch B — Partial Success (Amber card):**
**9b. Completed With Warnings**
Icon: Warning triangle
Subtitle: "Some files could not be encrypted"
Sub-items: "View failed files • Successfully encrypted files are saved"

**Branch C — Cancelled (Gray card):**
**9c. Operation Cancelled**
Icon: X in circle
Subtitle: "Encryption stopped by user — partial results cleaned up"

---

**Secondary Features (shown as a separate row of smaller cards below the main flow):**

| Settings | System Logs | About | Updates |
|---|---|---|---|
| Theme (Light/Dark/System) | View timestamped logs | App info & credits | Check for updates |
| Default preferences | Filter by severity | Version & license | Current vs latest |
| | Open logs folder | Author & publisher | |

---

**Footer Text:**
"Bedrock Vault v1.0.0 — Secure File Encryption for Windows"
"By Cloudburst Lab"

---

**Additional Visual Requirements:**
- Each main step card should be approximately the same width (around 400px equivalent at diagram scale)
- Arrows should be smooth, slightly curved, with small arrowheads
- Use indigo for all primary action arrows
- Use emerald green for success branch arrows
- Use amber for warning branch arrows
- Use gray for cancel branch arrows
- All icons should be in a consistent line-art style (not filled)
- The overall diagram should fit comfortably in a 16:9 aspect ratio
- No code snippets, no variable names, no function names
- No technical jargon — all labels should be understandable by non-technical users
- The word "AES" or "ChaCha" should NOT appear — instead use "Encryption Level 1/2/3"
- Do not show any internal process names, thread pools, or IPC channels

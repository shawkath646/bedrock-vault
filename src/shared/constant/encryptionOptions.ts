import type { EncryptionOptions } from "@shared/types/fileEncryption";

export const defaultOptions: EncryptionOptions = {
    encryptionLevel: 3,
    addToCloudSync: true,
    addTrap: false,
    encryptFileNameAndDirectory: true,
    fileOutputDirectory: "",
    backupKeyDirectory: "",
    backupKeyFileDirectory: ""
}

export const encryptionLevels = [
    {
        id: "enc-lvl-1",
        label: "Level 1",
        value: 1,
        desc: "Standard encryption using a password and a generated backup key.",
        tooltipMsg: "Store your password and backup key in a secure location. Anyone who possesses both the encrypted file and these credentials can access your data."
    },
    {
        id: "enc-lvl-2",
        label: "Level 2",
        value: 2,
        desc: "Hardware-bound encryption requiring both a password and the current device, along with a backup key.",
        tooltipMsg: "Files are locked to this specific device. If you switch devices or experience a hardware failure, the backup key will be strictly required to recover your data."
    },
    {
        id: "enc-lvl-3",
        label: "Level 3",
        value: 3,
        desc: "Strict hardware-bound encryption. Generates a primary file key and a supportive key for secure recovery.",
        tooltipMsg: "Maximum security. Decryption on another device is impossible with just a password. Both the primary file key and supportive key are required for recovery if the original hardware is lost."
    }
];

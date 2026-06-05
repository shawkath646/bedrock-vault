import type { EncryptionOptions } from "@shared/types/fileEncryption";

export const defaultOptions: EncryptionOptions = {
    encryptionLevel: 3,
    addToCloudSync: true,
    addTrap: false,
    cleanupAfterEncryption: false,
    encryptFileNameAndDirectory: true,
    fileOutputDirectory: "",
    recoveryPhrasePath: "",
    recoveryPhraseFilePath: "",
    addToRecordTable: true
}

export const encryptionLevels = [
    {
        id: "enc-lvl-1",
        label: "Level 1",
        value: 1,
        desc: "Standard encryption using a password and a generated Recovery Phrase.",
        tooltipMsg: "Store your password and Recovery Phrase in a secure location. Anyone who possesses both the encrypted file and these credentials can access your data."
    },
    {
        id: "enc-lvl-2",
        label: "Level 2",
        value: 2,
        desc: "Hardware-bound encryption requiring both a password and the current device, along with a Recovery Phrase.",
        tooltipMsg: "Files are locked to this specific device. If you switch devices or experience a hardware failure, the Recovery Phrase will be strictly required to recover your data."
    },
    {
        id: "enc-lvl-3",
        label: "Level 3",
        value: 3,
        desc: "Strict hardware-bound encryption. Generates a Recovery Phrase and a supportive keyfile for secure recovery.",
        tooltipMsg: "Maximum security. Decryption on another device is impossible with just a password. Both the Recovery Phrase and supportive keyfile are required for recovery if the original hardware is lost."
    }
];

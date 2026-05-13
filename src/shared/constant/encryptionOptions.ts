import type { EncryptionOptions } from "@shared/types/fileEncryption";

export const defaultOptions: EncryptionOptions = {
    encryptionLayer: 3,
    addToCloudSync: true,
    addTrap: false,
    encryptFileHeader: true,
    encryptFileNameAndDirectory: true,
    fileOutputDirectory: "",
    keySaveDirectory: "",
}

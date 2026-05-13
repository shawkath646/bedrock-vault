export interface EncryptionOptions {
    encryptionLayer: 1 | 2 | 3;
    oldKeyDirectory?: string;
    keySaveDirectory: string;
    fileOutputDirectory: string;
    encryptFileHeader: boolean;
    encryptFileNameAndDirectory: boolean;
    addToCloudSync: boolean;
    addTrap: boolean;
    backupKeyDirectory?: string;
    backupFileKeyDirectory?: string;
}

export interface EncryptionProgress {
    id: string;
    fileName: string;
    thumbnail: string;
    progress: number;
    size: number;
}
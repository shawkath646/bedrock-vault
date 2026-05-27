export interface EncryptionOptions {
    encryptionLevel: 1 | 2 | 3;

    fileOutputDirectory: string;
    backupKeyDirectory?: string;
    backupKeyFileDirectory?: string;

    encryptFileNameAndDirectory: boolean;
    addToCloudSync: boolean;
    addTrap: boolean;
}

export interface EncryptionProgress {
    fileName: string;
    progress: number;
    size: number;
    actualPath: string;
    ext: string;
    status: 'pending' | 'encrypting' | 'completed' | 'failed';
}

export interface EncryptionStage {
    type: "COMPLETED" | "CONTINUE" | "WARNING" | "FAILED" | "ABORT";
    message: string;
    progress: number;
}
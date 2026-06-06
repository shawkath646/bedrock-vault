import type { EncryptionLevel } from "./global";

export interface FileKeyEntry {
    name: string;
    encName: string;
    virtualPath: string;
    key: Buffer;
    iv: Buffer;
    enc_algorithm: string;
    size: number;
    ext: string;
}

export interface EncryptionOptions {
    encryptionLevel: EncryptionLevel;

    fileOutputDirectory: string;
    recoveryPhrasePath: string;
    recoveryPhraseFilePath?: string;

    encryptFileNameAndDirectory: boolean;
    addToCloudSync: boolean;
    addTrap: boolean;
    cleanupAfterEncryption: boolean;
    addToRecordTable: boolean;
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




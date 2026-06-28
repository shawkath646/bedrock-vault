import type { EncryptionLevel } from "./global";

export interface EncryptionRecord {
    chunkName: string;
    path: string;
    timestamp: string;
    encryptionLevel: number;
    isAvailable?: boolean;
}

export interface DecryptedFileEntry {
    name: string;
    encName?: string;
    virtualPath: string;
    size: number;
    ext: string;
    isAvailable: boolean;
    isDir: boolean;
}

export type DecryptMetadataResult = 
  | { success: true; chunkName: string; level: EncryptionLevel; }
  | { success: false; error: string; level?: number };
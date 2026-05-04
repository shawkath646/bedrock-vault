// export const encryptionMethod = [
//     {
//         name: "AES-256",
//         value: "aes"
//     },
//     {
//         name: "RSA-4096",
//         value: "rsa"
//     },
//     {
//         name: "ChaCha20",
//         value: "chacha"
//     }
// ];

// export interface EncryptOptions {
//     encryptionMethod: string;
//     encryptHeader: boolean;
//     showThumbnail: boolean;
//     instantBackup: boolean;
//     enableTrap: boolean;
//     outputDir: string;
// }

export interface FileSelectionOptions {
    newChunk: boolean;
    chunkName: string;
    includeSubFolders: boolean;
    maxSize: number;
    documents: boolean;
    audio: boolean;
    video: boolean;
    pictures: boolean;
    programs: boolean;
    others: boolean;
}

export const defaultOptions: FileSelectionOptions = {
    newChunk: true,
    chunkName: "",
    includeSubFolders: true,
    maxSize: 0,
    audio: true,
    documents: true,
    others: true,
    pictures: true,
    programs: true,
    video: true
}

// export const defaultOptions: EncryptOptions = {
//     encryptionMethod: encryptionMethod[0].value,
//     encryptHeader: true,
//     showThumbnail: false,
//     instantBackup: true,
//     enableTrap: false,
//     outputDir: "C:\\vault\\"
// }
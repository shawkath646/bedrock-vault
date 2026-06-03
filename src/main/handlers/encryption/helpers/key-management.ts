import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileKeyEntry } from '@shared/types/fileEncryption';
import { generateMnemonic, mnemonicToKey } from "../../../utils/mnemonic";
import { tpmEncrypt } from "../../../utils/tpm-communication";
import logger from "../../../utils/logger";

const ENC_ALGORITHM = "aes-256-gcm";

interface MetadataHandler {
    chunkName: string;
    fileMetadata: FileKeyEntry[];
}

interface EncryptedDataRaw {
    iv: Buffer;
    authTag: Buffer;
    encryptedData: Buffer;
}

/**
 * Binary serialization protocol for metadata to avoid converting raw keys into V8 string objects
 * which linger permanently in memory.
 */
export function serializeMetadata(metadata: MetadataHandler): Buffer {
    const buffers: Buffer[] = [];
    
    const writeString = (str: string) => {
        const strBuf = Buffer.from(str, 'utf8');
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(strBuf.length, 0);
        buffers.push(lenBuf, strBuf);
    };

    // 1. Write chunkName
    writeString(metadata.chunkName);

    // 2. Write count of fileMetadata entries
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32BE(metadata.fileMetadata.length, 0);
    buffers.push(countBuf);

    // 3. Write each file entry
    for (const entry of metadata.fileMetadata) {
        writeString(entry.name);
        writeString(entry.encName);
        writeString(entry.virtualPath);
        
        // Write key (32 bytes)
        const keyCopy = Buffer.alloc(32);
        entry.key.copy(keyCopy);
        buffers.push(keyCopy);
        
        // Write iv (12 bytes)
        const ivCopy = Buffer.alloc(12);
        entry.iv.copy(ivCopy);
        buffers.push(ivCopy);
        
        writeString(entry.enc_algorithm);
        
        // Write size (8 bytes BigInt)
        const sizeBuf = Buffer.alloc(8);
        sizeBuf.writeBigInt64BE(BigInt(entry.size), 0);
        buffers.push(sizeBuf);
        
        writeString(entry.ext);
        writeString(entry.thumbnail);
    }

    return Buffer.concat(buffers);
}

/**
 * Matching binary deserialization protocol for complete structural integrity and future decryption support.
 */
export function deserializeMetadata(buffer: Buffer): MetadataHandler {
    let offset = 0;

    const readString = (): string => {
        if (offset + 4 > buffer.length) throw new Error("Malformed metadata: string length out of bounds");
        const len = buffer.readUInt32BE(offset);
        offset += 4;
        if (offset + len > buffer.length) throw new Error("Malformed metadata: string content out of bounds");
        const str = buffer.toString('utf8', offset, offset + len);
        offset += len;
        return str;
    };

    const chunkName = readString();
    
    if (offset + 4 > buffer.length) throw new Error("Malformed metadata: count out of bounds");
    const count = buffer.readUInt32BE(offset);
    offset += 4;

    const fileMetadata: FileKeyEntry[] = [];

    for (let i = 0; i < count; i++) {
        const name = readString();
        const encName = readString();
        const virtualPath = readString();

        if (offset + 32 > buffer.length) throw new Error("Malformed metadata: key out of bounds");
        const key = Buffer.alloc(32);
        buffer.copy(key, 0, offset, offset + 32);
        offset += 32;

        if (offset + 12 > buffer.length) throw new Error("Malformed metadata: iv out of bounds");
        const iv = Buffer.alloc(12);
        buffer.copy(iv, 0, offset, offset + 12);
        offset += 12;

        const enc_algorithm = readString();

        if (offset + 8 > buffer.length) throw new Error("Malformed metadata: size out of bounds");
        const size = Number(buffer.readBigInt64BE(offset));
        offset += 8;

        const ext = readString();
        const thumbnail = readString();

        fileMetadata.push({
            name,
            encName,
            virtualPath,
            key,
            iv,
            enc_algorithm,
            size,
            ext,
            thumbnail
        });
    }

    return { chunkName, fileMetadata };
}

/**
 * Helper function returning pure Buffers instead of Base64 strings.
 */
function encryptDataRaw(data: Buffer, key: Buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENC_ALGORITHM, key, iv);

    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { iv, authTag, encryptedData };
}

export interface OutputPath {
    recoveryPhrasePath: string;
    recoveryPhraseFilePath?: string;
    metadataPath: string;
}

export async function level1Enc(props: MetadataHandler, password: Buffer, outputPath: OutputPath) {
    const parsedMetadata = serializeMetadata(props);
    const dek = crypto.randomBytes(32);
    const salt = crypto.randomBytes(16);
    const passwordKey = crypto.scryptSync(password, salt, 32);

    // Generate highly secure 12-word Recovery Phrase
    const recoveryPhrase = generateMnemonic();
    // Derive symmetric cryptographic recovery key from Recovery Phrase
    const recoveryPhraseKey = mnemonicToKey(recoveryPhrase);

    let passWrap: EncryptedDataRaw | null = null;
    let backupWrap: EncryptedDataRaw | null = null;
    let metadataEnc: EncryptedDataRaw | null = null;

    try {
        metadataEnc = encryptDataRaw(parsedMetadata, dek);
        passWrap = encryptDataRaw(dek, passwordKey);
        backupWrap = encryptDataRaw(dek, recoveryPhraseKey);

        const magicBytes = Buffer.from("BEV1", "utf8"); // Exactly 4 bytes alignment

        const finalBinaryPayload = Buffer.concat([
            magicBytes,                 // 4 bytes
            salt,                       // 16 bytes
            passWrap.iv,                // 12 bytes
            passWrap.authTag,           // 16 bytes
            passWrap.encryptedData,     // 32 bytes
            backupWrap.iv,              // 12 bytes
            backupWrap.authTag,         // 16 bytes
            backupWrap.encryptedData,   // 32 bytes
            metadataEnc.iv,             // 12 bytes
            metadataEnc.authTag,        // 16 bytes
            metadataEnc.encryptedData   // Variable length
        ]);

        await fs.mkdir(path.dirname(outputPath.metadataPath), { recursive: true });
        await fs.writeFile(outputPath.metadataPath, finalBinaryPayload);

        // Save Recovery Phrase as clean human-readable list of words instead of raw obfuscated key
        const recoveryPhraseFileContent = `Bedrock Vault - Recovery Phrase\n\n` +
            `Keep this file highly secure and private. These 12 words allow you to recover your encrypted data if you lose your password.\n\n` +
            `Mnemonic Phrase:\n${recoveryPhrase}\n`;

        await fs.mkdir(path.dirname(outputPath.recoveryPhrasePath), { recursive: true });
        await fs.writeFile(outputPath.recoveryPhrasePath, recoveryPhraseFileContent, "utf8");

        await logger.info("KeyManagement", `Level 1 encryption completed. Metadata size: ${finalBinaryPayload.length} bytes.`);
    } finally {
        // Securely scrub key materials immediately upon completion/error
        parsedMetadata.fill(0);
        dek.fill(0);
        passwordKey.fill(0);
        recoveryPhraseKey.fill(0);
        if (passWrap) {
            passWrap.iv.fill(0);
            passWrap.authTag.fill(0);
            passWrap.encryptedData.fill(0);
        }
        if (backupWrap) {
            backupWrap.iv.fill(0);
            backupWrap.authTag.fill(0);
            backupWrap.encryptedData.fill(0);
        }
        if (metadataEnc) {
            metadataEnc.iv.fill(0);
            metadataEnc.authTag.fill(0);
            metadataEnc.encryptedData.fill(0);
        }
    }
}

export async function level2Enc(props: MetadataHandler, password: Buffer, outputPath: OutputPath) {
    const parsedMetadata = serializeMetadata(props);
    const dek = crypto.randomBytes(32);
    const salt = crypto.randomBytes(16);
    const passwordKey = crypto.scryptSync(password, salt, 32);

    const recoveryPhrase = generateMnemonic();
    const recoveryPhraseKey = mnemonicToKey(recoveryPhrase);

    let tpmWrappedDek: Buffer | null = null;
    let passWrap: EncryptedDataRaw | null = null;
    let backupWrap: EncryptedDataRaw | null = null;
    let metadataEnc: EncryptedDataRaw | null = null;

    try {
        metadataEnc = encryptDataRaw(parsedMetadata, dek);
        tpmWrappedDek = tpmEncrypt(dek);
        passWrap = encryptDataRaw(tpmWrappedDek!, passwordKey);
        backupWrap = encryptDataRaw(dek, recoveryPhraseKey);

        const magicBytes = Buffer.from("BVK2", "utf8"); // 4 bytes

        const finalBinaryPayload = Buffer.concat([
            magicBytes,                 // 4 bytes
            salt,                       // 16 bytes
            passWrap.iv,                // 12 bytes
            passWrap.authTag,           // 16 bytes
            passWrap.encryptedData,     // 256 bytes
            backupWrap.iv,              // 12 bytes
            backupWrap.authTag,         // 16 bytes
            backupWrap.encryptedData,   // 32 bytes
            metadataEnc.iv,             // 12 bytes
            metadataEnc.authTag,        // 16 bytes
            metadataEnc.encryptedData   // Variable length
        ]);

        await fs.mkdir(path.dirname(outputPath.metadataPath), { recursive: true });
        await fs.writeFile(outputPath.metadataPath, finalBinaryPayload);

        // Save Recovery Phrase as clean human-readable list of words instead of raw obfuscated key
        const recoveryPhraseFileContent = `Bedrock Vault - Recovery Phrase\n\n` +
            `Keep this file highly secure and private. These 12 words allow you to recover your encrypted data if you lose your password.\n\n` +
            `Mnemonic Phrase:\n${recoveryPhrase}\n`;

        await fs.mkdir(path.dirname(outputPath.recoveryPhrasePath), { recursive: true });
        await fs.writeFile(outputPath.recoveryPhrasePath, recoveryPhraseFileContent, "utf8");

        await logger.info("KeyManagement", `Level 2 encryption completed with TPM. Metadata size: ${finalBinaryPayload.length} bytes.`);
    } finally {
        // Securely scrub key materials immediately upon completion/error
        parsedMetadata.fill(0);
        dek.fill(0);
        passwordKey.fill(0);
        recoveryPhraseKey.fill(0);
        if (tpmWrappedDek) tpmWrappedDek.fill(0);
        if (passWrap) {
            passWrap.iv.fill(0);
            passWrap.authTag.fill(0);
            passWrap.encryptedData.fill(0);
        }
        if (backupWrap) {
            backupWrap.iv.fill(0);
            backupWrap.authTag.fill(0);
            backupWrap.encryptedData.fill(0);
        }
        if (metadataEnc) {
            metadataEnc.iv.fill(0);
            metadataEnc.authTag.fill(0);
            metadataEnc.encryptedData.fill(0);
        }
    }
}

export async function level3Enc(props: MetadataHandler, password: Buffer, outputPath: OutputPath) {
    const parsedMetadata = serializeMetadata(props);
    const dek = crypto.randomBytes(32);
    const salt = crypto.randomBytes(16);
    const passwordKey = crypto.scryptSync(password, salt, 32);

    const recoveryPhrase = generateMnemonic();
    const recoveryPhraseKey = mnemonicToKey(recoveryPhrase);

    let tpmWrappedDek: Buffer | null = null;
    let passWrap: EncryptedDataRaw | null = null;
    let backupWrap: EncryptedDataRaw | null = null;
    let metadataEnc: EncryptedDataRaw | null = null;
    let keyFilePayload: Buffer | null = null;
    let keyFileContent: Buffer | null = null;
    let combinedKey: Buffer | null = null;

    try {
        metadataEnc = encryptDataRaw(parsedMetadata, dek);
        tpmWrappedDek = tpmEncrypt(dek);
        passWrap = encryptDataRaw(tpmWrappedDek!, passwordKey);

        const keyFileHeader = Buffer.from("BVK3_KEYFILE", "utf8");
        keyFilePayload = crypto.randomBytes(64);
        keyFileContent = Buffer.concat([keyFileHeader, keyFilePayload]);

        combinedKey = crypto.createHmac("sha256", recoveryPhraseKey)
            .update(keyFilePayload)
            .digest();

        backupWrap = encryptDataRaw(dek, combinedKey);

        const magicBytes = Buffer.from("BVK3", "utf8"); // 4 bytes

        const finalBinaryPayload = Buffer.concat([
            magicBytes,                 // 4 bytes
            salt,                       // 16 bytes
            passWrap.iv,                // 12 bytes
            passWrap.authTag,           // 16 bytes
            passWrap.encryptedData,     // 256 bytes
            backupWrap.iv,              // 12 bytes
            backupWrap.authTag,         // 16 bytes
            backupWrap.encryptedData,   // 32 bytes
            metadataEnc.iv,             // 12 bytes
            metadataEnc.authTag,        // 16 bytes
            metadataEnc.encryptedData   // Variable length
        ]);

        await fs.mkdir(path.dirname(outputPath.metadataPath), { recursive: true });
        await fs.writeFile(outputPath.metadataPath, finalBinaryPayload);

        // Save Recovery Phrase as clean human-readable list of words instead of raw obfuscated key
        const recoveryPhraseFileContent = `Bedrock Vault - Recovery Phrase\n\n` +
            `Keep this file highly secure and private. These 12 words allow you to recover your encrypted data if you lose your password.\n\n` +
            `Mnemonic Phrase:\n${recoveryPhrase}\n`;

        await fs.mkdir(path.dirname(outputPath.recoveryPhrasePath), { recursive: true });
        await fs.writeFile(outputPath.recoveryPhrasePath, recoveryPhraseFileContent, "utf8");

        const recoveryPhraseFilePath = outputPath.recoveryPhraseFilePath ?? outputPath.recoveryPhrasePath;
        await fs.mkdir(path.dirname(recoveryPhraseFilePath), { recursive: true });
        await fs.writeFile(recoveryPhraseFilePath, keyFileContent);

        await logger.info("KeyManagement", `Level 3 encryption completed with TPM and Keyfile. Metadata size: ${finalBinaryPayload.length} bytes.`);
    } finally {
        // Securely scrub key materials immediately upon completion/error
        parsedMetadata.fill(0);
        dek.fill(0);
        passwordKey.fill(0);
        recoveryPhraseKey.fill(0);
        if (tpmWrappedDek) tpmWrappedDek.fill(0);
        if (keyFilePayload) keyFilePayload.fill(0);
        if (keyFileContent) keyFileContent.fill(0);
        if (combinedKey) combinedKey.fill(0);
        if (passWrap) {
            passWrap.iv.fill(0);
            passWrap.authTag.fill(0);
            passWrap.encryptedData.fill(0);
        }
        if (backupWrap) {
            backupWrap.iv.fill(0);
            backupWrap.authTag.fill(0);
            backupWrap.encryptedData.fill(0);
        }
        if (metadataEnc) {
            metadataEnc.iv.fill(0);
            metadataEnc.authTag.fill(0);
            metadataEnc.encryptedData.fill(0);
        }
    }
}
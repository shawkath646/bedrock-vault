import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

async function resolveEncryptionKey(existingKeyPath?: string): Promise<Buffer> {
    if (!existingKeyPath) {
        return crypto.randomBytes(32);
    }

    try {
        const keyString = await fs.readFile(existingKeyPath, 'utf-8');
        const parsedKey = Buffer.from(keyString.trim(), 'hex');

        if (parsedKey.length !== 32) {
            throw new Error('Invalid key length. AES-256 requires a 32-byte key.');
        }

        return parsedKey;
    } catch (error) {
        throw new Error(
            `Failed to read selected key: ${error instanceof Error ? error.message : 'Unknown key read error.'}`,
            { cause: error },
        );
    }
}

export async function executeFileEncryption(
    sourceFilePath: string,
    encryptedOutputPath: string,
    existingKeyPath?: string,
): Promise<string> {
    const encryptionKey = await resolveEncryptionKey(existingKeyPath);

    const initializationVector = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, initializationVector);

    const readStream = createReadStream(sourceFilePath);
    const writeStream = createWriteStream(encryptedOutputPath);
    writeStream.write(initializationVector);

    try {
        await pipeline(readStream, cipher, writeStream);
    } catch (error) {
        throw new Error(
            `Encryption pipeline failed: ${error instanceof Error ? error.message : 'Unknown pipeline error.'}`,
            { cause: error },
        );
    }

    return encryptionKey.toString('base64');
}
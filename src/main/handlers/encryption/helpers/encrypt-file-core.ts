import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export const ENC_ALGORITHM = 'aes-256-gcm';

export interface EncryptFileParams {
    sourceFilePath: string;
    encryptedOutputPath: string;
    rawKeyHex: string;
    onProgress: (percent: number) => void;
    signal?: AbortSignal;
}

export interface EncryptFileResult {
    ivHex: string;
    authTagHex: string;
}

export async function encryptFileStream(params: EncryptFileParams): Promise<EncryptFileResult> {
    const { sourceFilePath, encryptedOutputPath, rawKeyHex, onProgress, signal } = params;

    const encryptionKey = Buffer.from(rawKeyHex, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENC_ALGORITHM, encryptionKey, iv);

    const { size: totalBytes } = await fs.stat(sourceFilePath);
    const readStream = createReadStream(sourceFilePath);
    const writeStream = createWriteStream(encryptedOutputPath);
    writeStream.write(iv);

    let processedBytes = 0;
    let lastPercent = -1;

    const tracker = new Transform({
        transform(chunk, _encoding, callback) {
            processedBytes += chunk.length;
            const percent = totalBytes > 0
                ? Math.min(99, Math.floor((processedBytes / totalBytes) * 100))
                : 0;
            if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress(percent);
            }
            callback(null, chunk);
        },
    });

    let authTag: Buffer;

    try {
        await pipeline(readStream, tracker, cipher, writeStream, { signal, end: false });
        authTag = cipher.getAuthTag();
        writeStream.write(authTag);
        writeStream.end();
        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    } catch (error: unknown) {
        writeStream.destroy();
        if (signal?.aborted || (error as { name?: string }).name === 'AbortError') {
            throw new Error('USER_ABORTED', { cause: error });
        }
        throw error;
    }

    onProgress(100);
    return { ivHex: iv.toString('hex'), authTagHex: authTag.toString('hex') };
}

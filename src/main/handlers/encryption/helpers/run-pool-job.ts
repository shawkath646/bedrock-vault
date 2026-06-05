import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { MessagePort } from 'node:worker_threads';
import { ENC_ALGORITHM } from '@main/constant/crypto.constants.ts';

interface WorkerInput {
  sourceFilePath: string;
  encryptedOutputPath: string;
  rawKeyHex: string;
  port: MessagePort;
}

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

export default async function runPoolJob({
  sourceFilePath,
  encryptedOutputPath,
  rawKeyHex,
  port,
}: WorkerInput): Promise<{ ivHex: string; authTagHex: string }> {
  const result = await encryptFileStream({
    sourceFilePath,
    encryptedOutputPath,
    rawKeyHex,
    onProgress: (percent) => port.postMessage({ type: 'progress', percent }),
  });

  port.close();
  return result;
}

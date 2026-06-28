import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { MessageChannel } from 'node:worker_threads';
import * as os from 'node:os';
import path from 'node:path';
import Piscina from 'piscina';
import { getAppAssetPath } from '@main/utils/path.utils';
import type LoggerService from '@main/utils/logger';
import type { SelectedFile, LockableFile } from '@shared/types/file-selection';
import type { EncryptionProgress, FileKeyEntry, EncryptionOptions } from '@shared/types/file-encryption';

import { ENC_ALGORITHM } from '@main/constant/crypto.constants';
import { INLINE_THRESHOLD_BYTES } from '@main/constant/file.constants';
import type { RunOptions } from 'node:test';

export async function acquireAndValidateFiles(
  files: SelectedFile[],
): Promise<{ lockedFiles: LockableFile[]; skippedCount: number; totalSize: number }> {
  const lockedFiles: LockableFile[] = [];
  let skippedCount = 0;
  let totalSize = 0;

  if (!files || !Array.isArray(files)) return { lockedFiles, skippedCount, totalSize };

  const CHUNK = 50;
  for (let i = 0; i < files.length; i += CHUNK) {
    await Promise.all(
      files.slice(i, i + CHUNK).map(async (file) => {
        try {
          if (!file?.actualPath) throw new Error('Invalid file path');
          const stat = await fs.stat(file.actualPath);
          if (!stat.isFile()) throw new Error('Target is not a file');
          lockedFiles.push({ ...file, release: async () => { } });
          totalSize += file.size || stat.size;
        } catch (err) {
          console.error(`Skipped ${file.actualPath}:`, err);
          skippedCount += 1;
        }
      }),
    );
  }

  return { lockedFiles, skippedCount, totalSize };
}



// --- Single & Batch Encryption Core Helpers ---

interface EncryptionJobParams {
  sourceFilePath: string;
  encryptedOutputPath: string;
  rawKeyHex: string;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

interface EncryptionJobResult {
  iv: Buffer;
  authTag: Buffer;
}

interface EncryptFilesParams {
  files: LockableFile[];
  outputDirectory: string;
  progressMap: Map<string, EncryptionProgress>;
  journal: EncryptionChangeJournal;
  signal: AbortSignal;
  emitFileProgress: (map: Map<string, EncryptionProgress>, immediate?: boolean) => void;
  encryptionOptions: EncryptionOptions;
  logger: LoggerService;
}

export async function encryptFiles(params: EncryptFilesParams): Promise<FileKeyEntry[]> {
  const { files, outputDirectory, progressMap, journal, signal, emitFileProgress, encryptionOptions, logger } = params;

  const smallFiles: LockableFile[] = [];
  const largeFiles: LockableFile[] = [];
  for (const file of files) {
    (file.size <= INLINE_THRESHOLD_BYTES ? smallFiles : largeFiles).push(file);
  }

  const cpuConcurrency = Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)));
  let pool: Piscina | null = null;

  if (largeFiles.length > 0) {
    const { default: Piscina } = await import('piscina');
    pool = new Piscina({
      filename: getAppAssetPath('worker'),
      maxThreads: cpuConcurrency,
      idleTimeout: Infinity,
    });
  }

  const updateProgress = (filePath: string, patch: Partial<EncryptionProgress>) => {
    progressMap.set(filePath, { ...progressMap.get(filePath)!, ...patch });
    emitFileProgress(progressMap);
  };

  const createTask = (file: LockableFile) => async (): Promise<FileKeyEntry> => {
    if (signal.aborted) throw new Error('USER_ABORTED');

    let release: (() => Promise<void>) | undefined;
    try {
      const { lock } = await import('proper-lockfile');
      release = await lock(file.actualPath);
    } catch (err) {
      updateProgress(file.actualPath, { status: 'failed' });
      void logger.error('EncryptionTask', `Lock failed for ${file.actualPath}: ${err}`);
      throw err;
    }

    const key = crypto.randomBytes(32);
    const encName = encryptionOptions.encryptFileNameAndDirectory
      ? crypto.randomUUID()
      : file.name;
    const encryptedOutputPath = path.join(outputDirectory, encName);

    updateProgress(file.actualPath, { status: 'encrypting' });

    const jobParams: EncryptionJobParams = {
      sourceFilePath: file.actualPath,
      encryptedOutputPath,
      rawKeyHex: key.toString('hex'),
      onProgress: (percent) => updateProgress(file.actualPath, { progress: percent }),
      signal,
    };

    try {
      journal.recordCreated(encryptedOutputPath);
      const result = file.size <= INLINE_THRESHOLD_BYTES
        ? await inlineEncrypt(jobParams)
        : await poolEncrypt(pool!, jobParams);

      updateProgress(file.actualPath, { progress: 100, status: 'completed' });

      return {
        name: file.name,
        encName,
        virtualPath: file.path,
        key,
        iv: result.iv,
        enc_algorithm: ENC_ALGORITHM,
        size: file.size,
        ext: file.ext,
      };
    } catch (err) {
      key.fill(0);
      updateProgress(file.actualPath, { status: 'failed' });
      void logger.error('EncryptionTask', `Failed to encrypt ${file.actualPath}: ${err instanceof Error ? err.stack : err}`);
      throw err;
    } finally {
      await release?.();
    }
  };

  try {
    const [largeResults, smallResults] = await Promise.all([
      runWithConcurrencyLimit(largeFiles.map(createTask), cpuConcurrency),
      runWithConcurrencyLimit(smallFiles.map(createTask), 20),
    ]);
    emitFileProgress(progressMap, true);
    return [...largeResults, ...smallResults];
  } finally {
    await pool?.destroy();
  }
}

export async function inlineEncrypt(params: EncryptionJobParams): Promise<EncryptionJobResult> {
  const { sourceFilePath, encryptedOutputPath, rawKeyHex, onProgress, signal } = params;
  if (signal.aborted) throw new Error('USER_ABORTED');

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
    if ((error as { name?: string }).name === 'AbortError' || signal.aborted) {
      throw new Error('USER_ABORTED', { cause: error });
    }
    throw error;
  }

  onProgress(100);
  return { iv, authTag };
}

export async function poolEncrypt(pool: Piscina, params: EncryptionJobParams): Promise<EncryptionJobResult> {
  const { sourceFilePath, encryptedOutputPath, rawKeyHex, onProgress, signal } = params;
  const { port1, port2 } = new MessageChannel();

  port1.on('message', (msg: { type: 'progress'; percent: number }) => {
    if (msg.type === 'progress') onProgress(msg.percent);
  });

  try {
    const { ivHex, authTagHex } = await pool.run(
      {
        sourceFilePath,
        encryptedOutputPath,
        rawKeyHex,
        port: port2,
      },
      {
        signal,
        transferList: [port2],
      } as RunOptions,
    );
    return { iv: Buffer.from(ivHex, 'hex'), authTag: Buffer.from(authTagHex, 'hex') };
  } finally {
    port1.close();
  }
}

export async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results: T[] = [];
  let nextIndex = 0;

  async function drain(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        results[index] = await tasks[index]();
      } catch (err) {
        /* failed tasks are excluded from results */
        console.error(`Task failed at index ${index}:`, err);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, drain));
  return results.filter(Boolean);
}

// --- Rollback Change Journal Class ---
export class EncryptionChangeJournal {
  private readonly created: string[] = [];

  recordCreated(filePath: string): void {
    this.created.push(filePath);
  }

  async rollback(): Promise<void> {
    const tasks = this.created.map(p => async () => {
      try { await fs.rm(p, { force: true }); } catch { /* empty */ }
    });
    await runWithConcurrencyLimit(tasks, 50);
    this.created.length = 0;
  }
}

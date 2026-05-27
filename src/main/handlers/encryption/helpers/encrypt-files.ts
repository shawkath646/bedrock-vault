import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { MessageChannel } from 'node:worker_threads';
import Piscina from 'piscina';
import type { EncryptionProgress } from '@shared/types/fileEncryption';
import type { LockableFile } from '@shared/types/fileSelection';
import type { FileKeyEntry } from '../encryption-key-backup';
import type EncryptionChangeJournal from './encryption-change-journal';
import { emitFileProgress } from './encryption-emitter';
import { fetchEncryptionOptions } from '../encryption-options.store';
import { WORKER_PATH } from '@main/utils/paths';

const INLINE_THRESHOLD_BYTES = 512 * 1024;

interface EncryptionJobParams {
    sourceFilePath: string;
    encryptedOutputPath: string;
    rawKeyHex: string;
    onProgress: (percent: number) => void;
    signal: AbortSignal;
}

interface EncryptFilesParams {
    files: LockableFile[];
    outputDirectory: string;
    progressMap: Map<string, EncryptionProgress>;
    journal: EncryptionChangeJournal;
    signal: AbortSignal;
}

export async function encryptFiles(params: EncryptFilesParams): Promise<FileKeyEntry[]> {
    const { files, outputDirectory, progressMap, journal, signal } = params;
    const encryptionOptions = await fetchEncryptionOptions();

    const smallFiles: LockableFile[] = [];
    const largeFiles: LockableFile[] = [];
    for (const file of files) {
        (file.size <= INLINE_THRESHOLD_BYTES ? smallFiles : largeFiles).push(file);
    }

    const cpuConcurrency = Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)));
    let pool: Piscina | null = null;

    if (largeFiles.length > 0) {
        pool = new Piscina({
            filename: WORKER_PATH,
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

        const key = crypto.randomBytes(32);

        const encryptedOutputPath = path.join(
            outputDirectory,
            encryptionOptions.encryptFileNameAndDirectory ? crypto.randomUUID() : file.name,
        );

        updateProgress(file.actualPath, { status: 'encrypting' });

        const jobParams: EncryptionJobParams = {
            sourceFilePath: file.actualPath,
            encryptedOutputPath,
            rawKeyHex: key.toString('hex'),
            onProgress: (percent) => updateProgress(file.actualPath, { progress: percent }),
            signal,
        };

        try {
            const iv = file.size <= INLINE_THRESHOLD_BYTES
                ? await inlineEncrypt(jobParams)
                : await poolEncrypt(pool!, jobParams);

            journal.recordCreated(encryptedOutputPath);
            updateProgress(file.actualPath, { progress: 100, status: 'completed' });

            return { name: file.name, key, iv };
        } catch (err) {
            key.fill(0);
            updateProgress(file.actualPath, { status: 'failed' });
            throw err;
        }
    };

    try {
        const [largeResults, smallResults] = await Promise.all([
            runWithConcurrencyLimit(largeFiles.map(createTask), cpuConcurrency),
            runWithConcurrencyLimit(smallFiles.map(createTask), 50),
        ]);
        return [...largeResults, ...smallResults];
    } finally {
        await pool?.destroy();
    }
}

async function inlineEncrypt(params: EncryptionJobParams): Promise<Buffer> {
    const { sourceFilePath, encryptedOutputPath, rawKeyHex, onProgress, signal } = params;
    if (signal.aborted) throw new Error('USER_ABORTED');

    const encryptionKey = Buffer.from(rawKeyHex, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);

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

    try {
        await pipeline(readStream, tracker, cipher, writeStream, { signal });
    } catch (error: unknown) {
        if ((error as { name?: string }).name === 'AbortError' || signal.aborted) {
            throw new Error('USER_ABORTED', { cause: error });
        }
        throw error;
    }

    onProgress(100);
    return iv;
}

async function poolEncrypt(pool: Piscina, params: EncryptionJobParams): Promise<Buffer> {
    const { sourceFilePath, encryptedOutputPath, rawKeyHex, onProgress, signal } = params;
    const { port1, port2 } = new MessageChannel();

    port1.on('message', (msg: { type: 'progress'; percent: number }) => {
        if (msg.type === 'progress') onProgress(msg.percent);
    });

    try {
        const { ivHex } = await pool.run(
            { sourceFilePath, encryptedOutputPath, rawKeyHex, port: port2 },
            { transferList: [port2], signal },
        ) as { ivHex: string };
        return Buffer.from(ivHex, 'hex');
    } finally {
        port1.close();
    }
}

async function runWithConcurrencyLimit<T>(
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
            } catch {
                /* failed tasks are excluded from results */
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, drain));
    return results.filter(Boolean);
}

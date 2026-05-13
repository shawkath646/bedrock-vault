import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { SelectedFile } from '@shared/types/fileSelection';
import { formatSize } from '@shared/utils/formatSize';
import { askPassword } from '@main/utils/askPassword';
import getDriveInfoFromPath from '@main/utils/getDriveInfoFromPath';
import { fetchAllSelectedItems } from '../file-selection/file-selection.handler';
import { executeFileEncryption } from './encryption-executor';
import { fetchEncryptionOptions } from './encryption-options.store';

export const encryptionStatusEmitter = new EventEmitter();

interface EncryptionProcessStatus {
    abort: boolean;
    failed: boolean;
    message: string;
    progress: number;
}

interface EncryptedFileMetadata {
    name: string;
    decryptionKey: string;
    timestamp: string;
}

interface EncryptionMetadata {
    chunkName: string;
    timestamp: string;
    files: EncryptedFileMetadata[];
}

let currentEncryptionStatus: EncryptionProcessStatus | null = null;

function emitEncryptionStatusUpdate(updates: Partial<EncryptionProcessStatus>): void {
    if (!currentEncryptionStatus) {
        currentEncryptionStatus = { abort: false, failed: false, message: '', progress: 0 };
    }

    currentEncryptionStatus = { ...currentEncryptionStatus, ...updates };
    encryptionStatusEmitter.emit('encryption-status-update', currentEncryptionStatus);
}

export function fetchCurrentEncryptionStatus(): EncryptionProcessStatus | null {
    return currentEncryptionStatus;
}

async function collectValidFiles(files: SelectedFile[]): Promise<{ validFiles: SelectedFile[]; skippedCount: number; totalSize: number }> {
    const validFiles: SelectedFile[] = [];
    let skippedCount = 0;
    let totalSize = 0;

    await Promise.all(files.map(async (file) => {
        try {
            await fs.access(file.actualPath, fs.constants.F_OK);
            validFiles.push(file);
            totalSize += file.size;
        } catch {
            skippedCount += 1;
        }
    }));

    return { validFiles, skippedCount, totalSize };
}

export async function handleStartEncryptionWorkflow(): Promise<void> {
    if (currentEncryptionStatus && !currentEncryptionStatus.failed && !currentEncryptionStatus.abort) {
        emitEncryptionStatusUpdate({
            abort: true,
            failed: true,
            message: 'Encryption is already running!',
        });
        return;
    }

    emitEncryptionStatusUpdate({ abort: false, failed: false, message: 'Preparing...', progress: 0 });

    try {
        const { selectedFiles, selectedOptions } = await fetchAllSelectedItems();
        const encryptionOptions = await fetchEncryptionOptions();

        emitEncryptionStatusUpdate({ message: 'Checking files...' });
        const { validFiles, skippedCount, totalSize } = await collectValidFiles(selectedFiles);

        if (skippedCount > 0) {
            emitEncryptionStatusUpdate({
                abort: false,
                failed: true,
                message: `${skippedCount} ${skippedCount > 1 ? 'files' : 'file'} has been skipped!`,
            });
        }

        if (validFiles.length === 0) {
            emitEncryptionStatusUpdate({ abort: true, failed: true, message: 'No valid files found to encrypt.' });
            currentEncryptionStatus = null;
            return;
        }

        emitEncryptionStatusUpdate({ message: 'Checking storage...' });
        await fs.mkdir(encryptionOptions.fileOutputDirectory, { recursive: true });

        const outputDriveInfo = await getDriveInfoFromPath(encryptionOptions.fileOutputDirectory);
        if (!outputDriveInfo) {
            emitEncryptionStatusUpdate({ abort: true, failed: true, message: 'Failed to read target storage info.' });
            currentEncryptionStatus = null;
            return;
        }

        if (outputDriveInfo.available < totalSize) {
            emitEncryptionStatusUpdate({
                abort: true,
                failed: true,
                message: `Insufficient storage! Minimum ${formatSize(totalSize)} required. Available: ${formatSize(outputDriveInfo.available)}.`,
            });
            currentEncryptionStatus = null;
            return;
        }

        emitEncryptionStatusUpdate({ message: 'Fetching password....' });
        const inputPassword = await askPassword();
        if (!inputPassword) {
            emitEncryptionStatusUpdate({ abort: true, failed: true, message: 'Failed to get password.' });
            currentEncryptionStatus = null;
            return;
        }

        const encryptedFilesMetadata: EncryptedFileMetadata[] = [];
        let processedBytes = 0;

        for (const file of validFiles) {
            emitEncryptionStatusUpdate({ message: `Encrypting: ${file.name}` });

            const outputFilePath = path.join(encryptionOptions.fileOutputDirectory, `${file.name}.enc`);
            const decryptionKey = await executeFileEncryption(file.actualPath, outputFilePath, undefined);

            encryptedFilesMetadata.push({
                name: file.name,
                decryptionKey,
                timestamp: new Date().toISOString(),
            });

            processedBytes += file.size;
            emitEncryptionStatusUpdate({ progress: Math.round((processedBytes / totalSize) * 100) });
        }

        emitEncryptionStatusUpdate({ message: 'Finalizing metadata...' });
        const metadata: EncryptionMetadata = {
            chunkName: selectedOptions.chunkName,
            timestamp: new Date().toISOString(),
            files: encryptedFilesMetadata,
        };

        const metadataPath = path.join(encryptionOptions.fileOutputDirectory, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        emitEncryptionStatusUpdate({ message: 'Encryption completed successfully!', progress: 100 });
    } catch (error) {
        console.error('Encryption process failed:', error);
        emitEncryptionStatusUpdate({
            abort: true,
            failed: true,
            message: 'An unknown error occurred during encryption.',
        });
    } finally {
        setTimeout(() => {
            currentEncryptionStatus = null;
        }, 3000);
    }
}
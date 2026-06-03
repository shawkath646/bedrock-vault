import * as fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, shell } from 'electron';
import type { LockableFile } from '@shared/types/fileSelection';
import type { EncryptionProgress, FileKeyEntry } from '@shared/types/fileEncryption';
import askPassword from '@main/utils/askPassword';
import checkSystemResources from '@main/utils/checkSystemResources';
import { clearSelectedItems, fetchAllSelectedItems } from '../file-selection/file-selection.handler';
import { fetchEncryptionOptions } from './encryption-options.store';
import { acquireAndValidateFiles, releaseAllLocks } from './helpers/acquire-and-validate-files';
import { encryptFiles } from './helpers/encrypt-files';
import EncryptionChangeJournal from './helpers/encryption-change-journal';
import { emitStage, emitFileProgress, clearFileProgressThrottle } from './helpers/encryption-emitter';
import { level1Enc, level2Enc, level3Enc, type OutputPath } from './helpers/key-management';
import logger from '../../utils/logger';



let abortController: AbortController | null = null;
let inProgress = false;
let cachedPassword: Buffer | null = null;

export const abortEncryption = (): void => {
    if (inProgress) abortController?.abort('USER_ABORTED');
};

export async function setEncryptionPassword(): Promise<boolean> {
    if (cachedPassword) {
        cachedPassword.fill(0);
        cachedPassword = null;
    }
    const buffer = await askPassword();
    if (!buffer) return false;
    cachedPassword = buffer;
    return true;
}

export function hasEncryptionPassword(): boolean {
    return cachedPassword !== null;
}

export function getCachedPassword(): Buffer | null {
    return cachedPassword;
}

export function clearCachedPassword(): void {
    if (cachedPassword) {
        cachedPassword.fill(0);
        cachedPassword = null;
    }
}

async function resolveOutputDirectory(baseDir: string): Promise<string | null> {
    try {
        const entries = await fs.readdir(baseDir);
        if (entries.length === 0) return baseDir;
    } catch {
        return baseDir;
    }

    const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Overwrite', 'Create New Folder', 'Cancel'],
        defaultId: 1,
        cancelId: 2,
        title: 'Output Directory Exists',
        message: `The output directory already contains files:\n${baseDir}`,
        detail: 'Choose "Overwrite" to use it as-is, or "Create New Folder" to auto-create a numbered folder.',
    });

    if (response === 2) return null;
    if (response === 0) return baseDir;

    let counter = 1;
    let candidate = `${baseDir} (${counter})`;
    while (true) {
        try {
            await fs.stat(candidate);
            counter++;
            candidate = `${baseDir} (${counter})`;
        } catch {
            return candidate;
        }
    }
}

export async function handleStartEncryptionWorkflow(): Promise<void> {
    if (inProgress) return;
    inProgress = true;

    await logger.info('EncryptionWorkflow', 'Workflow started');

    const journal = new EncryptionChangeJournal();
    abortController = new AbortController();
    const { signal } = abortController;

    let lockedFiles: LockableFile[] = [];
    let fileKeys: FileKeyEntry[] = [];
    let isError = false;

    try {
        emitStage('Preparing', 0);

        const { selectedFiles, selectedOptions } = fetchAllSelectedItems();
        const encryptionOptions = await fetchEncryptionOptions();
        const chunkName = selectedOptions.chunkName || `default-${Math.random().toString(36).substring(2, 7)}`;

        if (!selectedFiles?.length) throw new Error('No files selected.');

        const outputDirectory = await resolveOutputDirectory(encryptionOptions.fileOutputDirectory);
        if (!outputDirectory) throw new Error('USER_ABORTED');

        await logger.info('EncryptionWorkflow', `Output directory resolved: ${outputDirectory}`);

        emitStage('Analyzing files', 2);

        const validated = await acquireAndValidateFiles(selectedFiles);
        lockedFiles = validated.lockedFiles;

        await logger.info('EncryptionWorkflow', `Validated ${lockedFiles.length} files for encryption. Skipped: ${validated.skippedCount}`);

        if (signal.aborted) throw new Error('USER_ABORTED');

        if (validated.skippedCount > 0) {
            const label = validated.skippedCount > 1 ? 'files' : 'file';
            emitStage(`${validated.skippedCount} ${label} skipped.`, 5, 'WARNING');
        }

        if (lockedFiles.length === 0) throw new Error('No valid files found to encrypt.');

        const progressMap = new Map<string, EncryptionProgress>(
            lockedFiles.map(file => [
                file.actualPath,
                {
                    fileName: file.name,
                    actualPath: file.actualPath,
                    progress: 0,
                    size: file.size,
                    ext: file.ext,
                    status: 'pending',
                },
            ]),
        );

        emitFileProgress(progressMap);
        emitStage('Analyzing resources', 8);

        await fs.mkdir(outputDirectory, { recursive: true });

        const resources = await checkSystemResources(outputDirectory, validated.totalSize);
        for (const w of resources.warnings) {
            emitStage(w.message, 8, 'WARNING');
            await logger.warn('EncryptionWorkflow', `Resource check warning: ${w.message}`);
        }
        if (!resources.ok) {
            await logger.error('EncryptionWorkflow', `Resource check failed: ${resources.fatalMessage}`);
            throw new Error(resources.fatalMessage ?? 'Insufficient system resources');
        }
        if (signal.aborted) throw new Error('USER_ABORTED');

        emitStage('Analyzing resources', 8);

        fileKeys = await encryptFiles({
            files: lockedFiles,
            outputDirectory,
            progressMap,
            journal,
            signal,
        });

        if (signal.aborted) throw new Error('USER_ABORTED');

        const failedCount = lockedFiles.length - fileKeys.length;
        await logger.info('EncryptionWorkflow', `File encryption completed. Succeeded: ${fileKeys.length}, Failed: ${failedCount}`);
        if (failedCount > 0) {
            emitStage(`${failedCount} file(s) failed to encrypt`, 90, 'WARNING');
            await logger.warn('EncryptionWorkflow', `${failedCount} file(s) failed to encrypt`);
        }

        emitStage('Finalizing metadata', 95);

        const password = getCachedPassword();
        if (!password) throw new Error('Encryption password has not been set.');
        await logger.info('EncryptionWorkflow', 'Password retrieved from cache');
        if (signal.aborted) throw new Error('USER_ABORTED');

        const outputPath: OutputPath = {
            metadataPath: path.join(outputDirectory, "v"),
            recoveryPhrasePath: encryptionOptions.recoveryPhrasePath,
            recoveryPhraseFilePath: encryptionOptions.recoveryPhraseFilePath
        };

        if (fileKeys.length > 0) {
            await logger.info('EncryptionWorkflow', `Routing to Level ${encryptionOptions.encryptionLevel} metadata encryption`);
            const keyParams = { chunkName, fileMetadata: fileKeys };
            switch (encryptionOptions.encryptionLevel) {
                case 1: await level1Enc(keyParams, password, outputPath); break;
                case 2: await level2Enc(keyParams, password, outputPath); break;
                case 3: await level3Enc(keyParams, password, outputPath); break;
            }
        }

        if (encryptionOptions.cleanupAfterEncryption && fileKeys.length > 0 && failedCount === 0) {
            emitStage('Cleaning up source files', 98);
            const successPaths = fileKeys.map(e => e.virtualPath);
            const toTrash = lockedFiles.filter(f => successPaths.includes(f.path));
            
            await logger.info('EncryptionWorkflow', `Trashing ${toTrash.length} source files for cleanupAfterEncryption`);
            await Promise.allSettled(
                toTrash.map(async f => {
                    try {
                        await f.release();
                    } catch (err) {
                        console.warn('Failed to release lock before trashing:', err);
                        await logger.warn('EncryptionWorkflow', `Failed to release lock on ${f.actualPath}: ${err}`);
                    }
                    await shell.trashItem(f.actualPath);
                }),
            );
            
            lockedFiles = lockedFiles.filter(f => !successPaths.includes(f.path));
        }

        await clearSelectedItems();

        emitStage('Encryption completed', 99);
    } catch (error) {
        isError = true;
        const isAbort = error instanceof Error && error.message === 'USER_ABORTED';
        const message = error instanceof Error
            ? isAbort ? 'Encryption aborted by user.' : error.message
            : 'An unknown error occurred during encryption.';

        if (isAbort) {
            await logger.warn('EncryptionWorkflow', 'Workflow aborted by user');
        } else {
            await logger.error('EncryptionWorkflow', `Workflow failed: ${message}`);
        }

        console.error('Encryption workflow failed:', error);
        await journal.rollback();
        emitStage(message, 100, isAbort ? 'ABORT' : 'FAILED');
    } finally {
        await releaseAllLocks(lockedFiles);

        // Securely scrub key materials immediately upon completion, abort, or failure
        for (const entry of fileKeys) {
            if (entry.key) entry.key.fill(0);
            if (entry.iv) entry.iv.fill(0);
        }

        // Securely clear the password from memory at the end of the encryption process
        clearCachedPassword();

        // Clear the throttled file progress timer
        clearFileProgressThrottle();

        emitStage(
            isError ? 'Operation Aborted!' : 'Operation completed',
            100,
            isError ? 'ABORT' : 'COMPLETED',
        );
        inProgress = false;
        abortController = null;
    }
}
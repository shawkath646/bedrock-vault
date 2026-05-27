
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LockableFile } from '@shared/types/fileSelection';
import type { EncryptionProgress } from '@shared/types/fileEncryption';
import askPassword from '@main/utils/askPassword';
import checkSystemResources from '@main/utils/checkSystemResources';
import { fetchAllSelectedItems } from '../file-selection/file-selection.handler';
import { fetchEncryptionOptions } from './encryption-options.store';
import { acquireAndValidateFiles, releaseAllLocks } from './helpers/acquire-and-validate-files';
import { encryptFiles } from './helpers/encrypt-files';
import EncryptionChangeJournal from './helpers/encryption-change-journal';
import { emitStage, emitFileProgress } from './helpers/encryption-emitter';

let abortController: AbortController | null = null;
let inProgress = false;

export const abortEncryption = (): void => {
    if (inProgress) abortController?.abort('USER_ABORTED');
};

export async function handleStartEncryptionWorkflow(): Promise<void> {
    if (inProgress) return;
    inProgress = true;

    const journal = new EncryptionChangeJournal();
    abortController = new AbortController();
    const { signal } = abortController;

    let lockedFiles: LockableFile[] = [];
    let isError = false;

    try {
        emitStage('Preparing', 0);

        const { selectedFiles, selectedOptions } = fetchAllSelectedItems();
        const encryptionOptions = await fetchEncryptionOptions();
        const outputDirectory = encryptionOptions.fileOutputDirectory;
        const chunkName = selectedOptions.chunkName || 'default';

        if (!selectedFiles?.length) throw new Error('No files selected.');
        if (!outputDirectory) throw new Error('Output directory is not configured');

        emitStage('Analyzing files', 2);

        const validated = await acquireAndValidateFiles(selectedFiles);
        lockedFiles = validated.lockedFiles;

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
        for (const w of resources.warnings) emitStage(w.message, 8, 'WARNING');
        if (!resources.ok) throw new Error(resources.fatalMessage ?? 'Insufficient system resources');
        if (signal.aborted) throw new Error('USER_ABORTED');

        emitStage('Waiting for password', 10);

        const password = await askPassword();
        if (!password) throw new Error('Failed to get password');
        if (signal.aborted) throw new Error('USER_ABORTED');

        emitStage('Encrypting files', 15);

        const backupKeyDirectory = encryptionOptions.backupKeyDirectory || outputDirectory;
        const backupFileKeyDirectory = encryptionOptions.backupKeyFileDirectory || backupKeyDirectory;
        await fs.mkdir(backupKeyDirectory, { recursive: true });
        if (encryptionOptions.encryptionLevel === 3) {
            await fs.mkdir(backupFileKeyDirectory, { recursive: true });
        }

        const fileKeys = await encryptFiles({
            files: lockedFiles,
            outputDirectory,
            progressMap,
            journal,
            signal,
        });

        if (signal.aborted) throw new Error('USER_ABORTED');

        const failedCount = lockedFiles.length - fileKeys.length;
        if (failedCount > 0) {
            emitStage(`${failedCount} file(s) failed to encrypt`, 90, 'WARNING');
        }

        if (fileKeys.length > 0) {
            const backupSummary = await writeBackupKeys({
                password,
                chunkName,
                backupKeyDirectory,
                backupFileKeyDirectory,
                level: encryptionOptions.encryptionLevel,
                fileKeys,
            });

            journal.recordCreated(path.join(backupKeyDirectory, `key_${chunkName}.enc`));
            emitStage(backupSummary, 97, 'CONTINUE');
        }

        for (const entry of fileKeys) {
            entry.key.fill(0);
            entry.iv.fill(0);
        }

        emitStage('Finalizing metadata', 99);
    } catch (error) {
        isError = true;
        const isAbort = error instanceof Error && error.message === 'USER_ABORTED';
        const message = error instanceof Error
            ? isAbort ? 'Encryption aborted by user.' : error.message
            : 'An unknown error occurred during encryption.';

        console.error('Encryption workflow failed:', error);
        await journal.rollback();
        emitStage(message, 100, isAbort ? 'ABORT' : 'FAILED');
    } finally {
        await releaseAllLocks(lockedFiles);

        emitStage(
            isError ? 'Operation Aborted!' : 'Operation completed',
            100,
            isError ? 'ABORT' : 'COMPLETED',
        );
        inProgress = false;
        abortController = null;
    }
}
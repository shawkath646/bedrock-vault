import * as fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type { LockableFile } from '@shared/types/file-selection';
import type { EncryptionProgress, FileKeyEntry } from '@shared/types/file-encryption';

// Utilities & Loggers
import { checkSystemResources } from '@main/utils/misc.utils';
import { resolveOutputDirectory } from '@main/utils/path.utils';
import { saveRecord } from '@main/utils/enc-record';
import logger from '@main/utils/logger';

// Helpers
import {
  isInProgress,
  setInProgress,
  setAbortController,
  getCachedPassword,
  clearCachedPassword
} from './helpers/abort-controller.helper';

import {
  acquireAndValidateFiles,
  releaseAllLocks,
  encryptFiles,
  EncryptionChangeJournal
} from './helpers/file-encryptor.helper';

import {
  emitStage,
  emitFileProgress,
  clearFileProgressThrottle
} from './helpers/encryption-emitter.helper';

import {
  level1Enc,
  level2Enc,
  level3Enc,
  type OutputPath
} from './helpers/metadata-writer.helper';

import { fetchAllSelectedItems, clearSelectedItems } from '../file-selection/file-selection.handler';
import { fetchEncryptionOptions } from './encryption-options.store';

export async function handleStartEncryptionWorkflow(): Promise<void> {
  if (isInProgress()) return;
  setInProgress(true);

  await logger.info('EncryptionWorkflow', 'Workflow started');

  const journal = new EncryptionChangeJournal();
  const ac = new AbortController();
  setAbortController(ac);
  const { signal } = ac;

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
      keyFilePath: encryptionOptions.recoveryPhraseFilePath
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

      const trashResults = await Promise.allSettled(
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

      const failedTrashCount = trashResults.filter(r => r.status === 'rejected').length;
      if (failedTrashCount > 0) {
        emitStage(`${failedTrashCount} source file(s) could not be moved to trash.`, 98, 'WARNING');
        await logger.warn('EncryptionWorkflow', `${failedTrashCount} files failed to trash during cleanup.`);
      }

      lockedFiles = lockedFiles.filter(f => !successPaths.includes(f.path));
    }

    await clearSelectedItems();

    if (encryptionOptions.addToRecordTable) {
      await saveRecord({
        chunkName,
        path: outputDirectory,
        timestamp: new Date().toISOString(),
        encryptionLevel: encryptionOptions.encryptionLevel
      });
    }

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

    for (const entry of fileKeys) {
      if (entry.key) entry.key.fill(0);
      if (entry.iv) entry.iv.fill(0);
    }

    clearCachedPassword();
    clearFileProgressThrottle();

    emitStage(
      isError ? 'Operation Aborted!' : 'Operation completed',
      100,
      isError ? 'ABORT' : 'COMPLETED',
    );
    setInProgress(false);
    setAbortController(null);
  }
}

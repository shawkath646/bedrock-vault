import * as fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type { LockableFile } from '@shared/types/file-selection';
import type { EncryptionProgress, FileKeyEntry } from '@shared/types/file-encryption';

// Utilities & Loggers
import { checkSystemResources } from '@main/utils/misc.utils';
import { resolveOutputDirectory } from '@main/utils/path.utils';
import type LoggerService from '@main/utils/logger';
import type { NativeCryptoService } from '@main/utils/native-crypto';

// Helpers
import {
  acquireAndValidateFiles,
  encryptFiles,
  EncryptionChangeJournal,
  runWithConcurrencyLimit
} from './helpers/file-encryptor.helper';

import {
  level1Enc,
  level2Enc,
  level3Enc,
  type OutputPath
} from './helpers/metadata-writer.helper';

import type FileSelectionService from '../file-selection/file-selection.handler';
import type { EncryptionOptionsService } from './encryption-options.store';
import type { EncryptionSessionService } from './helpers/abort-controller.helper';
import type { EncryptionEmitterService } from './helpers/encryption-emitter.helper';
import type { EncryptionRecordService } from '@main/utils/enc-record';

export class EncryptionWorkflowService {
  private logger: LoggerService;
  private fileSelectionService: FileSelectionService;
  private encryptionOptionsService: EncryptionOptionsService;
  private encryptionSessionService: EncryptionSessionService;
  private encryptionEmitterService: EncryptionEmitterService;
  private encryptionRecordService: EncryptionRecordService;
  private nativeCrypto: NativeCryptoService;

  constructor(
    logger: LoggerService,
    fileSelectionService: FileSelectionService,
    encryptionOptionsService: EncryptionOptionsService,
    encryptionSessionService: EncryptionSessionService,
    encryptionEmitterService: EncryptionEmitterService,
    encryptionRecordService: EncryptionRecordService,
    nativeCrypto: NativeCryptoService
  ) {
    this.logger = logger;
    this.fileSelectionService = fileSelectionService;
    this.encryptionOptionsService = encryptionOptionsService;
    this.encryptionSessionService = encryptionSessionService;
    this.encryptionEmitterService = encryptionEmitterService;
    this.encryptionRecordService = encryptionRecordService;
    this.nativeCrypto = nativeCrypto;
  }

  public async handleStartEncryptionWorkflow(): Promise<void> {
    if (this.encryptionSessionService.isInProgress()) return;
    this.encryptionSessionService.setInProgress(true);

    await this.logger.info('EncryptionWorkflow', 'Workflow started');

    const journal = new EncryptionChangeJournal();
    const ac = new AbortController();
    this.encryptionSessionService.setAbortController(ac);
    const { signal } = ac;

    let lockedFiles: LockableFile[] = [];
    let fileKeys: FileKeyEntry[] = [];
    let isError = false;

    try {
      this.encryptionEmitterService.emitStage('Preparing', 0);

      const { selectedFiles, selectedOptions } = this.fileSelectionService.fetchAllSelectedItems();
      const encryptionOptions = await this.encryptionOptionsService.fetchEncryptionOptions();
      const chunkName = selectedOptions.chunkName || `default-${Math.random().toString(36).substring(2, 7)}`;

      if (!selectedFiles?.length) throw new Error('No files selected.');

      const outputDirectory = await resolveOutputDirectory(encryptionOptions.fileOutputDirectory);
      if (!outputDirectory) throw new Error('USER_ABORTED');

      await this.logger.info('EncryptionWorkflow', `Output directory resolved: ${outputDirectory}`);

      this.encryptionEmitterService.emitStage('Analyzing files', 2);

      const validated = await acquireAndValidateFiles(selectedFiles);
      lockedFiles = validated.lockedFiles;

      await this.logger.info('EncryptionWorkflow', `Validated ${lockedFiles.length} files for encryption. Skipped: ${validated.skippedCount}`);

      if (signal.aborted) throw new Error('USER_ABORTED');

      if (validated.skippedCount > 0) {
        const label = validated.skippedCount > 1 ? 'files' : 'file';
        this.encryptionEmitterService.emitStage(`${validated.skippedCount} ${label} skipped.`, 5, 'WARNING');
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

      this.encryptionEmitterService.emitFileProgress(progressMap);
      this.encryptionEmitterService.emitStage('Analyzing resources', 8);

      await fs.mkdir(outputDirectory, { recursive: true });

      const resources = await checkSystemResources(outputDirectory, validated.totalSize);
      for (const w of resources.warnings) {
        this.encryptionEmitterService.emitStage(w.message, 8, 'WARNING');
        await this.logger.warn('EncryptionWorkflow', `Resource check warning: ${w.message}`);
      }
      if (!resources.ok) {
        await this.logger.error('EncryptionWorkflow', `Resource check failed: ${resources.fatalMessage}`);
        throw new Error(resources.fatalMessage ?? 'Insufficient system resources');
      }
      if (signal.aborted) throw new Error('USER_ABORTED');

      this.encryptionEmitterService.emitStage('Analyzing resources', 8);

      fileKeys = await encryptFiles({
        files: lockedFiles,
        outputDirectory,
        progressMap,
        journal,
        signal,
        emitFileProgress: (map, immediate) => this.encryptionEmitterService.emitFileProgress(map, immediate),
        encryptionOptions,
        logger: this.logger
      });

      if (signal.aborted) throw new Error('USER_ABORTED');

      const failedCount = lockedFiles.length - fileKeys.length;
      await this.logger.info('EncryptionWorkflow', `File encryption completed. Succeeded: ${fileKeys.length}, Failed: ${failedCount}`);
      if (failedCount > 0) {
        this.encryptionEmitterService.emitStage(`${failedCount} file(s) failed to encrypt`, 90, 'WARNING');
        await this.logger.warn('EncryptionWorkflow', `${failedCount} file(s) failed to encrypt`);
      }

      this.encryptionEmitterService.emitStage('Finalizing metadata', 95);

      const password = this.encryptionSessionService.getCachedPassword();
      if (!password) throw new Error('Encryption password has not been set.');
      await this.logger.info('EncryptionWorkflow', 'Password retrieved from cache');
      if (signal.aborted) throw new Error('USER_ABORTED');

      const outputPath: OutputPath = {
        metadataPath: path.join(outputDirectory, "v"),
        recoveryPhrasePath: encryptionOptions.recoveryPhrasePath,
        keyFilePath: encryptionOptions.recoveryPhraseFilePath
      };

      if (fileKeys.length > 0) {
        await this.logger.info('EncryptionWorkflow', `Routing to Level ${encryptionOptions.encryptionLevel} metadata encryption`);
        const keyParams = { chunkName, fileMetadata: fileKeys };
        switch (encryptionOptions.encryptionLevel) {
          case 1: await level1Enc(keyParams, password, outputPath, this.logger); break;
          case 2: await level2Enc(keyParams, password, outputPath, this.logger, this.nativeCrypto); break;
          case 3: await level3Enc(keyParams, password, outputPath, this.logger, this.nativeCrypto); break;
        }
      }

      if (encryptionOptions.cleanupAfterEncryption && fileKeys.length > 0 && failedCount === 0) {
        this.encryptionEmitterService.emitStage('Cleaning up source files', 98);
        const successPaths = fileKeys.map(e => e.virtualPath);
        const toTrash = lockedFiles.filter(f => successPaths.includes(f.path));

        await this.logger.info('EncryptionWorkflow', `Trashing ${toTrash.length} source files for cleanupAfterEncryption`);

        let failedTrashCount = 0;
        const trashTasks = toTrash.map(f => async () => {
          try {
            await shell.trashItem(f.actualPath);
          } catch (err) {
            failedTrashCount++;
            await this.logger.warn('EncryptionWorkflow', `Failed to trash ${f.actualPath}: ${err}`);
          }
        });

        await runWithConcurrencyLimit(trashTasks, 20);
        if (failedTrashCount > 0) {
          this.encryptionEmitterService.emitStage(`${failedTrashCount} source file(s) could not be moved to trash.`, 98, 'WARNING');
          await this.logger.warn('EncryptionWorkflow', `${failedTrashCount} files failed to trash during cleanup.`);
        }

        lockedFiles = lockedFiles.filter(f => !successPaths.includes(f.path));
      }

      await this.fileSelectionService.clearSelectedItems();

      if (encryptionOptions.addToRecordTable) {
        await this.encryptionRecordService.saveRecord({
          chunkName,
          path: outputDirectory,
          timestamp: new Date().toISOString(),
          encryptionLevel: encryptionOptions.encryptionLevel
        });
      }

      this.encryptionEmitterService.emitStage('Encryption completed', 99);
    } catch (error) {
      isError = true;
      const isAbort = error instanceof Error && error.message === 'USER_ABORTED';
      const message = error instanceof Error
        ? isAbort ? 'Encryption aborted by user.' : error.message
        : 'An unknown error occurred during encryption.';

      if (isAbort) {
        await this.logger.warn('EncryptionWorkflow', 'Workflow aborted by user');
      } else {
        await this.logger.error('EncryptionWorkflow', `Workflow failed: ${message}`);
      }

      console.error('Encryption workflow failed:', error);
      await journal.rollback();
      this.encryptionEmitterService.emitStage(message, 100, isAbort ? 'ABORT' : 'FAILED');
    } finally {
      for (const entry of fileKeys) {
        if (entry.key) entry.key.fill(0);
        if (entry.iv) entry.iv.fill(0);
      }

      this.encryptionSessionService.clearCachedPassword();
      this.encryptionEmitterService.clearFileProgressThrottle();

      this.encryptionEmitterService.emitStage(
        isError ? 'Operation Aborted!' : 'Operation completed',
        100,
        isError ? 'ABORT' : 'COMPLETED',
      );
      this.encryptionSessionService.setInProgress(false);
      this.encryptionSessionService.setAbortController(null);
    }
  }
}

import { dialog, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

// Utilities & Native Wrappers
import { validatePath } from '@main/utils/path.utils';
import { askPassword } from '@main/utils/native-crypto';
import logger from '@main/utils/logger';

// Helpers
import { decryptMetadataPayload } from './helpers/decryption.helpers';

// Types
import type { DecryptedFileEntry, DecryptionResult } from '@shared/types/fileEncryption';

export async function handleEncryptedDirectorySelect(
  _event: IpcMainInvokeEvent,
  directoryPath?: string
): Promise<DecryptionResult> {
  let selectedFolder = directoryPath;

  if (!selectedFolder) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'CANCELLED' };
    }

    selectedFolder = filePaths[0];
  }

  // 1. Verify path safety
  if (!validatePath(selectedFolder)) {
    return { success: false, error: 'INVALID_PATH' };
  }

  // 2. Check if metadata file 'v' exists
  const metadataPath = path.join(selectedFolder, 'v');
  try {
    await fs.access(metadataPath);
  } catch {
    return { success: false, error: 'NO_METADATA_FILE' };
  }

  let passwordBuffer: Buffer | null = null;

  try {
    const metadataBuffer = await fs.readFile(metadataPath);

    // 3. Prompt user for password
    passwordBuffer = await askPassword();
    if (!passwordBuffer) {
      return { success: false, error: 'PASSWORD_REQUIRED' };
    }

    // 4. Decrypt and validate the payload using helper
    const decrypted = await decryptMetadataPayload(metadataBuffer, passwordBuffer);

    // 5. Check file availability & Sanitization
    const sanitizedFiles: DecryptedFileEntry[] = [];
    const allFilesInDir = new Set(await fs.readdir(selectedFolder));

    for (const entry of decrypted.fileMetadata) {
      // Security Check: Prevent Path Traversal (e.g. if encName is "../../../Windows/System32")
      const safeEncName = path.basename(entry.encName);

      // Instant lookup from RAM
      const isAvailable = allFilesInDir.has(safeEncName);

      sanitizedFiles.push({
        name: entry.name,
        encName: safeEncName,
        virtualPath: entry.virtualPath,
        size: entry.size,
        ext: entry.ext,
        thumbnail: entry.thumbnail,
        isAvailable
      });
    }

    return {
      success: true,
      files: sanitizedFiles,
      chunkName: decrypted.chunkName
    };

  } catch (err: unknown) {
    await logger.error('DecryptionHandler', `Decryption workflow error: ${err}`);

    if (err instanceof Error) {
      if (err.message === 'INVALID_METADATA_HEADER' || err.message === 'CORRUPTED_METADATA') {
        return { success: false, error: 'CORRUPTED_METADATA' };
      }
      if (err.message === 'INVALID_PASSWORD') {
        return { success: false, error: 'INVALID_PASSWORD' };
      }
      if (err.message === 'TPM_UNAVAILABLE') {
        return { success: false, error: 'TPM_UNAVAILABLE', level: (err as Error & { level?: number }).level };
      }
      if (err.name === 'ZodError') {
        return { success: false, error: 'INVALID_METADATA_STRUCTURE' };
      }
    }
    
    return { success: false, error: 'DECRYPTION_FAILED' };
  } finally {
    if (passwordBuffer) {
      passwordBuffer.fill(0);
    }
  }
}

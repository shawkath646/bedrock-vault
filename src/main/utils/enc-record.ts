import path from "node:path";
import fs from "node:fs/promises";
import { app, dialog, shell, type IpcMainInvokeEvent } from "electron";
import { parseMetadataHeader } from "@main/handlers/crypto-core.helpers";
import logger from '@main/utils/logger';
import { RECORD_FILENAME } from '@main/constant/file.constants';
import type { EncryptionRecord } from '@shared/types/file-decryption';

const recordFilePath = path.join(app.getPath('userData'), RECORD_FILENAME);

export const addRecord = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    })

    if (canceled || filePaths.length === 0) {
        return null
    }

    const selectedDir = filePaths[0]
    const metadataPath = path.join(selectedDir, 'v')
    try {
        await fs.access(metadataPath)
    } catch {
        throw new Error('NO_METADATA_FILE')
    }

    const buffer = await fs.readFile(metadataPath)
    const header = parseMetadataHeader(buffer)

    const newRecord = {
        chunkName: header.chunkName,
        path: selectedDir,
        timestamp: header.timestamp,
        encryptionLevel: header.encryptionLevel,
    }

    await saveRecord(newRecord)
    return newRecord
}

export async function getRecords(): Promise<EncryptionRecord[]> {
  try {
    const rawContent = await fs.readFile(recordFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent);
    if (Array.isArray(parsed)) {
      const checkedRecords = await Promise.all(
        parsed.map(async (record: EncryptionRecord) => {
          let isAvailable: boolean;
          try {
            const stats = await fs.stat(record.path);
            isAvailable = stats.isDirectory();
          } catch {
            isAvailable = false;
          }
          return {
            ...record,
            isAvailable,
          };
        })
      );
      return checkedRecords;
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') {
      await logger.error('RecordUtil', `Failed to read records from record.json: ${error}`);
    }
  }
  return [];
}

export async function saveRecord(record: EncryptionRecord): Promise<void> {
  try {
    const records = await getRecords();
    const exists = records.some(r => path.resolve(r.path) === path.resolve(record.path));
    if (exists) {
      return;
    }
    records.push(record);
    const recordsToSave = records.map(({ isAvailable: _isAvailable, ...rest }) => rest);
    await fs.mkdir(path.dirname(recordFilePath), { recursive: true });
    await fs.writeFile(recordFilePath, JSON.stringify(recordsToSave, null, 2), 'utf-8');
    await logger.info('RecordUtil', `Successfully saved encryption record for ${record.chunkName}`);
  } catch (error) {
    await logger.error('RecordUtil', `Failed to save encryption record: ${error}`);
  }
}

export const removeRecord = async (
  _event: IpcMainInvokeEvent,
  directoryPath: string,
  deletePermanently: boolean
): Promise<void> => {
  try {
    const records = await getRecords();
    const resolvedPath = path.resolve(directoryPath);

    const recordExists = records.some(r => path.resolve(r.path) === resolvedPath);
    if (!recordExists) {
      throw new Error('Cannot delete: path is not a known encryption record');
    }

    const updatedRecords = records
      .filter(r => path.resolve(r.path) !== resolvedPath)
      .map(({ isAvailable: _isAvailable, ...rest }) => rest);

    await fs.mkdir(path.dirname(recordFilePath), { recursive: true });
    await fs.writeFile(recordFilePath, JSON.stringify(updatedRecords, null, 2), 'utf-8');
    await logger.info('RecordUtil', `Successfully removed record for path: ${directoryPath}`);

    if (deletePermanently) {
      try {
        await fs.access(directoryPath);

        await shell.trashItem(directoryPath);
        await logger.info('RecordUtil', `Moved directory to trash: ${directoryPath}`);
      } catch {
        await logger.info('RecordUtil', `Directory not found, skipping trash operation: ${directoryPath}`);
      }
    }
  } catch (error) {
    await logger.error('RecordUtil', `Failed to remove record for path ${directoryPath}: ${error}`);
    throw error;
  }
}
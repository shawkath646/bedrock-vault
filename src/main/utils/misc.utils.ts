import { app } from 'electron';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import type { EncryptionRecord } from '@shared/types/fileEncryption';
import logger from '@main/utils/logger';

// Constants
import { MIN_FREE_MEMORY_BYTES } from '@main/constant/system.constants';
import { RECORD_FILENAME } from '@main/constant/file.constants';

export function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const base = 1024;
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, unitIndex);

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function getDriveInfoFromPath(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const root = path.parse(resolvedPath).root;

  const { fsSize } = await import('systeminformation');
  const disks = await fsSize();

  return disks.find(disk => {
    const mount = path.normalize(disk.mount || disk.fs);

    if (process.platform === 'win32') {
      return (
        mount.toLowerCase().startsWith(root.toLowerCase().charAt(0)) ||
        mount.toLowerCase() === root.toLowerCase()
      );
    }

    return root.startsWith(mount);
  });
}

interface ResourceCheckResult {
  ok: boolean;
  warnings: { field: string; message: string }[];
  fatalMessage?: string;
}

export async function checkSystemResources(
  outputDirectory: string,
  totalSize: number,
): Promise<ResourceCheckResult> {
  const warnings: { field: string; message: string }[] = [];

  const driveInfo = await getDriveInfoFromPath(outputDirectory);
  if (!driveInfo) {
    return { ok: false, warnings, fatalMessage: 'Failed to read target storage info' };
  }
  if (driveInfo.available < totalSize) {
    return {
      ok: false,
      warnings,
      fatalMessage:
        `Insufficient storage! Need ${formatSize(totalSize)}, ` +
        `only ${formatSize(driveInfo.available)} available.`,
    };
  }

  try {
    const { mem } = await import('systeminformation');
    const memData = await mem();
    if (memData.available < MIN_FREE_MEMORY_BYTES) {
      warnings.push({
        field: 'memory',
        message: `Low memory: only ${formatSize(memData.available)} free. Performance may be degraded.`,
      });
    }
  } catch { /* systeminformation unavailable — skip */ }

  if (os.cpus().length <= 1) {
    warnings.push({
      field: 'cpu',
      message: 'Single-core CPU detected. Encryption will be slower than usual.',
    });
  }

  return { ok: true, warnings };
}

const recordFilePath = path.join(app.getPath('userData'), RECORD_FILENAME);

export async function getRecords(): Promise<EncryptionRecord[]> {
  try {
    const rawContent = await fs.readFile(recordFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent);
    if (Array.isArray(parsed)) {
      return parsed;
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
    records.push(record);
    await fs.mkdir(path.dirname(recordFilePath), { recursive: true });
    await fs.writeFile(recordFilePath, JSON.stringify(records, null, 2), 'utf-8');
    await logger.info('RecordUtil', `Successfully saved encryption record for ${record.chunkName}`);
  } catch (error) {
    await logger.error('RecordUtil', `Failed to save encryption record: ${error}`);
  }
}

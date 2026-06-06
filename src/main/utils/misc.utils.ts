import * as os from 'node:os';
import path from 'node:path';
import { MIN_FREE_MEMORY_BYTES } from '@main/constant/system.constants';


export function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const base = 1024;
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, unitIndex);

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

let cachedSi: typeof import('systeminformation') | null = null;

async function getSystemInformation() {
  if (!cachedSi) {
    cachedSi = await import('systeminformation');
  }
  return cachedSi;
}

let cachedDisks: import('systeminformation').Systeminformation.FsSizeData[] | null = null;
let cachedDisksTime = 0;
const DISKS_CACHE_TTL_MS = 5000;

async function getFsSize() {
  const now = Date.now();
  if (!cachedDisks || (now - cachedDisksTime) > DISKS_CACHE_TTL_MS) {
    const si = await getSystemInformation();
    cachedDisks = await si.fsSize();
    cachedDisksTime = now;
  }
  return cachedDisks;
}

export async function getDriveInfoFromPath(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const root = path.parse(resolvedPath).root;

  const disks = await getFsSize();

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
    const si = await getSystemInformation();
    const memData = await si.mem();
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


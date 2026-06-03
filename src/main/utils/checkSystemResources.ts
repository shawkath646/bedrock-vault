import * as os from 'node:os';
import getDriveInfoFromPath from '@main/utils/getDriveInfoFromPath';
import { formatSize } from '@shared/utils/formatSize';

interface ResourceCheckResult {
    ok: boolean;
    warnings: { field: string; message: string }[];
    fatalMessage?: string;
}

const MIN_FREE_MEMORY_BYTES = 256 * 1024 * 1024;

export default async function checkSystemResources(
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
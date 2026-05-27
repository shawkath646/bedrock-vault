import * as fs from 'node:fs/promises';
import lockFile from 'proper-lockfile';
import type { SelectedFile, LockableFile } from "@shared/types/fileSelection";

export async function acquireAndValidateFiles(
    files: SelectedFile[],
): Promise<{ lockedFiles: LockableFile[]; skippedCount: number; totalSize: number }> {
    const lockedFiles: LockableFile[] = [];
    let skippedCount = 0;
    let totalSize = 0;

    if (!files || !Array.isArray(files)) return { lockedFiles, skippedCount, totalSize };

    const CHUNK = 50;
    for (let i = 0; i < files.length; i += CHUNK) {
        await Promise.all(
            files.slice(i, i + CHUNK).map(async (file) => {
                try {
                    if (!file?.actualPath) throw new Error('Invalid file path');
                    const stat = await fs.stat(file.actualPath);
                    if (!stat.isFile()) throw new Error('Target is not a file');
                    const release = await lockFile.lock(file.actualPath);
                    lockedFiles.push({ ...file, release });
                    totalSize += file.size || stat.size;
                } catch {
                    skippedCount += 1;
                }
            }),
        );
    }

    return { lockedFiles, skippedCount, totalSize };
}

export async function releaseAllLocks(files: LockableFile[]): Promise<void> {
    await Promise.allSettled(files.map(f => f.release()));
}
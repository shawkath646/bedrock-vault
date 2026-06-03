import getDriveInfoFromPath from '@main/utils/getDriveInfoFromPath';

export interface StorageInfo {
    available: number;
    used: number;
    total: number;
    mounted: string;
}

export async function fetchStorageInfo(filePath: string): Promise<StorageInfo | null> {
    const driveInfo = await getDriveInfoFromPath(filePath);
    if (!driveInfo) {
        return null;
    }

    return {
        available: driveInfo.available,
        used: driveInfo.used,
        total: driveInfo.size,
        mounted: driveInfo.mount,
    };
}
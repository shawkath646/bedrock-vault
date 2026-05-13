import nodeDiskInfo from 'node-disk-info';
import path from 'path';

export default async function getDriveInfoFromPath(filePath: string) {
    const parsedPath = path.parse(path.resolve(filePath));
    const root = parsedPath.root;

    const disks = await nodeDiskInfo.getDiskInfo();

    const driveInfo = disks.find(disk =>
        root.startsWith(disk.mounted.substring(0, 1)) ||
        root === disk.mounted
    );

    return driveInfo;
}

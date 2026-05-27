import si from 'systeminformation';
import path from 'path';

export default async function getDriveInfoFromPath(filePath: string) {
    const resolvedPath = path.resolve(filePath);
    const root = path.parse(resolvedPath).root;

    const disks = await si.fsSize();

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

// fileSelection.ts
import { dialog, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandleFileOptions, SelectedFile } from '@shared/types/fileSelection';

const selectedItemsMap = new Map<string, SelectedFile>();

const FILE_TYPES = {
    documents: ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.csv', '.rtf'],
    audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a'],
    video: ['.mp4', '.mkv', '.avi', '.mov', '.wmv'],
    pictures: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    programs: ['.exe', '.msi', '.app', '.sh', '.bat', '.dmg', '.pkg'],
};

function isAllowedType(fileName: string, options: HandleFileOptions): boolean {
    const ext = path.extname(fileName).toLowerCase();

    if (options.documents && FILE_TYPES.documents.includes(ext)) return true;
    if (options.audio && FILE_TYPES.audio.includes(ext)) return true;
    if (options.video && FILE_TYPES.video.includes(ext)) return true;
    if (options.pictures && FILE_TYPES.pictures.includes(ext)) return true;
    if (options.programs && FILE_TYPES.programs.includes(ext)) return true;

    if (options.others) {
        const allKnownExts = Object.values(FILE_TYPES).flat();
        if (!allKnownExts.includes(ext)) return true;
    }

    return false;
}


export async function addFiles(_event: IpcMainInvokeEvent, options: HandleFileOptions) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
    });

    if (canceled) return;

    for (const filePath of filePaths) {
        try {
            if (!isAllowedType(filePath, options)) continue;

            const stat = await fs.stat(filePath);
            if (stat.size <= options.maxSize) {
                const targetPath = options.currentPath
                    ? path.join(options.currentPath, path.basename(filePath))
                    : filePath;

                selectedItemsMap.set(targetPath, {
                    name: path.basename(filePath),
                    ext: path.extname(filePath),
                    size: stat.size,
                    path: targetPath,
                    isDir: false,
                });
            }
        } catch (error) {
            console.error(`Failed to process file ${filePath}:`, error);
        }
    }
}

export async function addFolder(_event: IpcMainInvokeEvent, options: HandleFileOptions) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections'],
    });

    if (canceled) return;

    for (const folderPath of filePaths) {
        const virtualRootPath = options.currentPath
            ? path.join(options.currentPath, path.basename(folderPath))
            : folderPath;

        await processDirectory(folderPath, virtualRootPath, options, options.maxSize, options.includeSubfolders);
    }
}

// Recursive helper function for folders
async function processDirectory(realDirPath: string, virtualDirPath: string, options: HandleFileOptions, maxSize: number, recursive: boolean) {
    try {
        selectedItemsMap.set(virtualDirPath, {
            name: path.basename(virtualDirPath),
            ext: path.extname(virtualDirPath),
            size: 0,
            path: virtualDirPath,
            isDir: true,
        });

        const entries = await fs.readdir(realDirPath, { withFileTypes: true });

        for (const entry of entries) {
            const realFullPath = path.join(realDirPath, entry.name);
            const virtualFullPath = path.join(virtualDirPath, entry.name);

            if (entry.isDirectory()) {
                if (recursive) {
                    await processDirectory(realFullPath, virtualFullPath, options, maxSize, recursive);
                }
            } else if (entry.isFile()) {
                if (isAllowedType(entry.name, options)) {
                    const stat = await fs.stat(realFullPath);
                    if (stat.size <= maxSize) {
                        selectedItemsMap.set(virtualFullPath, {
                            name: entry.name,
                            ext: path.extname(virtualFullPath),
                            size: stat.size,
                            path: virtualFullPath,
                            isDir: false,
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Failed to process directory ${realDirPath}:`, error);
    }
}

export async function removeItem(_event: IpcMainInvokeEvent, targetPath: string) {
    selectedItemsMap.delete(targetPath);

    // If it was a directory, we must safely remove all children nested within it.
    // We append path.sep (e.g., '\' or '/') to prevent partial matches 
    // (e.g., removing 'C:\Folder' shouldn't remove 'C:\FolderNew')
    const prefix = targetPath + path.sep;

    for (const key of selectedItemsMap.keys()) {
        if (key.startsWith(prefix)) {
            selectedItemsMap.delete(key);
        }
    }
}

export async function getCurrentPathFiles(_event: IpcMainInvokeEvent, currentPath: string) {
    const result: SelectedFile[] = [];

    for (const item of selectedItemsMap.values()) {
        // path.dirname returns the immediate parent folder
        const parentDir = path.dirname(item.path);

        // Check if the item is a direct child of the currentPath 
        // (and not the currentPath directory itself)
        if (parentDir === currentPath && item.path !== currentPath) {
            result.push(item);
        }
    }

    return result;
}

export async function getAllSelectedItems() {
    let totalSize = 0;
    let fileCount = 0;
    const items = Array.from(selectedItemsMap.values());

    for (const item of items) {
        if (!item.isDir) {
            totalSize += item.size;
            fileCount++;
        }
    }

    return {
        items,
        totalSize,
        fileCount
    };
}

export async function clearSelectedItems() {
    selectedItemsMap.clear();
}
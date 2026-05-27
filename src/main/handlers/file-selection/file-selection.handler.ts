import { app, dialog, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { defaultOptions as defaultFileSelectionOptions } from '@shared/constant/fileSelection';
import type {
    FileSelectionOptions,
    HandleFileOptions,
    SelectedFile,
    SelectedFilesState,
} from '@shared/types/fileSelection';
import {
    calculateSelectedFilesSize,
    countRegularFiles,
    createDefaultPersistedSelectionState,
    generateVirtualPath,
    getRootLevelSelectedFiles,
    getVirtualBaseName,
    getVirtualParentPath,
    isFileTypeAllowed,
    normalizeVirtualPath,
    parsePersistedSelectionState,
} from './file-selection.utils';

let selectedItemsMap: Map<string, SelectedFile> | null = null;
let selectedFilesConfigPath = '';
let selectedOptions: FileSelectionOptions = defaultFileSelectionOptions;
let totalSize = 0;
let fileCount = 0;

function requireSelectedItemsMap(): Map<string, SelectedFile> {
    if (!selectedItemsMap) {
        throw new Error('File selection handler is not initialized. Call initializeFileSelectionHandler() first.');
    }

    return selectedItemsMap;
}

async function persistSelectedItemsToDisk(): Promise<void> {
    const map = requireSelectedItemsMap();

    try {
        const content = JSON.stringify(
            {
                selectedFiles: [...map.values()],
                options: selectedOptions,
                fileCount,
                totalSize,
            },
            null,
            2,
        );

        const temporaryFilePath = `${selectedFilesConfigPath}.tmp`;
        await fs.writeFile(temporaryFilePath, content, 'utf-8');
        await fs.rename(temporaryFilePath, selectedFilesConfigPath);
    } catch (error) {
        console.error('Error: Saving selected files to disk failed!', error);
    }
}

async function loadPersistedSelectionState() {
    try {
        const rawContent = await fs.readFile(selectedFilesConfigPath, 'utf-8');
        return parsePersistedSelectionState(JSON.parse(rawContent));
    } catch {
        return createDefaultPersistedSelectionState();
    }
}

async function addFilesFromDirectoryRecursively(
    sourceDirectoryPath: string,
    targetVirtualPath: string,
    options: HandleFileOptions,
): Promise<void> {
    try {
        const map = requireSelectedItemsMap();
        const normalizedVirtualPath = normalizeVirtualPath(targetVirtualPath);
        const baseName = getVirtualBaseName(normalizedVirtualPath);
        
        // Create virtual path entry for the folder itself
        map.set(normalizedVirtualPath, {
            name: baseName,
            ext: '',
            size: 0,
            path: normalizedVirtualPath,
            actualPath: sourceDirectoryPath,
            isDir: true,
        });

        const entries = await fs.readdir(sourceDirectoryPath, { withFileTypes: true });

        await Promise.all(
            entries.map(async (entry) => {
                const sourceEntryPath = path.join(sourceDirectoryPath, entry.name);
                const targetEntryVirtualPath = `${normalizedVirtualPath}/${entry.name}`;

                if (entry.isDirectory()) {
                    if (options.includeSubfolders) {
                        await addFilesFromDirectoryRecursively(sourceEntryPath, targetEntryVirtualPath, options);
                    }
                    return;
                }

                if (!entry.isFile() || !isFileTypeAllowed(entry.name, options)) {
                    return;
                }

                try {
                    const sourceEntryStat = await fs.stat(sourceEntryPath);
                    if (sourceEntryStat.size > options.maxSize) {
                        return;
                    }

                    const normalizedEntryVirtualPath = normalizeVirtualPath(targetEntryVirtualPath);
                    map.set(normalizedEntryVirtualPath, {
                        name: entry.name,
                        ext: path.extname(entry.name),
                        size: sourceEntryStat.size,
                        path: normalizedEntryVirtualPath,
                        actualPath: sourceEntryPath,
                        isDir: false,
                    });

                    totalSize += sourceEntryStat.size;
                    fileCount += 1;
                } catch (error) {
                    console.error(`Failed to stat ${sourceEntryPath}`, error);
                }
            }),
        );
    } catch (error) {
        console.error(`Failed to process directory ${sourceDirectoryPath}:`, error);
    }
}

export async function initializeFileSelectionHandler(): Promise<void> {
    selectedFilesConfigPath = path.join(app.getPath('userData'), 'selected_files.json');
    const state = await loadPersistedSelectionState();

    selectedItemsMap = new Map(state.selectedFiles.map((file) => [file.path, file]));
    selectedOptions = state.options;
    totalSize = state.totalSize;
    fileCount = state.fileCount;
}

export async function fetchSelectedFilesState(): Promise<SelectedFilesState> {
    return {
        options: selectedOptions,
        fileCount,
        totalSize,
    };
}

export async function updateFileSelectionOptions(
    _event: IpcMainInvokeEvent,
    partialOptions: Partial<FileSelectionOptions>,
): Promise<void> {
    selectedOptions = {
        ...selectedOptions,
        ...partialOptions,
    };

    await persistSelectedItemsToDisk();
}

export async function handleFileSelectionAddFiles(_event: IpcMainInvokeEvent, options: HandleFileOptions): Promise<void> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
    });

    if (canceled || filePaths.length === 0) {
        return;
    }

    const map = requireSelectedItemsMap();
    const existingVirtualPaths = new Set(map.keys());
    let hasChanges = false;

    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                if (!isFileTypeAllowed(filePath, options)) {
                    return;
                }

                const sourceStat = await fs.stat(filePath);
                if (sourceStat.size > options.maxSize) {
                    return;
                }

                const fileName = path.basename(filePath);
                const parentVirtualPath = options.currentPath ? normalizeVirtualPath(options.currentPath) : null;
                const virtualPath = generateVirtualPath(fileName, parentVirtualPath, existingVirtualPaths);
                
                existingVirtualPaths.add(virtualPath);

                map.set(virtualPath, {
                    name: fileName,
                    ext: path.extname(filePath),
                    size: sourceStat.size,
                    path: virtualPath,
                    actualPath: filePath,
                    isDir: false,
                });

                totalSize += sourceStat.size;
                fileCount += 1;
                hasChanges = true;
            } catch (error) {
                console.error(`Failed to process file ${filePath}:`, error);
            }
        }),
    );

    if (hasChanges) {
        await persistSelectedItemsToDisk();
    }
}

export async function handleFileSelectionAddFolder(_event: IpcMainInvokeEvent, options: HandleFileOptions): Promise<void> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections'],
    });

    if (canceled || filePaths.length === 0) {
        return;
    }

    const map = requireSelectedItemsMap();
    const existingVirtualPaths = new Set(map.keys());

    for (const folderPath of filePaths) {
        const folderName = path.basename(folderPath);
        const parentVirtualPath = options.currentPath ? normalizeVirtualPath(options.currentPath) : null;
        const targetVirtualPath = generateVirtualPath(folderName, parentVirtualPath, existingVirtualPaths);
        
        existingVirtualPaths.add(targetVirtualPath);
        await addFilesFromDirectoryRecursively(folderPath, targetVirtualPath, options);
    }

    await persistSelectedItemsToDisk();
}

export async function handleFileSelectionRemoveItem(_event: IpcMainInvokeEvent, targetPath: string): Promise<void> {
    const map = requireSelectedItemsMap();
    let hasChanges = false;

    const normalizedPath = normalizeVirtualPath(targetPath);
    const targetItem = map.get(normalizedPath);
    
    if (targetItem) {
        if (!targetItem.isDir) {
            totalSize -= targetItem.size;
            fileCount -= 1;
        }

        map.delete(normalizedPath);
        hasChanges = true;
    }

    // Remove all children of the deleted item (for folder deletion)
    const itemPathPrefix = `${normalizedPath}/`;
    for (const key of map.keys()) {
        if (!key.startsWith(itemPathPrefix)) {
            continue;
        }

        const childItem = map.get(key);
        if (childItem && !childItem.isDir) {
            totalSize -= childItem.size;
            fileCount -= 1;
        }

        map.delete(key);
        hasChanges = true;
    }

    if (hasChanges) {
        await persistSelectedItemsToDisk();
    }
}

export async function fetchCurrentPathSelectedFiles(
    _event: IpcMainInvokeEvent,
    currentPath: string | null
): Promise<SelectedFile[]> {
    const map = requireSelectedItemsMap();

    if (!currentPath) {
        return getRootLevelSelectedFiles(map);
    }

    const normalizedCurrentPath = normalizeVirtualPath(currentPath);
    const result: SelectedFile[] = [];
    
    for (const item of map.values()) {
        const parentPath = getVirtualParentPath(item.path);
        if (parentPath === normalizedCurrentPath) {
            result.push(item);
        }
    }

    return result;
}

export function fetchAllSelectedItems(): {
    selectedFiles: SelectedFile[];
    totalSize: number;
    fileCount: number;
    selectedOptions: FileSelectionOptions;
} {
    const map = requireSelectedItemsMap();
    const selectedFiles = [...map.values()].filter(file => !file.isDir);

    return {
        selectedFiles,
        totalSize,
        fileCount,
        selectedOptions,
    };
}

export async function clearSelectedItems() {
    const map = requireSelectedItemsMap();
    map.clear();
    totalSize = calculateSelectedFilesSize([]);
    fileCount = countRegularFiles([]);
    await persistSelectedItemsToDisk();
}
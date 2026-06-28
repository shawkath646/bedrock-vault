import { app, dialog, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { defaultOptions as defaultFileSelectionOptions } from '@shared/constant/file-selection.constants';
import type {
    FileSelectionOptions,
    HandleFileOptions,
    SelectedFile,
    SelectedFilesState,
} from '@shared/types/file-selection';
import z from 'zod';
import type { SaveResult } from '@shared/types/global';
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
    FileSelectionOptionsSchema,
} from './file-selection.utils';
import type LoggerService from '@main/utils/logger';

export default class FileSelectionService {
    private selectedItemsMap: Map<string, SelectedFile> | null = null;
    private selectedFilesConfigPath: string = '';
    private selectedOptions: FileSelectionOptions = defaultFileSelectionOptions;
    private totalSize: number = 0;
    private fileCount: number = 0;
    private writePromise: Promise<void> = Promise.resolve();
    private logger: LoggerService;

    constructor(logger: LoggerService) {
        this.logger = logger;
    }

    public async initialize(): Promise<void> {
        this.selectedFilesConfigPath = path.join(app.getPath('userData'), 'selected_files.json');
        
        const state = await this.loadPersistedSelectionState();

        this.selectedItemsMap = new Map(state.selectedFiles.map((file) => [file.path, file]));
        this.selectedOptions = state.options;
        this.totalSize = state.totalSize;
        this.fileCount = state.fileCount;

        await this.logger.info('FileSelection', `Initialized. Loaded ${this.fileCount} files, total size: ${this.totalSize} bytes`);
    }

    public cleanup(): void {
        this.selectedItemsMap?.clear();
        this.selectedItemsMap = null;
        this.totalSize = 0;
        this.fileCount = 0;
        void this.logger.info('FileSelection', 'Cleaned up memory for background mode');
    }

    public async fetchSelectedFilesState(): Promise<SelectedFilesState> {
        return {
            options: this.selectedOptions,
            fileCount: this.fileCount,
            totalSize: this.totalSize,
        };
    }

    public async updateFileSelectionOptions(
        _event: IpcMainInvokeEvent,
        partialOptions: Partial<FileSelectionOptions>,
    ): Promise<SaveResult<FileSelectionOptions>> {
        try {
            const mergedOptions = {
                ...this.selectedOptions,
                ...partialOptions,
            };

            const validatedOptions = FileSelectionOptionsSchema.parse(mergedOptions);
            this.selectedOptions = validatedOptions;

            await this.persistSelectedItemsToDisk();
            await this.logger.info('FileSelection', `Options updated: ${JSON.stringify(partialOptions)}`);
            
            return { success: true, data: validatedOptions };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    success: false,
                    errors: z.treeifyError(error) as Record<string, string[]>,
                };
            }
            throw error;
        }
    }

    public async handleFileSelectionAddFiles(_event: IpcMainInvokeEvent, options: HandleFileOptions): Promise<void> {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
        });

        if (canceled || filePaths.length === 0) {
            await this.logger.info('FileSelection', 'File selection dialog cancelled');
            return;
        }

        const map = this.requireSelectedItemsMap();
        const existingVirtualPaths = new Set(map.keys());
        let hasChanges = false;

        await Promise.all(
            filePaths.map(async (filePath) => {
                try {
                    if (!isFileTypeAllowed(filePath, options)) return;

                    const sourceStat = await fs.stat(filePath);
                    if (sourceStat.size > options.maxSize) return;

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

                    this.totalSize += sourceStat.size;
                    this.fileCount += 1;
                    hasChanges = true;
                } catch (error) {
                    console.error(`Failed to process file ${filePath}:`, error);
                }
            }),
        );

        if (hasChanges) {
            await this.persistSelectedItemsToDisk();
            await this.logger.info('FileSelection', `Added files from dialog. New file count: ${this.fileCount}, size: ${this.totalSize} bytes`);
        }
    }

    public async handleFileSelectionAddFolder(_event: IpcMainInvokeEvent, options: HandleFileOptions): Promise<void> {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'multiSelections'],
        });

        if (canceled || filePaths.length === 0) {
            await this.logger.info('FileSelection', 'Folder selection dialog cancelled');
            return;
        }

        const map = this.requireSelectedItemsMap();
        const existingVirtualPaths = new Set(map.keys());

        for (const folderPath of filePaths) {
            const folderName = path.basename(folderPath);
            const parentVirtualPath = options.currentPath ? normalizeVirtualPath(options.currentPath) : null;
            const targetVirtualPath = generateVirtualPath(folderName, parentVirtualPath, existingVirtualPaths);
            
            existingVirtualPaths.add(targetVirtualPath);
            await this.addFilesFromDirectoryRecursively(folderPath, targetVirtualPath, options);
        }

        await this.persistSelectedItemsToDisk();
        await this.logger.info('FileSelection', `Added folders from dialog. New file count: ${this.fileCount}, size: ${this.totalSize} bytes`);
    }

    public async handleFileSelectionRemoveItem(_event: IpcMainInvokeEvent, targetPath: string): Promise<void> {
        const map = this.requireSelectedItemsMap();
        let hasChanges = false;

        const normalizedPath = normalizeVirtualPath(targetPath);
        const targetItem = map.get(normalizedPath);
        
        if (targetItem) {
            if (!targetItem.isDir) {
                this.totalSize -= targetItem.size;
                this.fileCount -= 1;
            }

            map.delete(normalizedPath);
            hasChanges = true;
        }

        const itemPathPrefix = `${normalizedPath}/`;
        for (const key of map.keys()) {
            if (!key.startsWith(itemPathPrefix)) continue;

            const childItem = map.get(key);
            if (childItem && !childItem.isDir) {
                this.totalSize -= childItem.size;
                this.fileCount -= 1;
            }

            map.delete(key);
            hasChanges = true;
        }

        if (hasChanges) {
            await this.persistSelectedItemsToDisk();
            await this.logger.info('FileSelection', `Removed item: ${targetPath}. New file count: ${this.fileCount}, size: ${this.totalSize} bytes`);
        }
    }

    public async fetchCurrentPathSelectedFiles(
        _event: IpcMainInvokeEvent,
        currentPath: string | null
    ): Promise<SelectedFile[]> {
        const map = this.requireSelectedItemsMap();

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

    public fetchAllSelectedItems(): {
        selectedFiles: SelectedFile[];
        totalSize: number;
        fileCount: number;
        selectedOptions: FileSelectionOptions;
    } {
        const map = this.requireSelectedItemsMap();
        const selectedFiles = [...map.values()].filter(file => !file.isDir);

        return {
            selectedFiles,
            totalSize: this.totalSize,
            fileCount: this.fileCount,
            selectedOptions: this.selectedOptions,
        };
    }

    public async clearSelectedItems(): Promise<void> {
        const map = this.requireSelectedItemsMap();
        map.clear();
        this.totalSize = calculateSelectedFilesSize([]);
        this.fileCount = countRegularFiles([]);
        await this.persistSelectedItemsToDisk();
        await this.logger.info('FileSelection', 'Cleared all selected items');
    }


    private requireSelectedItemsMap(): Map<string, SelectedFile> {
        if (!this.selectedItemsMap) {
            throw new Error('File selection handler is not initialized. Call initialize() first.');
        }
        return this.selectedItemsMap;
    }

    private async persistSelectedItemsToDisk(): Promise<void> {
        const map = this.requireSelectedItemsMap();
        const content = JSON.stringify(
            {
                selectedFiles: [...map.values()],
                options: this.selectedOptions,
                fileCount: this.fileCount,
                totalSize: this.totalSize,
            },
            null,
            2,
        );

        this.writePromise = this.writePromise.then(async () => {
            try {
                const temporaryFilePath = `${this.selectedFilesConfigPath}.tmp`;
                await fs.writeFile(temporaryFilePath, content, 'utf-8');
                await fs.rename(temporaryFilePath, this.selectedFilesConfigPath);
            } catch (error) {
                console.error('Error: Saving selected files to disk failed!', error);
            }
        });

        await this.writePromise;
    }

    private async loadPersistedSelectionState() {
        try {
            const rawContent = await fs.readFile(this.selectedFilesConfigPath, 'utf-8');
            return parsePersistedSelectionState(JSON.parse(rawContent));
        } catch {
            return createDefaultPersistedSelectionState();
        }
    }

    private async addFilesFromDirectoryRecursively(
        sourceDirectoryPath: string,
        targetVirtualPath: string,
        options: HandleFileOptions,
    ): Promise<void> {
        try {
            const map = this.requireSelectedItemsMap();
            const normalizedVirtualPath = normalizeVirtualPath(targetVirtualPath);
            const baseName = getVirtualBaseName(normalizedVirtualPath);
            
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
                            await this.addFilesFromDirectoryRecursively(sourceEntryPath, targetEntryVirtualPath, options);
                        }
                        return;
                    }

                    if (!entry.isFile() || !isFileTypeAllowed(entry.name, options)) return;

                    try {
                        const sourceEntryStat = await fs.stat(sourceEntryPath);
                        if (sourceEntryStat.size > options.maxSize) return;

                        const normalizedEntryVirtualPath = normalizeVirtualPath(targetEntryVirtualPath);
                        map.set(normalizedEntryVirtualPath, {
                            name: entry.name,
                            ext: path.extname(entry.name),
                            size: sourceEntryStat.size,
                            path: normalizedEntryVirtualPath,
                            actualPath: sourceEntryPath,
                            isDir: false,
                        });

                        this.totalSize += sourceEntryStat.size;
                        this.fileCount += 1;
                    } catch (error) {
                        console.error(`Failed to stat ${sourceEntryPath}`, error);
                    }
                }),
            );
        } catch (error) {
            console.error(`Failed to process directory ${sourceDirectoryPath}:`, error);
        }
    }
}
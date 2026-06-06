import path from 'node:path';
import z from 'zod';
import { defaultOptions as defaultFileSelectionOptions } from '@shared/constant/file-selection.constants';
import type {
    FileSelectionOptions,
    HandleFileOptions,
    SelectedFile,
} from '@shared/types/file-selection';
import { ALL_KNOWN_FILE_EXTENSIONS, FILE_TYPE_EXTENSION_MAP } from './file-selection.constants';

export interface PersistedSelectionState {
    selectedFiles: SelectedFile[];
    options: FileSelectionOptions;
    fileCount: number;
    totalSize: number;
}

const SelectedFileSchema: z.ZodType<SelectedFile> = z.object({
    name: z.string(),
    path: z.string(),
    actualPath: z.string(),
    isDir: z.boolean(),
    ext: z.string(),
    size: z.number(),
});

export const FileSelectionOptionsSchema: z.ZodType<FileSelectionOptions> = z.object({
    chunkName: z.string().min(1, { message: "Chunk name is required" }),
    includeSubFolders: z.boolean(),
    maxSize: z.number().min(0, { message: "Max size must be a non-negative number" }),
    documents: z.boolean(),
    audio: z.boolean(),
    video: z.boolean(),
    pictures: z.boolean(),
    programs: z.boolean(),
    others: z.boolean(),
});

const PersistedSelectionStateSchema = z.object({
    selectedFiles: z.array(SelectedFileSchema),
    options: FileSelectionOptionsSchema,
    fileCount: z.number().optional(),
    totalSize: z.number().optional(),
});

export function generateVirtualPath(
    fileName: string,
    parentVirtualPath: string | null,
    existingPaths: Set<string>
): string {
    const basePath = parentVirtualPath ? `${parentVirtualPath}/${fileName}` : `/${fileName}`;
    
    if (!existingPaths.has(basePath)) {
        return basePath;
    }

    let counter = 1;
    const ext = path.extname(fileName);
    const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName;
    
    while (true) {
        const newPath = parentVirtualPath 
            ? `${parentVirtualPath}/${nameWithoutExt} (${counter})${ext}`
            : `/${nameWithoutExt} (${counter})${ext}`;
        
        if (!existingPaths.has(newPath)) {
            return newPath;
        }
        counter++;
    }
}

export function normalizeVirtualPath(virtualPath: string): string {
    return virtualPath.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
}


export function getVirtualParentPath(virtualPath: string): string | null {
    const normalized = normalizeVirtualPath(virtualPath);
    if (normalized === '/') return null;
    
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === 0) return null;
    
    return normalized.substring(0, lastSlash);
}

export function getVirtualBaseName(virtualPath: string): string {
    const normalized = normalizeVirtualPath(virtualPath);
    const lastSlash = normalized.lastIndexOf('/');
    return normalized.substring(lastSlash + 1);
}

export function createDefaultPersistedSelectionState(): PersistedSelectionState {
    return {
        selectedFiles: [],
        options: defaultFileSelectionOptions,
        fileCount: 0,
        totalSize: 0,
    };
}

export function countRegularFiles(items: SelectedFile[]): number {
    return items.reduce((count, item) => count + (item.isDir ? 0 : 1), 0);
}

export function calculateSelectedFilesSize(items: SelectedFile[]): number {
    return items.reduce((size, item) => size + (item.isDir ? 0 : item.size), 0);
}

export function isFileTypeAllowed(fileNameOrPath: string, options: HandleFileOptions): boolean {
    const extension = path.extname(fileNameOrPath).toLowerCase();

    if (options.documents && FILE_TYPE_EXTENSION_MAP.documents.has(extension)) return true;
    if (options.audio && FILE_TYPE_EXTENSION_MAP.audio.has(extension)) return true;
    if (options.video && FILE_TYPE_EXTENSION_MAP.video.has(extension)) return true;
    if (options.pictures && FILE_TYPE_EXTENSION_MAP.pictures.has(extension)) return true;
    if (options.programs && FILE_TYPE_EXTENSION_MAP.programs.has(extension)) return true;

    if (options.others && !ALL_KNOWN_FILE_EXTENSIONS.has(extension)) return true;

    return false;
}

export function parsePersistedSelectionState(parsed: unknown): PersistedSelectionState {
    if (Array.isArray(parsed)) {
        const legacyMap = new Map<string, SelectedFile>(parsed as Array<[string, SelectedFile]>);
        const selectedFiles = [...legacyMap.values()];

        return {
            selectedFiles,
            options: defaultFileSelectionOptions,
            fileCount: countRegularFiles(selectedFiles),
            totalSize: calculateSelectedFilesSize(selectedFiles),
        };
    }

    const parsedState = PersistedSelectionStateSchema.safeParse(parsed);
    if (parsedState.success) {
        return {
            selectedFiles: parsedState.data.selectedFiles,
            options: parsedState.data.options,
            fileCount: parsedState.data.fileCount ?? countRegularFiles(parsedState.data.selectedFiles),
            totalSize: parsedState.data.totalSize ?? calculateSelectedFilesSize(parsedState.data.selectedFiles),
        };
    }

    return createDefaultPersistedSelectionState();
}

export function getRootLevelSelectedFiles(selectedItemsMap: Map<string, SelectedFile>): SelectedFile[] {
    const selectedFolderPaths = new Set(
        [...selectedItemsMap.values()]
            .filter((file) => file.isDir)
            .map((file) => file.path),
    );

    return [...selectedItemsMap.values()].filter((file) => {
        const parentDirectory = getVirtualParentPath(file.path);
        return parentDirectory === null || !selectedFolderPaths.has(parentDirectory);
    });
}
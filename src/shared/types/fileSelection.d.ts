export interface SelectedFile {
    name: string;
    path: string;
    actualPath: string;
    isDir: boolean;
    ext: string;
    size: number;
}


export interface HandleFileOptions {
    currentPath?: string;
    includeSubfolders: boolean;
    documents: boolean;
    audio: boolean;
    video: boolean;
    pictures: boolean;
    programs: boolean;
    others: boolean;
    maxSize: number;
}

export interface FileSelectionOptions {
    newChunk: boolean;
    chunkName: string;
    includeSubFolders: boolean;
    maxSize: number;
    documents: boolean;
    audio: boolean;
    video: boolean;
    pictures: boolean;
    programs: boolean;
    others: boolean;
}

export interface SelectedFilesState {
    options: FileSelectionOptions;
    fileCount: number;
    totalSize: number;
}
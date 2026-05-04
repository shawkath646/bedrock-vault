export interface SelectedFile {
    name: string;
    path: string;
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
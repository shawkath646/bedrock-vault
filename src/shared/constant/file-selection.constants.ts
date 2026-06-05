import type { FileSelectionOptions } from "@shared/types/fileSelection";

export const defaultOptions: FileSelectionOptions = {
    chunkName: "",
    includeSubFolders: true,
    maxSize: 0,
    audio: true,
    documents: true,
    others: true,
    pictures: true,
    programs: true,
    video: true,
};
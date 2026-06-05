import { useCallback, useMemo, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import logger from "../../lib/logger";
import {
    DialogRoot,
    DialogPortal,
    DialogBackdrop,
    DialogPopup,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@renderer/components/ui/dialog"
import { formatSize } from "@renderer/lib/formatSize";
import type { HandleFileOptions, SelectedFile } from "@shared/types/fileSelection";
import type { FileSelectionOptions } from "@shared/types/fileSelection";
import { AnimatePresence, motion } from "framer-motion";
import {
    UploadCloud,
    ArrowLeft,
    Loader2,
    X,
    Plus,
    FolderPlus,
    Trash2
} from 'lucide-react';
import GetFileIcon from "@/lib/getFileIcon";

interface FileSelectionProps {
    files: SelectedFile[];
    setFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
    setMetadata: React.Dispatch<React.SetStateAction<{ totalSize: number; fileCount: number }>>;
    options: FileSelectionOptions;
    hasFiles: boolean;
}

export default function FileSelection({
    files,
    setFiles,
    setMetadata,
    options,
    hasFiles
}: FileSelectionProps) {
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [currentPathItems, setCurrentPathItems] = useState<SelectedFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCleanupDialog, setShowCleanupDialog] = useState(false);

    const getParentPath = (targetPath: string): string | null => {
        const normalized = targetPath.replace(/\/+$/, '');
        if (normalized === '' || normalized === '/') return null;

        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash <= 0 ? null : normalized.substring(0, lastSlash);
    };

    const sortSelectedItems = useCallback((items: SelectedFile[]): SelectedFile[] => {
        return [...items].sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    }, []);

    const visibleItems = useMemo(() => {
        return currentPath ? currentPathItems : sortSelectedItems(files);
    }, [currentPath, currentPathItems, files, sortSelectedItems]);

    const buildHandleOptions = useCallback((targetPath?: string): HandleFileOptions => ({
        currentPath: targetPath,
        includeSubfolders: options.includeSubFolders,
        documents: options.documents,
        audio: options.audio,
        video: options.video,
        pictures: options.pictures,
        programs: options.programs,
        others: options.others,
        maxSize: options.maxSize > 0 ? options.maxSize * 1024 * 1024 : Number.MAX_SAFE_INTEGER,
    }), [options]);

    const refreshFromBackend = useCallback(async () => {
        const [backendState, rootItems] = await Promise.all([
            window.fileSelection.getState(),
            window.fileSelection.getCurrentPathFiles(null)
        ]);

        setMetadata({ fileCount: backendState.fileCount, totalSize: backendState.totalSize });
        setFiles(sortSelectedItems(rootItems));

        if (currentPath) {
            const nextItems = await window.fileSelection.getCurrentPathFiles(currentPath);
            setCurrentPathItems(sortSelectedItems(nextItems));
        } else {
            setCurrentPathItems([]);
        }
    }, [currentPath, setFiles, setMetadata, sortSelectedItems]);

    const yieldToPaint = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    const runWithLoading = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
        setIsLoading(true);
        try {
            await yieldToPaint();
            return await operation();
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleAddFiles = async () => {
        void logger.info("FileSelection", "User clicked Add Files button");
        await runWithLoading(async () => {
            await window.fileSelection.addFiles(buildHandleOptions(currentPath ?? undefined));
            await refreshFromBackend();
        });
    };

    const handleAddFolder = async () => {
        void logger.info("FileSelection", "User clicked Add Folder button");
        await runWithLoading(async () => {
            await window.fileSelection.addFolder(buildHandleOptions(currentPath ?? undefined));
            await refreshFromBackend();
        });
    };

    const openFolder = async (folderPath: string) => {
        await runWithLoading(async () => {
            const items = await window.fileSelection.getCurrentPathFiles(folderPath);
            setCurrentPath(folderPath);
            setCurrentPathItems(sortSelectedItems(items));
        });
    };

    const goBack = async () => {
        if (!currentPath) return;

        await runWithLoading(async () => {
            const parentPath = getParentPath(currentPath);

            if (parentPath === null) {
                setCurrentPath(null);
                setCurrentPathItems([]);
                return;
            }

            const items = await window.fileSelection.getCurrentPathFiles(parentPath);
            setCurrentPath(parentPath);
            setCurrentPathItems(sortSelectedItems(items));
        });
    };

    const removeFile = async (file: SelectedFile) => {
        void logger.info("FileSelection", `Removing item: ${file.path}`);
        await window.fileSelection.removeItem(file.path);
        await refreshFromBackend();
    };

    const clearFiles = async () => {
        void logger.warn("FileSelection", "Clearing all selected items");
        await window.fileSelection.clearAll();
        await refreshFromBackend();
    };

    return (
        <div className="space-y-1 mt-6">
            <div className="flex items-center justify-between gap-8 py-1">
                <h2 className="text-lg font-semibold text-nowrap">Target Files</h2>

                <motion.p
                    key={currentPath}
                    initial={{ opacity: 0, width: 0, x: -10 }}
                    animate={{ opacity: 1, width: "auto", x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-muted-foreground text-xs overflow-hidden whitespace-nowrap text-ellipsis [direction:rtl]"
                >
                    {currentPath || "[root]"}
                </motion.p>

                <div className="flex gap-2">
                    {currentPath && (
                        <Button variant="outline" size="sm" onClick={() => void goBack()}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go Back
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => void handleAddFiles()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Files
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleAddFolder()}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Add Folder
                    </Button>
                    {hasFiles && (
                        <Button variant="outline" size="sm" onClick={() => setShowCleanupDialog(true)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cleanup
                        </Button>
                    )}
                </div>
            </div>

            <div className="relative flex-1 flex flex-col duration-200 h-100 mb-3">
                {visibleItems.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center flex-1 p-12 text-center h-full">
                        <UploadCloud className="w-5 h-5 text-muted-foreground mb-2" />
                        <h3 className="text-muted-foreground mb-1 text-sm">No files selected.</h3>
                    </div>
                ) : (
                    <ScrollArea className="h-full w-full rounded-md relative">
                        <div className="grid grid-cols-2 gap-2">
                            <AnimatePresence initial={false}>
                                {visibleItems.map((file) => (
                                    <motion.div
                                        key={file.path}
                                        layout
                                        exit={{ opacity: 0, y: -12, scale: 0.98 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                        className="flex items-center justify-between p-3 bg-background border rounded-lg group hover:border-primary/50 transition-colors"
                                        onDoubleClick={() => {
                                            if (file.isDir && !isLoading) {
                                                void openFolder(file.path);
                                            } else {
                                                window.appWindow.openPathWithSysApp(file.actualPath)
                                            }
                                        }}
                                    >
                                        <div className="flex items-center space-x-3 overflow-hidden">
                                            <GetFileIcon ext={file.isDir ? "dir" : file.ext} />
                                            <div className="truncate">
                                                <p className="text-sm font-medium truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{file.isDir ? 'Folder' : formatSize(file.size)}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                            disabled={isLoading}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void removeFile(file);
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                )}

                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading files...
                        </div>
                    </div>
                )}
            </div>

            <DialogRoot open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
                <DialogPortal>
                    <DialogBackdrop />
                    <DialogPopup>
                        <DialogTitle>Clear all files?</DialogTitle>
                        <DialogDescription>
                            This will remove all selected files from the list. This action cannot be undone.
                        </DialogDescription>
                        <div className="mt-5 flex justify-end gap-2">
                            <DialogClose className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
                                Cancel
                            </DialogClose>
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
                                onClick={() => void clearFiles()}
                            >
                                Clear All
                            </DialogClose>
                        </div>
                    </DialogPopup>
                </DialogPortal>
            </DialogRoot>
        </div>
    );
}
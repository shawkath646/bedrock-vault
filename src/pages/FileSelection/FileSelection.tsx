import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatSize } from "@/lib/formatSize";
import type { HandleFileOptions, SelectedFile } from "@shared/types/fileSelection";
import type { FileSelectionOptions } from "./values";
import { AnimatePresence, motion } from "framer-motion";
import {
    UploadCloud,
    FileText,
    FileImage,
    FileAudio2,
    FileVideo,
    FileArchive,
    FileCode2,
    FileSpreadsheet,
    Folder,
    FolderOpen,
    ArrowLeft,
    X,
    Plus,
    FolderPlus,
    Trash2
} from 'lucide-react';


export default function FileSelection({
    files,
    setFiles,
    options
}: {
    files: SelectedFile[];
    setFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
    options: FileSelectionOptions;
}) {
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [currentPathItems, setCurrentPathItems] = useState<SelectedFile[]>([]);

    const getParentPath = (targetPath: string): string => {
        const normalized = targetPath.replace(/[\\/]+$/, '');
        const parent = normalized.replace(/[\\/][^\\/]+$/, '');
        return parent;
    };

    const sortSelectedItems = (items: SelectedFile[]): SelectedFile[] => {
        return [...items].sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    };

    const rootItems = useMemo(() => {
        const dirPaths = new Set(files.filter((item) => item.isDir).map((item) => item.path));
        const visibleAtRoot = files.filter((item) => !dirPaths.has(getParentPath(item.path)));
        return sortSelectedItems(visibleAtRoot);
    }, [files]);

    const visibleItems = currentPath ? sortSelectedItems(currentPathItems) : rootItems;

    const buildHandleOptions = (targetPath?: string): HandleFileOptions => ({
        currentPath: targetPath,
        includeSubfolders: options.includeSubFolders,
        documents: options.documents,
        audio: options.audio,
        video: options.video,
        pictures: options.pictures,
        programs: options.programs,
        others: options.others,
        maxSize: options.maxSize > 0 ? options.maxSize * 1024 * 1024 : Number.MAX_SAFE_INTEGER,
    });

    const refreshFromBackend = async () => {
        const { items } = await window.api.getAllSelectedItems();
        setFiles(items);

        if (currentPath) {
            const nextItems = await window.api.getCurrentPathFiles(currentPath);
            setCurrentPathItems(sortSelectedItems(nextItems));
        }
    };

    const handleAddFiles = async () => {
        await window.api.addFiles(buildHandleOptions(currentPath ?? undefined));
        await refreshFromBackend();
    };

    const handleAddFolder = async () => {
        await window.api.addFolder(buildHandleOptions(currentPath ?? undefined));
        await refreshFromBackend();
    };

    const openFolder = async (folderPath: string) => {
        const items = await window.api.getCurrentPathFiles(folderPath);
        setCurrentPath(folderPath);
        setCurrentPathItems(sortSelectedItems(items));
    };

    const goBack = async () => {
        if (!currentPath) return;

        const parentPath = getParentPath(currentPath);
        const hasParentFolder = files.some((item) => item.isDir && item.path === parentPath);

        if (!hasParentFolder) {
            setCurrentPath(null);
            setCurrentPathItems([]);
            return;
        }

        const items = await window.api.getCurrentPathFiles(parentPath);
        setCurrentPath(parentPath);
        setCurrentPathItems(sortSelectedItems(items));
    };

    const removeFile = async (file: SelectedFile) => {
        await window.api.removeItem(file.path);
        await refreshFromBackend();
    };

    const clearFiles = async () => {
        setFiles([]);
        setCurrentPath(null);
        setCurrentPathItems([]);
        await window.api.clearSelectedItems();
    };

    const getItemIcon = (file: SelectedFile) => {
        if (file.isDir) {
            return currentPath === file.path
                ? <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                : <Folder className="w-5 h-5 text-amber-500 shrink-0" />;
        }

        const ext = file.ext.toLowerCase();
        const baseClass = 'w-5 h-5 shrink-0';

        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return <FileImage className={`${baseClass} text-sky-500`} />;
        if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) return <FileAudio2 className={`${baseClass} text-purple-500`} />;
        if (['.mp4', '.mkv', '.avi', '.mov', '.wmv'].includes(ext)) return <FileVideo className={`${baseClass} text-rose-500`} />;
        if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return <FileArchive className={`${baseClass} text-orange-500`} />;
        if (['.xlsx', '.csv'].includes(ext)) return <FileSpreadsheet className={`${baseClass} text-emerald-500`} />;
        if (['.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.go', '.java', '.cpp', '.c', '.rs', '.sh', '.bat'].includes(ext)) return <FileCode2 className={`${baseClass} text-indigo-500`} />;

        return <FileText className={`${baseClass} text-primary`} />;
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 py-2">
                <h2 className="text-lg font-semibold">Target Files</h2>

                <div className="flex gap-2">
                    {currentPath ? (
                        <Button variant="outline" size="sm" onClick={() => void goBack()}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go Back
                        </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => void handleAddFiles()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Files
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleAddFolder()}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Add Folder
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void clearFiles()}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Cleanup
                    </Button>
                </div>
            </div>

            {/* Dropzone / File List Area */}
            <Card className="flex-1 flex flex-col border-dashed border-2 border-muted-foreground/25 bg-muted/10 hover:bg-muted/20 transition-colors duration-200 h-90 mb-3">
                {visibleItems.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center flex-1 p-12 text-center h-full">
                        <div className="bg-background p-4 rounded-full border shadow-sm mb-4">
                            <UploadCloud className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">No files selected</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">
                            Click the button below to browse your files for encrypt.
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => void handleAddFiles()}>Browse Files</Button>
                            <Button variant="outline" onClick={() => void handleAddFolder()}>Browse Folders</Button>
                        </div>
                    </div>
                ) : (
                    // Populated State
                    <ScrollArea className="h-full w-full rounded-md px-2">
                        <div className="space-y-1">
                            <AnimatePresence initial={false}>
                                {visibleItems.map((file) => (
                                    <motion.div
                                        key={file.path}
                                        layout
                                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -12, scale: 0.98 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                        className="flex items-center justify-between p-3 bg-background border rounded-lg group hover:border-primary/50 transition-colors"
                                        onDoubleClick={() => {
                                            if (file.isDir) {
                                                void openFolder(file.path);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center space-x-3 overflow-hidden">
                                            {getItemIcon(file)}
                                            <div className="truncate">
                                                <p className="text-sm font-medium truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{file.isDir ? 'Folder' : formatSize(file.size)}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
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
            </Card>
        </div>
    );
}
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { List } from "react-window";
import {
    Plus,
    Minus,
    FolderDown,
    Key,
    Trash2,
    ArrowLeft,
    Loader2
} from "lucide-react";
import type { DecryptedFileEntry } from "@shared/types/file-decryption";
import GetFileIcon from "@/lib/getFileIcon";
import { formatSize } from "@renderer/lib/formatSize";

interface DecryptedFilesViewProps {
    decryptedFiles: DecryptedFileEntry[];
}

const COLUMNS = 3;

interface RowProps {
    items: DecryptedFileEntry[];
    isLoading: boolean;
    openFolder: (folderPath: string) => void;
    onOpenFile: (filePath: string) => void;
}

const Row = ({
    index,
    style,
    items,
    openFolder,
    onOpenFile,
}: {
    index: number;
    style: React.CSSProperties;
} & RowProps) => {
    const startIndex = index * COLUMNS;
    const rowItems = items.slice(startIndex, startIndex + COLUMNS);

    return (
        <div style={style} className="flex gap-3 pb-3">
            {rowItems.map((file) => (
                <div
                    key={file.virtualPath}
                    className="flex-1 min-w-0 flex items-center justify-between p-3 bg-background border border-border/70 rounded-lg group hover:border-primary/50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
                    onDoubleClick={() => {
                        if (file.isDir) {
                            openFolder(file.virtualPath);
                        } else {
                            onOpenFile(file.virtualPath);
                        }
                    }}
                >
                    <div className="flex items-center space-x-3 overflow-hidden mr-2">
                        <GetFileIcon ext={file.isDir ? "dir" : file.ext} />
                        <div className="truncate">
                            <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                                {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {file.isDir ? null : formatSize(file.size)}
                            </p>
                        </div>
                    </div>

                    {!file.isDir && (
                        <div className="shrink-0">
                            {!file.isAvailable ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    Unavailable
                                </span>
                            ) : null}
                        </div>
                    )}
                </div>
            ))}
            {rowItems.length < COLUMNS &&
                Array.from({ length: COLUMNS - rowItems.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex-1 opacity-0 pointer-events-none" />
                ))}
        </div>
    );
};

export default function DecryptedFilesView({
    decryptedFiles: initialFiles,
}: DecryptedFilesViewProps) {
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [currentPathItems, setCurrentPathItems] = useState<DecryptedFileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const openingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerHeight, setContainerHeight] = useState(500);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Compensate for padding (16px top/bottom)
                const measuredHeight = entry.contentRect.height - 32;
                setContainerHeight(measuredHeight > 0 ? measuredHeight : 500);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const getParentPath = (targetPath: string): string | null => {
        const normalized = targetPath.replace(/\/+$/, '');
        if (normalized === '' || normalized === '/') return null;

        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash <= 0 ? null : normalized.substring(0, lastSlash);
    };

    const sortItems = useCallback((items: DecryptedFileEntry[]): DecryptedFileEntry[] => {
        return [...items].sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    }, []);

    const sortedInitialFiles = useMemo(() => sortItems(initialFiles), [initialFiles, sortItems]);

    const visibleItems = useMemo(() => {
        return currentPath ? currentPathItems : sortedInitialFiles;
    }, [currentPath, currentPathItems, sortedInitialFiles]);

    const openFolder = useCallback(async (folderPath: string) => {
        if (isLoading || folderPath === currentPath) return;

        setIsLoading(true);
        try {
            const items = await window.decryption.getCurrentPathFiles(folderPath);
            setCurrentPath(folderPath);
            setCurrentPathItems(sortItems(items));
        } catch (err) {
            console.error("Failed to open folder:", err);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, currentPath, sortItems]);

    const handleOpenFile = useCallback(async (virtualPath: string) => {
        if (openingRef.current) return;
        openingRef.current = true;
        setIsLoading(true);
        try {
            await window.decryption.openVaultFile(virtualPath);
        } catch (err) {
            console.error("Failed to open file:", err);
        } finally {
            openingRef.current = false;
            setIsLoading(false);
        }
    }, []);

    const goBack = async () => {
        if (!currentPath || isLoading) return;

        setIsLoading(true);
        try {
            const parentPath = getParentPath(currentPath);

            if (parentPath === null) {
                setCurrentPath(null);
                setCurrentPathItems([]);
                return;
            }

            const items = await window.decryption.getCurrentPathFiles(parentPath);
            setCurrentPath(parentPath);
            setCurrentPathItems(sortItems(items));
        } catch (err) {
            console.error("Failed to go back:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const navigateToBreadcrumb = async (index: number) => {
        if (!currentPath || isLoading) return;

        const segments = currentPath.split('/').filter(Boolean);

        const isAbsolute = currentPath.startsWith('/');
        const targetPath = (isAbsolute ? '/' : '') + segments.slice(0, index + 1).join('/');

        if (targetPath === currentPath) return;

        setIsLoading(true);
        try {
            const items = await window.decryption.getCurrentPathFiles(targetPath);
            setCurrentPath(targetPath);
            setCurrentPathItems(sortItems(items));
        } catch (err) {
            console.error("Failed to navigate to path:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const navigateToRoot = async () => {
        if (currentPath === null || isLoading) return;

        setIsLoading(true);
        try {
            setCurrentPath(null);
            setCurrentPathItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

    const rowCount = Math.ceil(visibleItems.length / COLUMNS);

    return (
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-4 overflow-hidden">
            {/* Toolbar with disabled features */}
            <div className="flex items-center justify-between gap-2 p-2 bg-muted/20 border border-border/50 rounded-md shrink-0">
                <Button variant="outline" size="sm" disabled>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Files
                </Button>
                <Button variant="outline" size="sm" disabled>
                    <Minus className="w-4 h-4 mr-2" />
                    Remove Files
                </Button>
                <Button variant="outline" size="sm" disabled>
                    <FolderDown className="w-4 h-4 mr-2" />
                    Extract all files
                </Button>
                <Button variant="outline" size="sm" disabled>
                    <Key className="w-4 h-4 mr-2" />
                    Rotate keys
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Chunks
                </Button>
            </div>

            {/* Navigation and Breadcrumbs header */}
            <div className="flex items-center justify-between gap-4 py-2 border-b border-border/50 shrink-0">
                <div className="flex items-center space-x-2 overflow-hidden text-sm">
                    {currentPath && (
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => void goBack()}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    )}
                    <div className="flex items-center space-x-1.5 text-muted-foreground font-medium select-none truncate">
                        <span
                            className={`hover:text-foreground cursor-pointer transition-colors ${!currentPath ? 'text-foreground font-semibold' : ''}`}
                            onClick={() => void navigateToRoot()}
                        >
                            root
                        </span>
                        {pathSegments.map((segment, idx) => (
                            <div key={idx} className="flex items-center space-x-1.5">
                                <span className="text-muted-foreground/50">/</span>
                                <span
                                    className={`hover:text-foreground cursor-pointer transition-colors max-w-28 truncate ${idx === pathSegments.length - 1 ? 'text-foreground font-semibold' : ''}`}
                                    onClick={() => void navigateToBreadcrumb(idx)}
                                >
                                    {segment}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full select-none shrink-0">
                    {visibleItems.length} items
                </span>
            </div>

            {/* File & Folder Grid Explorer */}
            <div ref={containerRef} className="relative flex-1 min-h-0 rounded-md border border-border/50 bg-card/30 shadow-sm overflow-hidden p-4">
                {visibleItems.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                        <FolderDown className="w-8 h-8 text-muted-foreground/60 mb-2" />
                        <h3 className="text-muted-foreground text-sm font-medium">This folder is empty.</h3>
                    </div>
                ) : visibleItems.length < 150 ? (
                    <div className="h-full overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {visibleItems.map((file) => (
                                <div
                                    key={file.virtualPath}
                                    className="flex items-center justify-between p-3 bg-background border border-border/70 rounded-lg group hover:border-primary/50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
                                    onDoubleClick={async () => {
                                        if (openingRef.current) return;
                                        if (file.isDir && !isLoading) {
                                            void openFolder(file.virtualPath);
                                        } else if (!file.isDir && !isLoading) {
                                            openingRef.current = true;
                                            setIsLoading(true);
                                            try {
                                                await window.decryption.openVaultFile(file.virtualPath);
                                            } catch (err) {
                                                console.error("Failed to open file:", err);
                                            } finally {
                                                openingRef.current = false;
                                                setIsLoading(false);
                                            }
                                        }
                                    }}
                                >
                                    <div className="flex items-center space-x-3 overflow-hidden mr-2">
                                        <GetFileIcon ext={file.isDir ? "dir" : file.ext} />
                                        <div className="truncate">
                                            <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {file.isDir ? null : formatSize(file.size)}
                                            </p>
                                        </div>
                                    </div>

                                    {!file.isDir && (
                                        <div className="shrink-0">
                                            {!file.isAvailable ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                    Unavailable
                                                </span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <List<RowProps>
                        rowCount={rowCount}
                        rowHeight={76} // 64px card + 12px gap
                        rowComponent={Row}
                        rowProps={{
                            items: visibleItems,
                            isLoading,
                            openFolder,
                            onOpenFile: handleOpenFile,
                        }}
                        style={{ height: containerHeight, width: '100%' }}
                    />
                )}

                {/* Loading state overlay */}
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[2px] transition-all duration-200">
                        <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-md">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            Loading files...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
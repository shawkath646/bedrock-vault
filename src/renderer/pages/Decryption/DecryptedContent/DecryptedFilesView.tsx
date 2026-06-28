import { useCallback, useMemo, memo, useState, useRef, useEffect } from "react";
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
    selectedItem: string | null;
    onSelect: (path: string) => void;
}

const FileCard = memo(({
    file,
    onAction,
    disabled,
    isSelected,
    onSelect
}: {
    file: DecryptedFileEntry;
    onAction: (file: DecryptedFileEntry) => void;
    disabled?: boolean;
    isSelected: boolean;
    onSelect: (path: string) => void;
}) => {
    return (
        <div
            className={`flex-1 min-w-0 flex items-center justify-between p-3 bg-background border rounded-lg group transition-all duration-75 ease-out select-none ${
                disabled 
                    ? 'opacity-50 cursor-not-allowed border-border/70' 
                    : isSelected
                        ? 'border-primary ring-1 ring-primary bg-primary/20 shadow-sm cursor-pointer'
                        : 'border-border/70 hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm cursor-pointer'
            }`}
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onSelect(file.virtualPath);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (!disabled) onAction(file);
            }}
        >
            <div className="flex items-center space-x-3 overflow-hidden mr-2">
                <GetFileIcon ext={file.isDir ? "dir" : file.ext} />
                <div className="truncate">
                    <p className="text-sm font-medium truncate text-foreground transition-colors">
                        {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {file.isDir ? null : formatSize(file.size)}
                    </p>
                </div>
            </div>

            {!file.isDir && !file.isAvailable && (
                <div className="shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Unavailable
                    </span>
                </div>
            )}
        </div>
    );
});
FileCard.displayName = "FileCard";

const Row = ({
    index,
    style,
    ariaAttributes,
    items,
    openFolder,
    onOpenFile,
    isLoading,
    selectedItem,
    onSelect
}: {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: {
        "aria-posinset": number;
        "aria-setsize": number;
        role: "listitem";
    };
} & RowProps) => {
    const startIndex = index * COLUMNS;
    const rowItems = items.slice(startIndex, startIndex + COLUMNS);

    const handleAction = useCallback((file: DecryptedFileEntry) => {
        if (file.isDir) openFolder(file.virtualPath);
        else onOpenFile(file.virtualPath);
    }, [openFolder, onOpenFile]);

    return (
        <div style={style} {...ariaAttributes} className="flex gap-3 pb-3">
            {rowItems.map((file) => (
                <FileCard
                    key={file.virtualPath}
                    file={file}
                    onAction={handleAction}
                    disabled={isLoading}
                    isSelected={selectedItem === file.virtualPath}
                    onSelect={onSelect}
                />
            ))}
            {rowItems.length < COLUMNS &&
                Array.from({ length: COLUMNS - rowItems.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex-1 opacity-0 pointer-events-none" />
                ))}
        </div>
    );
};
Row.displayName = "Row";


export default function DecryptedFilesView({
    decryptedFiles: initialFiles,
}: DecryptedFilesViewProps) {
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [currentPathItems, setCurrentPathItems] = useState<DecryptedFileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const openingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerHeight, setContainerHeight] = useState(500);
    
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        let frameId: number;
        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                const measuredHeight = entry.contentRect.height - 32;

                cancelAnimationFrame(frameId);
                frameId = requestAnimationFrame(() => {
                    setContainerHeight(measuredHeight > 0 ? measuredHeight : 500);
                });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => {
            resizeObserver.disconnect();
            cancelAnimationFrame(frameId);
        };
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

    const handleSelect = useCallback((path: string) => {
        setSelectedItem(prev => (prev === path ? null : path));
    }, []);

    const openFolder = useCallback(async (folderPath: string) => {
        if (isLoading || folderPath === currentPath) return;

        setIsLoading(true);
        setSelectedItem(null);
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

    const handleGridItemAction = useCallback(async (file: DecryptedFileEntry) => {
        if (openingRef.current) return;
        if (file.isDir && !isLoading) {
            void openFolder(file.virtualPath);
        } else if (!file.isDir && !isLoading) {
            void handleOpenFile(file.virtualPath);
        }
    }, [isLoading, openFolder, handleOpenFile]);

    const goBack = async () => {
        if (!currentPath || isLoading) return;

        setIsLoading(true);
        setSelectedItem(null);
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
        setSelectedItem(null);
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
        setSelectedItem(null);
        try {
            setCurrentPath(null);
            setCurrentPathItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    const memoizedRowProps = useMemo(() => ({
        items: visibleItems,
        isLoading,
        openFolder,
        onOpenFile: handleOpenFile,
        selectedItem,
        onSelect: handleSelect
    }), [visibleItems, isLoading, openFolder, handleOpenFile, selectedItem, handleSelect]);

    const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];
    const rowCount = Math.ceil(visibleItems.length / COLUMNS);

    const hasSelection = selectedItem !== null;

    return (
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-2 overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-2 bg-muted/20 border border-border/50 rounded-md shrink-0">
                <Button variant="outline" size="sm" disabled={isLoading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Files
                </Button>
                {/* These buttons rely on a file being selected */}
                <Button variant="outline" size="sm" disabled={!hasSelection || isLoading}>
                    <Minus className="w-4 h-4 mr-2" />
                    Remove Item
                </Button>
                <Button variant="outline" size="sm" disabled={!hasSelection || isLoading}>
                    <FolderDown className="w-4 h-4 mr-2" />
                    Extract Item
                </Button>
                <Button variant="outline" size="sm" disabled={!hasSelection || isLoading}>
                    <Key className="w-4 h-4 mr-2" />
                    Rotate keys
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive" 
                    disabled={!hasSelection || isLoading}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Chunk
                </Button>
            </div>

            {/* Navigation and Breadcrumbs */}
            <div className="flex items-center justify-between gap-4 py-2 border-b border-border/50 shrink-0">
                <div className="flex items-center space-x-2 overflow-hidden text-xs">
                    <div className="w-7 h-7">
                        {currentPath && (
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => void goBack()}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-muted-foreground select-none truncate cursor-pointer">
                        <span className="hover:text-foreground transition-colors" onClick={() => void navigateToRoot()}>
                            root
                        </span>
                        {pathSegments.map((segment, idx) => (
                            <div key={idx} className="flex items-center space-x-1.5">
                                <span>/</span>
                                <span className="hover:text-foreground transition-colors" onClick={() => void navigateToBreadcrumb(idx)}>
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
            <div 
                ref={containerRef} 
                className="relative flex-1 min-h-0 overflow-hidden"
                onClick={() => setSelectedItem(null)}
            >
                {visibleItems.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center pointer-events-none">
                        <FolderDown className="w-8 h-8 text-muted-foreground/60 mb-2" />
                        <h3 className="text-muted-foreground text-sm font-medium">This folder is empty.</h3>
                    </div>
                ) : visibleItems.length < 150 ? (
                    <div className="h-full overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {visibleItems.map((file) => (
                                <FileCard
                                    key={file.virtualPath}
                                    file={file}
                                    onAction={handleGridItemAction}
                                    isSelected={selectedItem === file.virtualPath}
                                    onSelect={handleSelect}
                                    disabled={isLoading}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <List<RowProps>
                        rowCount={rowCount}
                        rowHeight={76}
                        rowComponent={Row}
                        rowProps={memoizedRowProps}
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
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FolderOpen, Plus, Minus, FolderDown, Key, Trash2 } from "lucide-react";
import type { DecryptedFileEntry } from "@shared/types/fileEncryption";

function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

interface DecryptedFilesViewProps {
    decryptedFiles: DecryptedFileEntry[];
    handleSelectFolderToDecrypt: () => void;
}

export default function DecryptedFilesView({
    decryptedFiles,
    handleSelectFolderToDecrypt,
}: DecryptedFilesViewProps) {
    return (
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-4 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Toolbar with demo placeholders */}
            <div className="flex items-center gap-5 p-2 bg-muted/20 border border-border/50 rounded-md shrink-0">
                <div className="flex flex-wrap gap-2 w-[85%]">
                    <Button variant="outline" size="sm" onClick={() => alert("Demo: Add Files Clicked")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Files
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => alert("Demo: Remove Files Clicked")}>
                        <Minus className="w-4 h-4 mr-2" />
                        Remove Files
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => alert("Demo: Extract All Files Clicked")}>
                        <FolderDown className="w-4 h-4 mr-2" />
                        Extract all files
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => alert("Demo: Rotate Keys Clicked")}>
                        <Key className="w-4 h-4 mr-2" />
                        Rotate keys
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => alert("Demo: Delete Chunks Clicked")}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Chunks
                    </Button>
                </div>
                <Button onClick={handleSelectFolderToDecrypt} size="lg">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Select Another Folder
                </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border border-border/50 bg-card shadow-sm overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead>File Name</TableHead>
                            <TableHead>Virtual Path</TableHead>
                            <TableHead className="w-40">Size</TableHead>
                            <TableHead className="w-40 text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {decryptedFiles.map((file, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium text-foreground">
                                    {file.name}
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-50" title={file.virtualPath}>
                                    {file.virtualPath}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {formatBytes(file.size)}
                                </TableCell>
                                <TableCell className="text-right">
                                    {file.isAvailable ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            Available
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                            Unavailable
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

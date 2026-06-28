import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FolderOpen, Unlock, Plus, Trash2 } from "lucide-react";
import type { EncryptionRecord } from "@shared/types/file-decryption";

interface EncryptedRecordsViewProps {
    records: EncryptionRecord[];
    handleSelectFolderToDecrypt: () => void;
    handleAddRecord: () => void;
    onRemoveRecord: (record: EncryptionRecord) => void;
}

export default function EncryptedRecordsView({
    records,
    handleSelectFolderToDecrypt,
    handleAddRecord,
    onRemoveRecord,
}: EncryptedRecordsViewProps) {
    const navigate = useNavigate();

    return (
        <div className="w-full h-full flex flex-col space-y-4 overflow-hidden select-none">
            <div className="flex justify-end items-center shrink-0 gap-2">
                <Button onClick={handleSelectFolderToDecrypt} size="lg" className="cursor-pointer">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Open Folder
                </Button>
                <Button onClick={handleAddRecord} variant="secondary" size="lg" className="cursor-pointer">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Record
                </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-60">Chunk Name</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead className="w-24">Level</TableHead>
                            <TableHead className="w-36">Timestamp</TableHead>
                            <TableHead className="text-right w-48">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium text-foreground">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate max-w-40" title={record.chunkName}>
                                            {record.chunkName}
                                        </span>
                                        {!record.isAvailable && (
                                            <Badge variant="destructive" className="text-[9px] py-0 px-1.5 uppercase font-semibold">
                                                Unavailable
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-50" title={record.path}>
                                    {record.path}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs font-medium">
                                    {record.encryptionLevel ? `Lvl ${record.encryptionLevel}` : 'N/A'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {new Date(record.timestamp).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            onClick={() => onRemoveRecord(record)}
                                            className="cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => navigate(`/decryption/decrypted-content?directory=${encodeURIComponent(record.path)}`)}
                                            disabled={!record.isAvailable}
                                            className="cursor-pointer"
                                        >
                                            <Unlock className="w-4 h-4 mr-2" />
                                            Unlock
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

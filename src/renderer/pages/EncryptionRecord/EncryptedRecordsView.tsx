import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FolderOpen, Unlock } from "lucide-react";
import type { EncryptionRecord } from "@shared/types/fileEncryption";

interface EncryptedRecordsViewProps {
    records: EncryptionRecord[];
    handleSelectFolderToDecrypt: () => void;
}

export default function EncryptedRecordsView({
    records,
    handleSelectFolderToDecrypt,
}: EncryptedRecordsViewProps) {

    const navigate = useNavigate();


    return (
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-4 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex justify-between items-center shrink-0">
                <h2 className="text-xl font-semibold tracking-tight">Encrypted Records</h2>
                <Button onClick={handleSelectFolderToDecrypt} size="lg">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Select Folder
                </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border border-border/50 bg-card shadow-sm overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-62.5">Chunk Name</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead className="w-45">Timestamp</TableHead>
                            <TableHead className="text-right w-30">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium text-foreground">
                                    {record.chunkName}
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-50" title={record.path}>
                                    {record.path}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {new Date(record.timestamp).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        size="sm" 
                                        variant="secondary"
                                        onClick={() => navigate(`/encrypted-content?directory=${encodeURIComponent(record.path)}`)}
                                    >
                                        <Unlock className="w-4 h-4 mr-2" />
                                        Open
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

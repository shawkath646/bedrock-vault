import { useNavigate } from "react-router-dom";
import TitleBar from "@/components/navigation/Titlebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, FolderOpen, Plus, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import type { EncryptionRecord } from "@shared/types/file-decryption";
import EncryptedRecordsView from "./EncryptedRecordsView";
import { Label } from "@/components/ui/label";
import {
    DialogRoot,
    DialogPortal,
    DialogBackdrop,
    DialogPopup,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog";

export default function EncryptionRecordPage() {
    const [records, setRecords] = useState<EncryptionRecord[]>([]);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [recordToRemove, setRecordToRemove] = useState<EncryptionRecord | null>(null);
    const [removePermanently, setRemovePermanently] = useState(false);
    const navigate = useNavigate();

    const loadRecords = () => {
        window.encryptionRecord.getRecords()
            .then(setRecords)
            .catch(err => console.error("Failed to load records:", err));
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleSelectFolderToDecrypt = async () => {
        try {
            const selectedPath = await window.encryptionOptions.selectOutputPath();
            if (selectedPath) {
                navigate(`/decrypted-content?directory=${encodeURIComponent(selectedPath)}`);
            }
        } catch (err) {
            console.error("Error selecting output path:", err);
        }
    };

    const handleAddRecord = async () => {
        try {
            const newRecord = await window.encryptionRecord.addRecord();
            if (newRecord) {
                loadRecords();
            }
        } catch (err: unknown) {
            console.error("Failed to add record:", err);
            if (String(err).includes("NO_METADATA_FILE")) {
                alert("No metadata file 'v' was found in the selected folder. Please choose a valid encrypted folder.");
            } else {
                alert("Failed to add record. The folder might already be registered or is invalid.");
            }
        }
    };

    const handleRemoveClick = (record: EncryptionRecord) => {
        setRecordToRemove(record);
        setRemovePermanently(false);
        setShowRemoveConfirm(true);
    };

    const handleConfirmRemove = async () => {
        if (!recordToRemove) return;
        try {
            await window.encryptionRecord.removeRecord(recordToRemove.path, removePermanently);
            loadRecords();
        } catch (err) {
            console.error("Failed to remove record:", err);
            alert("Failed to remove record.");
        } finally {
            setShowRemoveConfirm(false);
            setRecordToRemove(null);
        }
    };

    return (
        <div className="flex h-full flex-col bg-background pb-2 select-none">
            <TitleBar
                component={
                    <div className="flex items-center space-x-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                            onClick={() => navigate("/")}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <Settings className="w-5 h-5" />
                            </div>
                            <h1 className="font-semibold tracking-tight text-foreground max-w-60 truncate">
                                Encryption Records
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 min-h-0 flex flex-col px-6 py-2 overflow-hidden">
                {records.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center animate-in fade-in-50 duration-500">
                        <div className="flex flex-col items-center max-w-sm text-center space-y-4">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-2 shadow-sm border border-border/50">
                                <FolderOpen className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold tracking-tight text-foreground">
                                No records found
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Start by opening a protected folder or adding folders to your records.
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                                <Button onClick={handleSelectFolderToDecrypt} size="lg" className="cursor-pointer">
                                    <FolderOpen className="w-4 h-4 mr-2" />
                                    Open folder
                                </Button>
                                <Button onClick={handleAddRecord} variant="secondary" size="lg" className="cursor-pointer">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add record
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <EncryptedRecordsView
                        records={records}
                        handleSelectFolderToDecrypt={handleSelectFolderToDecrypt}
                        handleAddRecord={handleAddRecord}
                        onRemoveRecord={handleRemoveClick}
                    />
                )}
            </div>

            <DialogRoot open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
                <DialogPortal>
                    <DialogBackdrop />
                    <DialogPopup>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            Remove Record
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-2">
                            Are you sure you want to remove the record for <span className="font-semibold text-foreground">{recordToRemove?.chunkName}</span>?
                        </DialogDescription>
                        <div className="mt-4 flex items-center space-x-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                            <input
                                type="checkbox"
                                id="delete-permanently"
                                checked={removePermanently}
                                onChange={(e) => setRemovePermanently(e.target.checked)}
                                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
                            />
                            <Label htmlFor="delete-permanently" className="text-xs font-normal text-gray-900 dark:text-gray-100 cursor-pointer">
                                Remove encrypted files permanently
                            </Label>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                                Cancel
                            </DialogClose>
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    void handleConfirmRemove();
                                }}
                            >
                                Remove
                            </DialogClose>
                        </div>
                    </DialogPopup>
                </DialogPortal>
            </DialogRoot>
        </div>
    );
}

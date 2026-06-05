import { useNavigate } from "react-router-dom";
import TitleBar from "@/components/navigation/Titlebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import type { EncryptionRecord } from "@shared/types/fileEncryption";
import EncryptedRecordsView from "./EncryptedRecordsView";

export default function EncryptionRecordPage() {
    const [records, setRecords] = useState<EncryptionRecord[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        window.decryptFiles.getRecords()
            .then(setRecords)
            .catch(err => console.error("Failed to load records:", err));
    }, []);

    const handleSelectFolderToDecrypt = async () => {
        try {
            const selectedPath = await window.encryptionOptions.selectOutputPath();
            if (selectedPath) {
                navigate(`/encrypted-content?directory=${encodeURIComponent(selectedPath)}`);
            }
        } catch (err) {
            console.error("Error selecting output path:", err);
        }
    };

    return (
        <div className="flex h-full flex-col bg-background pb-2">
            <TitleBar
                component={
                    <div className="flex items-center space-x-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
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
                                Decryption Records
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
                                Start by selecting a protected folder to view its content.
                            </p>
                            <Button onClick={handleSelectFolderToDecrypt} size="lg" className="mt-2">
                                <FolderOpen className="w-4 h-4 mr-2" />
                                Select folder
                            </Button>
                        </div>
                    </div>
                ) : (
                    <EncryptedRecordsView
                        records={records}
                        handleSelectFolderToDecrypt={handleSelectFolderToDecrypt}
                    />
                )}
            </div>
        </div>
    );
}

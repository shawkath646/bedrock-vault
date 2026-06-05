import { useNavigate, useSearchParams } from "react-router-dom";
import TitleBar from "@/components/navigation/Titlebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { DecryptedFileEntry } from "@shared/types/fileEncryption";
import DecryptedFilesView from "./DecryptedFilesView";

export default function EncryptedContentPage() {
    const [decryptedFiles, setDecryptedFiles] = useState<DecryptedFileEntry[] | null>(null);
    const [decryptedChunkName, setDecryptedChunkName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<{ message: string; recovery?: boolean } | null>(null);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const directoryParam = searchParams.get("directory");
    const decryptionTriggered = useRef(false);

    const handleDecryptDirectory = useCallback(async (folderPath: string) => {
        setLoading(true);
        setError(null);
        setDecryptedFiles(null);
        try {
            const res = await window.decryptFiles.encryptedDirectorySelect(folderPath);
            if (res.success) {
                setDecryptedFiles(res.files);
                setDecryptedChunkName(res.chunkName);
            } else {
                if (res.error === 'CANCELLED') {
                    navigate("/encryption-record");
                    return;
                }
                
                let msg = "An error occurred during decryption.";
                let recovery = false;

                if (res.error === 'NO_METADATA_FILE') {
                    msg = "No metadata file 'v' was found in the selected directory. Make sure you selected a valid encrypted chunk folder.";
                } else if (res.error === 'INVALID_PATH') {
                    msg = "The selected path is invalid or access was denied.";
                } else if (res.error === 'INVALID_METADATA_HEADER') {
                    msg = "The metadata file exists, but its header is invalid or corrupted.";
                } else if (res.error === 'TPM_UNAVAILABLE') {
                    msg = `TPM (or Microsoft Software KSP) is unavailable on this device. This folder was encrypted using Level ${res.level} security and requires hardware keys to decrypt.`;
                    recovery = true;
                } else if (res.error === 'PASSWORD_REQUIRED') {
                    msg = "Password is required to decrypt this directory.";
                } else if (res.error === 'INVALID_PASSWORD') {
                    msg = "Incorrect password. Please try again.";
                } else if (res.error === 'METADATA_DECRYPTION_FAILED') {
                    msg = "Metadata decryption failed. The file may be corrupted.";
                } else if (res.error === 'INVALID_METADATA_STRUCTURE') {
                    msg = "Metadata structure validation failed. The metadata is malformed.";
                } else if (res.error === 'CORRUPTED_METADATA') {
                    msg = "The metadata file is corrupted or incomplete.";
                }

                setError({ message: msg, recovery });
            }
        } catch (err) {
            console.error("Decryption error:", err);
            setError({ message: "An unexpected error occurred." });
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (directoryParam) {
            if (!decryptionTriggered.current) {
                decryptionTriggered.current = true;
                handleDecryptDirectory(directoryParam);
            }
        } else {
            navigate("/encryption-record");
        }
    }, [directoryParam, handleDecryptDirectory, navigate]);

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

    const renderContent = () => {
        if (loading) {
            return (
                <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Decrypting metadata, please wait...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="h-full flex flex-col items-center justify-center p-6 space-y-4 text-center animate-in fade-in duration-300 max-w-md mx-auto">
                    <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2 border border-destructive/20 shadow-sm">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        Decryption Failed
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {error.message}
                    </p>
                    {error.recovery && (
                        <button 
                            type="button"
                            onClick={() => alert("Recovery mode - please locate your Recovery Phrase file.")}
                            className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
                        >
                            Find a way to recovery
                        </button>
                    )}
                    <Button onClick={() => directoryParam && handleDecryptDirectory(directoryParam)} size="lg" className="mt-2">
                        Try Again
                    </Button>
                </div>
            );
        }

        if (decryptedFiles) {
            return (
                <DecryptedFilesView
                    decryptedFiles={decryptedFiles}
                    handleSelectFolderToDecrypt={handleSelectFolderToDecrypt}
                />
            );
        }

        return null;
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
                            onClick={() => navigate("/encryption-record")}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <Settings className="w-5 h-5" />
                            </div>
                            <h1 className="font-semibold tracking-tight text-foreground max-w-60 truncate">
                                Decrypt Files: {decryptedChunkName ?? ""}
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 min-h-0 flex flex-col px-6 py-2 overflow-hidden">
                {renderContent()}
            </div>
        </div>
    );
}
import { useNavigate, useSearchParams } from "react-router-dom";
import TitleBar from "@/components/navigation/Titlebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { DecryptedFileEntry, DecryptMetadataResult } from "@shared/types/file-decryption";
import DecryptedFilesView from "./DecryptedFilesView";
import { useAutoLock } from "@/hooks/useAutoLock";
import {
    DialogRoot,
    DialogPortal,
    DialogBackdrop,
    DialogPopup,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog";


const parseDecryptionError = (res: Extract<DecryptMetadataResult, { success: false }>): { message: string; recovery: boolean } => {
    let msg = "An error occurred during decryption.";
    let recovery = false;

    switch (res.error) {
        case 'NO_METADATA_FILE':
            msg = "Make sure you selected a valid encrypted chunk folder.";
            break;
        case 'INVALID_PATH':
            msg = "The selected path is invalid or access was denied.";
            break;
        case 'INVALID_METADATA_HEADER':
            msg = "The metadata file exists, but its header is invalid or corrupted.";
            break;
        case 'TPM_UNAVAILABLE':
            msg = `TPM (or Microsoft Software KSP) is unavailable on this device. This folder was encrypted using Level ${res.level} security and requires hardware keys to decrypt.`;
            recovery = true;
            break;
        case 'PASSWORD_REQUIRED':
            msg = "Password is required to decrypt this directory.";
            break;
        case 'INVALID_PASSWORD':
            msg = "Incorrect password. Please try again.";
            break;
        case 'METADATA_DECRYPTION_FAILED':
            msg = "Metadata decryption failed. The file may be corrupted.";
            break;
        case 'INVALID_METADATA_STRUCTURE':
            msg = "Metadata structure validation failed. The metadata is malformed.";
            break;
        case 'CORRUPTED_METADATA':
            msg = "The metadata file is corrupted or incomplete.";
            break;
    }

    return { message: msg, recovery };
};

export default function DecryptedContentPage() {
    const [decryptedFiles, setDecryptedFiles] = useState<DecryptedFileEntry[] | null>(null);
    const [decryptedChunkName, setDecryptedChunkName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<{ message: string; recovery?: boolean } | null>(null);
    const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const directoryParam = searchParams.get("directory");
    const decryptionTriggered = useRef(false);

    useAutoLock(decryptedFiles !== null);

    const handleGoBack = useCallback(() => {
        navigate("/decryption/encryption-record");
    }, [navigate]);

    const handleOpenRecovery = useCallback(() => {
        setShowRecoveryDialog(true);
    }, []);

    const handleDecryptDirectory = useCallback(async (folderPath: string) => {
        setLoading(true);
        setError(null);
        setDecryptedFiles(null);

        try {
            const res = await window.decryption.decryptMetadata(folderPath);

            if (res.success) {
                setDecryptedChunkName(res.chunkName);
                const rootFiles = await window.decryption.getCurrentPathFiles(null);
                setDecryptedFiles(rootFiles);
            } else {
                if (res.error === 'CANCELLED') {
                    navigate("/decryption/encryption-record");
                    return;
                }
                setError(parseDecryptionError(res));
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
            navigate("/not-found", { replace: true });
        }
    }, [directoryParam, handleDecryptDirectory, navigate]);

    const headerComponent = useMemo(() => (
        <div className="flex items-center space-x-4 py-3">
            <Button
                variant="ghost"
                size="icon"
                className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
                onClick={handleGoBack}
                aria-label="Go back"
            >
                <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center space-x-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Settings className="w-5 h-5" />
                </div>
                <h1 className="font-semibold tracking-tight text-foreground max-w-68 truncate">
                    Decrypt Files: {error ? "Error" : ""} {decryptedChunkName ?? ""}
                </h1>
            </div>
        </div>
    ), [error, decryptedChunkName, handleGoBack]);

    return (
        <div className="flex h-full flex-col bg-background pb-2">
            <TitleBar component={headerComponent} />

            <div className="flex-1 min-h-0 flex flex-col px-6 py-2 overflow-hidden">
                {loading && (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Decrypting metadata, please wait...</p>
                    </div>
                )}

                {error && (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 max-w-md mx-auto">
                        <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2 border border-destructive/20 shadow-sm">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight text-foreground mt-3">
                            Decryption Failed
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                            {error.message}
                        </p>
                        {error.recovery && (
                            <button
                                type="button"
                                onClick={handleOpenRecovery}
                                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
                            >
                                Find a way to recovery
                            </button>
                        )}
                    </div>
                )}

                {decryptedFiles && <DecryptedFilesView decryptedFiles={decryptedFiles} />}
            </div>

            <DialogRoot open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
                <DialogPortal>
                    <DialogBackdrop />
                    <DialogPopup>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <AlertCircle className="w-5 h-5" />
                            Vault Recovery
                        </DialogTitle>
                        <DialogDescription className="space-y-3 mt-3">
                            <p className="text-sm text-foreground">
                                This vault was encrypted with hardware-bound keys (TPM) which are currently unavailable or not supported on this device.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                To recover your files:
                            </p>
                            <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                                <li>Locate your <strong>recovery_phrase.txt</strong> file generated when this vault was created.</li>
                                <li>Run the Bedrock CLI recovery tool with your recovery phrase.</li>
                                <li>Or try opening this vault on the original device where it was encrypted.</li>
                            </ol>
                        </DialogDescription>
                        <div className="mt-5 flex justify-end">
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/95 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
                            >
                                Understood
                            </DialogClose>
                        </div>
                    </DialogPopup>
                </DialogPortal>
            </DialogRoot>
        </div>
    );
}
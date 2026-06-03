import { useNavigate } from "react-router-dom";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { formatSize } from "@renderer/lib/formatSize";
import { Shield, Ban, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { EncryptionProgress, EncryptionStage } from "@shared/types/fileEncryption";
import { Progress } from "@/components/ui/progress";
import { StagesViewer } from "./StagesViewer";
import GetFileIcon from "@/lib/getFileIcon";
import logger from "../../lib/logger";
import {
    DialogRoot,
    DialogPortal,
    DialogBackdrop,
    DialogPopup,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@renderer/components/ui/dialog";

export interface RenderEncryptionStages {
    progress: number;
    current: Omit<EncryptionStage, "progress">;
    completed: Omit<EncryptionStage, "progress">[];
}

export default function EncryptionProgressPage() {
    const navigate = useNavigate();
    const [timePassed, setTimePassed] = useState(0);
    const [stages, setStages] = useState<RenderEncryptionStages | null>(null);
    const [fileList, setFileList] = useState<EncryptionProgress[]>([]);
    const [showAbortConfirm, setShowAbortConfirm] = useState(false);
    const [isAborting, setIsAborting] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);
    const [outputDir, setOutputDir] = useState("");

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);

    const handleStages = useCallback((stage: EncryptionStage) => {
        const currentStage = { message: stage.message, type: stage.type };

        if (stage.type === "FAILED") void logger.error("EncryptionProgress", `Stage Failed: ${stage.message}`);
        else if (stage.type === "WARNING") void logger.warn("EncryptionProgress", `Stage Warning: ${stage.message}`);
        else if (stage.type === "ABORT") void logger.warn("EncryptionProgress", `Stage Aborted: ${stage.message}`);
        else void logger.info("EncryptionProgress", `Stage transition: ${stage.message} (${stage.progress}%)`);

        setStages(prev => ({
            progress: stage.progress,
            current: currentStage,
            completed: prev?.current ? [...(prev.completed ?? []), prev.current] : prev?.completed ?? []
        }));

        if (stage.type === "COMPLETED" || stage.type === "FAILED" || stage.type === "ABORT") {
            setTimeout(() => setShowResultModal(true), 300);
        }
    }, []);

    useEffect(() => {
        window.encryptionOptions.getOptions().then(options => {
            if (options) setOutputDir(options.fileOutputDirectory);
        });
    }, []);

    useEffect(() => {
        const unsubscribeStages = window.encryptionProgress.onStageUpdate(handleStages);
        const unsubscribeProgress = window.encryptionProgress.onProgress(setFileList);

        return () => {
            unsubscribeProgress();
            unsubscribeStages();
        };
    }, [handleStages, setFileList]);

    useEffect(() => {
        window.encryptionOptions.hasEncryptionPassword().then(hasPassword => {
            if (!hasPassword) {
                navigate("/encryption-options");
            } else {
                void logger.info("EncryptionProgress", "Starting encryption workflow execution");
                window.encryptionProgress.startEncryptionFlow();
            }
        });
    }, [navigate]);

    useEffect(() => {
        if (!stages) return;

        if (startTimeRef.current === null) {
            startTimeRef.current = Date.now();
        }

        if (!intervalRef.current && stages.progress < 100) {
            intervalRef.current = setInterval(() => {
                if (!startTimeRef.current) return;
                setTimePassed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        }

        if (stages.progress >= 100 && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setTimePassed(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));
        }

        return () => {
            if (intervalRef.current && stages.progress >= 100) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [stages]);

    const { visibleFiles, pendingCount, completedCount, failedCount } = useMemo(() => {
        let pending = 0, completed = 0, failed = 0;
        const encryptingList: EncryptionProgress[] = [];
        const completedList: EncryptionProgress[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const f = fileList[i];
            if (f.status === 'pending') pending++;
            else if (f.status === 'completed') {
                completed++;
                completedList.push(f);
            } else if (f.status === 'failed') {
                failed++;
                completedList.push(f);
            } else if (f.status === 'encrypting') {
                encryptingList.push(f);
            }
        }

        const visible = fileList.length <= 30
            ? fileList
            : [...encryptingList, ...completedList.slice(-15)];

        return { visibleFiles: visible, pendingCount: pending, completedCount: completed, failedCount: failed };
    }, [fileList]);

    return (
        <>
            <TitleBar
                component={
                    <div className="flex items-center space-x-3 py-3 pl-2">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">
                            Encryption Progress
                        </h1>
                    </div>
                }
            />

            <div className="mx-auto max-w-7xl px-6 mt-2">
                {stages && <StagesViewer stages={stages} />}

                <ScrollArea className="h-120 w-full overflow-y-auto border rounded-md divide-y bg-background scrollbar-thin">
                    {fileList.length > 30 && pendingCount > 0 && (
                        <div className="flex items-center justify-between py-2.5 px-4 bg-muted/40 border-b border-border/50 text-xs text-muted-foreground font-medium animate-pulse">
                            <span className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Queueing remaining selected items...
                            </span>
                            <span>{pendingCount} files pending</span>
                        </div>
                    )}

                    {visibleFiles.map((file, index) => (
                        <div
                            key={file.actualPath || index}
                            className="flex items-center gap-2.5 py-2 px-3 hover:bg-muted/50 transition-colors group"
                        >
                            <div className="shrink-0 flex items-center justify-center w-7 h-7">
                                <GetFileIcon ext={file.ext} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {file.fileName}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {file.status === 'encrypting' && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary animate-pulse">
                                                Encrypting
                                            </span>
                                        )}
                                        {file.status === 'completed' && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-green-500">
                                                Done
                                            </span>
                                        )}
                                        {file.status === 'failed' && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                                                Failed
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatSize(file.size)}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {file.actualPath}
                                </p>

                                <Progress
                                    value={file.progress}
                                    className="h-1 w-full mt-1.5 bg-muted-foreground/20"
                                />
                            </div>
                        </div>
                    ))}
                </ScrollArea>
                <div className="flex items-center justify-between gap-4 pt-3">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                            {stages?.progress === 100 ? "Total time" : "Elapsed time"}
                            &nbsp;
                            {timePassed}s
                        </p>
                        {stages?.progress && <Progress value={stages.progress} />}
                    </div>
                    <Button
                        size="lg"
                        variant="destructive"
                        className="w-full sm:w-auto px-8"
                        disabled={!stages || stages.progress === 100 || isAborting}
                        onClick={() => setShowAbortConfirm(true)}
                    >
                        {isAborting ? "Aborting..." : "Abort"}
                        <Ban className="w-5 h-5 mr-2" />
                    </Button>
                </div>
            </div>

            <DialogRoot open={showAbortConfirm} onOpenChange={setShowAbortConfirm}>
                <DialogPortal>
                    <DialogBackdrop />
                    <DialogPopup>
                        <DialogTitle>Confirm Abort</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to abort the encryption process? Any partially encrypted files will be rolled back.
                        </DialogDescription>
                        <div className="mt-5 flex justify-end gap-2">
                            <DialogClose className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
                                No, Continue
                            </DialogClose>
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
                                onClick={async () => {
                                    setIsAborting(true);
                                    void logger.warn("EncryptionProgress", "User confirmed abort encryption flow");
                                    await window.encryptionProgress.abortEncryptionFlow();
                                }}
                            >
                                Yes, Abort
                            </DialogClose>
                        </div>
                    </DialogPopup>
                </DialogPortal>
            </DialogRoot>

            <DialogRoot open={showResultModal} onOpenChange={setShowResultModal}>
                <DialogPortal>
                    <DialogBackdrop />
                    <DialogPopup className="max-w-md bg-background border border-border shadow-2xl rounded-2xl p-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {stages?.current?.type === "COMPLETED" ? (
                                <>
                                    <div className="bg-green-500/10 p-2 rounded-lg text-green-500">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <span>Encryption Successful!</span>
                                </>
                            ) : stages?.current?.type === "ABORT" ? (
                                <>
                                    <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500">
                                        <Ban className="w-6 h-6" />
                                    </div>
                                    <span>Process Aborted</span>
                                </>
                            ) : (
                                <>
                                    <div className="bg-destructive/10 p-2 rounded-lg text-destructive">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <span>Encryption Failed</span>
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="mt-3 text-sm text-muted-foreground">
                            Here is a summary of the encryption process:
                        </DialogDescription>

                        <div className="mt-4 space-y-3 bg-muted/20 border border-border/50 rounded-xl p-4 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Total Files:</span>
                                <span className="font-semibold text-foreground">
                                    {fileList.length} files
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Successfully Encrypted:</span>
                                <span className="font-semibold text-green-500">
                                    {completedCount} files
                                </span>
                            </div>
                            {failedCount > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Failed:</span>
                                    <span className="font-semibold text-destructive">
                                        {failedCount} files
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Total Time:</span>
                                <span className="font-semibold text-foreground">{timePassed} seconds</span>
                            </div>
                            <div className="flex flex-col gap-1 pt-2 border-t border-border/50">
                                <span className="text-muted-foreground text-xs">Saved Location:</span>
                                <span className="font-medium text-foreground text-xs break-all bg-muted/40 p-2 rounded border border-border/30">
                                    {outputDir || "N/A"}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-colors cursor-pointer"
                                onClick={() => navigate("/", { replace: true })}
                            >
                                Return to Home
                            </Button>
                        </div>
                    </DialogPopup>
                </DialogPortal>
            </DialogRoot>
        </>
    );
}
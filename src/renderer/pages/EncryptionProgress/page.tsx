import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { formatSize } from "@renderer/lib/formatSize";
import { ArrowLeft, Shield, Ban } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { EncryptionProgress, EncryptionStage } from "@shared/types/fileEncryption";
import { Progress } from "@/components/ui/progress";
import { StagesViewer } from "./StagesViewer";
import GetFileIcon from "@/lib/getFileIcon";

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

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);

    const handleStages = useCallback((stage: EncryptionStage) => {
        const currentStage = {
            message: stage.message,
            type: stage.type
        };

        setStages(prev => ({
            progress: stage.progress,

            current: currentStage,

            completed: prev?.current
                ? [...(prev.completed ?? []), prev.current]
                : prev?.completed ?? []
        }));
    }, []);


    useEffect(() => {
        const unsubscribeStages =
            window.encryptionProgress.onStageUpdate(handleStages);

        const unsubscribeProgress =
            window.encryptionProgress.onProgress(setFileList)

        return () => {
            unsubscribeProgress();
            unsubscribeStages();
        }
    }, [handleStages, setFileList]);

    useEffect(() => {
        window.encryptionProgress.startEncryptionFlow();
    }, []);

    useEffect(() => {
        if (!stages) return;

        if (startTimeRef.current === null) {
            startTimeRef.current = Date.now();
        }

        if (!intervalRef.current && stages.progress < 100) {
            intervalRef.current = setInterval(() => {
                if (!startTimeRef.current) return;

                const seconds = Math.floor(
                    (Date.now() - startTimeRef.current) / 1000
                );

                setTimePassed(seconds);
            }, 1000);
        }

        if (stages.progress >= 100 && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;

            const finalSeconds = Math.floor(
                (Date.now() - (startTimeRef.current ?? Date.now())) / 1000
            );

            setTimePassed(finalSeconds);
        }

        return () => {
            if (intervalRef.current && stages.progress >= 100) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [stages]);

    return (
        <>
            <TitleBar
                component={
                    <div className="flex items-center space-x-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
                            onClick={() => navigate(-1)}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <Shield className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                Encryption Progress
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="mx-auto max-w-7xl px-6 mt-2 ">

                {stages && <StagesViewer stages={stages} />}

                <ScrollArea className="h-120 w-full overflow-y-auto border rounded-md divide-y bg-background scrollbar-thin">
                    {fileList.map((file, index) => (
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
                        disabled={!stages || stages.progress === 100}
                        onClick={() => window.encryptionProgress.abortEncryptionFlow()}
                    >
                        Abort
                        <Ban className="w-5 h-5 mr-2" />
                    </Button>
                </div>
            </div>
        </>
    );
}
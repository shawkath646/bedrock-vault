import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Ban, LoaderCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import type { RenderEncryptionStages } from "./page";

const ITEM_ANIMATION = {
    initial: { opacity: 0, x: -10, filter: "blur(2px)" },
    animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.95, filter: "blur(2px)" },
    transition: { duration: 0.3, ease: "easeOut" as const }
};

const isTerminalStage = (type: string) => ["COMPLETED", "ABORT"].includes(type);

const getStageStyles = (type: string, isCurrent: boolean) => {
    switch (type) {
        case "FAILED":
        case "ABORT":
            return "bg-destructive/10 border-destructive/20 text-destructive";
        case "WARNING":
            return "bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400";
        case "COMPLETED":
            return "bg-primary/10 border-primary/20 text-primary";
        case "CONTINUE":
            return "bg-muted/50 border-muted text-muted-foreground";
        default:
            return isCurrent
                ? "bg-background border-primary/30 text-foreground ring-4 ring-primary/10"
                : "bg-muted/50 border-muted text-muted-foreground";
    }
};

export const StagesViewer = memo(function StagesViewer({ stages }: { stages: RenderEncryptionStages }) {
    return (
        <div className="w-full pb-2 h-22.5">
            <div className="flex flex-wrap items-center justify-center gap-y-3 text-sm font-medium py-1 px-1">
                <AnimatePresence mode="popLayout">
                    {stages?.completed.map((stage, idx) => (
                        <motion.div
                            key={`stage-${idx}-${stage.type}`}
                            {...ITEM_ANIMATION}
                            className="flex items-center"
                        >
                            {idx > 0 && (
                                <div className="h-0.5 w-4 sm:w-8 bg-border/60 shrink-0 mx-1 sm:mx-2 rounded-full" />
                            )}

                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm text-xs whitespace-nowrap transition-colors duration-300 ${getStageStyles(stage.type, false)}`}>
                                {stage.type === "CONTINUE" && <CheckCircle2 className="h-4 w-4" />}
                                {stage.type === "WARNING" && <AlertTriangle className="h-4 w-4" />}
                                {stage.type === "ABORT" && <Ban className="h-4 w-4" />}
                                {stage.type === "FAILED" && <XCircle className="h-4 w-4" />}
                                {stage.type === "COMPLETED" && <ShieldCheck className="h-4 w-4" />}

                                <p className="max-w-35 truncate">{stage.message}</p>
                            </div>
                        </motion.div>
                    ))}

                    {stages?.current && (
                        <motion.div
                            key="current-stage"
                            {...ITEM_ANIMATION}
                            className="flex items-center"
                        >
                            {(stages?.completed?.length ?? 0) > 0 && (
                                <div className="h-0.5 w-4 sm:w-8 bg-border/60 shrink-0 mx-1 sm:mx-2 rounded-full" />
                            )}

                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm text-xs whitespace-nowrap transition-all duration-300 ${getStageStyles(stages.current.type, true)}`}>
                                {!isTerminalStage(stages.current.type) && (
                                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                                )}

                                {stages.current.type === "COMPLETED" && <ShieldCheck className="h-4 w-4" />}
                                {stages.current.type === "ABORT" && <Ban className="h-4 w-4" />}
                                {stages.current.type === "FAILED" && <XCircle className="h-4 w-4" />}
                                {stages.current.type === "WARNING" && <AlertTriangle className="h-4 w-4" />}

                                <p className="max-w-35 truncate">{stages.current.message}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.stages?.progress === nextProps.stages?.progress &&
        prevProps.stages?.current?.message === nextProps.stages?.current?.message &&
        prevProps.stages?.current?.type === nextProps.stages?.current?.type &&
        prevProps.stages?.completed.length === nextProps.stages?.completed.length;
});
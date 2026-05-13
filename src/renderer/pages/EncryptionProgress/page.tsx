import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@renderer/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

interface ProgressStep {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    percentage?: number;
}

const INITIAL_STEPS: ProgressStep[] = [
    {
        id: 'reading',
        title: 'Reading Files',
        description: 'Loading and analyzing your selected files...',
        status: 'pending',
    },
    {
        id: 'key-generation',
        title: 'Generating Encryption Keys',
        description: 'Creating secure encryption keys for your files...',
        status: 'pending',
    },
    {
        id: 'encryption',
        title: 'Encrypting Data',
        description: 'Applying encryption to your files securely...',
        status: 'pending',
    },
    {
        id: 'finalization',
        title: 'Finalizing',
        description: 'Saving encrypted files and metadata...',
        status: 'pending',
    },
];

export default function EncryptionProgressPage() {

    const navigate = useNavigate();
    const [steps, setSteps] = useState<ProgressStep[]>(INITIAL_STEPS);
    const [overallProgress, setOverallProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let stepIndex = 0;

        const progressSequence = [
            { stepId: 'reading', progress: 15, delay: 800 },
            { stepId: 'reading', progress: 35, delay: 1200 },
            { stepId: 'reading', progress: 50, delay: 600 },
            { stepId: 'key-generation', progress: 60, delay: 1500 },
            { stepId: 'key-generation', progress: 75, delay: 800 },
            { stepId: 'encryption', progress: 80, delay: 2000 },
            { stepId: 'encryption', progress: 90, delay: 1000 },
            { stepId: 'finalization', progress: 95, delay: 800 },
            { stepId: 'finalization', progress: 100, delay: 600 },
        ];

        const simulateProgress = () => {
            if (stepIndex < progressSequence.length) {
                const current = progressSequence[stepIndex];

                setSteps((prevSteps) => {
                    const newSteps = [...prevSteps];
                    const stepToUpdate = newSteps.find((s) => s.id === current.stepId);

                    if (stepToUpdate) {
                        newSteps.forEach((s) => {
                            if (s.id === current.stepId && s.status === 'pending') {
                                s.status = 'in-progress';
                            } else if (
                                prevSteps.some(
                                    (ps) =>
                                        ps.id === s.id &&
                                        ps.status === 'in-progress' &&
                                        s.id !== current.stepId
                                )
                            ) {
                                s.status = 'completed';
                            }
                        });

                        stepToUpdate.percentage = current.progress;
                    }

                    return newSteps;
                });

                setOverallProgress(current.progress);
                stepIndex++;

                timeoutId = setTimeout(simulateProgress, current.delay);
            } else {
                setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                        s.status !== 'error' ? { ...s, status: 'completed' } : s
                    )
                );
                setIsComplete(true);
            }
        };

        timeoutId = setTimeout(simulateProgress, 600);

        return () => clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        // IPC listener placeholder for production
    }, []);

    const handleCancel = () => {
        navigate(-1);
    };

    const handleComplete = () => {
        navigate('/');
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2,
            },
        },
    };

    const stepVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 12,
            },
        },
        exit: { opacity: 0, y: -20 },
    };

    const progressVariants: Variants = {
        initial: { scaleX: 0 },
        animate: {
            scaleX: 1,
            transition: {
                duration: 0.8,
                ease: 'easeOut',
            },
        },
    };

    return (
        <>
            <TitleBar
                component={
                    <div className="flex items-center space-x-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
                            onClick={handleCancel}
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

            <div className="px-6 lg:px-8 pb-4">

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
                        {/* Overall Progress Bar */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-foreground">
                                    Overall Progress
                                </h3>
                                <span className="text-sm font-medium text-muted-foreground">
                                    {Math.round(overallProgress)}%
                                </span>
                            </div>

                            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-linear-to-r from-primary to-primary/60 rounded-full"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${overallProgress}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                        </div>

                        {/* Error Alert */}
                        <AnimatePresence>
                            {hasError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                                >
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                            Encryption Error
                                        </p>
                                        <p className="text-xs text-red-500/80 dark:text-red-400/80 mt-1">
                                            {errorMessage}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Steps Container */}
                        <motion.div
                            className="space-y-4"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <AnimatePresence mode="wait">
                                {steps.map((step) => (
                                    <motion.div
                                        key={step.id}
                                        variants={stepVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                        layout
                                    >
                                        <Card
                                            className={`overflow-hidden transition-all duration-300 ${step.status === 'error'
                                                ? 'border-red-500/30 bg-red-500/5'
                                                : step.status === 'completed'
                                                    ? 'border-green-500/30 bg-green-500/5'
                                                    : step.status === 'in-progress'
                                                        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                                                        : 'border-border/50 bg-secondary/30'
                                                }`}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-4">
                                                    {/* Status Icon */}
                                                    <div className="shrink-0 mt-0.5">
                                                        {step.status === 'completed' ? (
                                                            <motion.div
                                                                initial={{ scale: 0, rotate: -180 }}
                                                                animate={{ scale: 1, rotate: 0 }}
                                                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                                            >
                                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                            </motion.div>
                                                        ) : step.status === 'error' ? (
                                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                                        ) : step.status === 'in-progress' ? (
                                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                                                                <Loader2 className="w-5 h-5 text-primary" />
                                                            </motion.div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                                                        )}
                                                    </div>

                                                    {/* Step Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-sm font-semibold text-foreground">
                                                                {step.title}
                                                            </h4>
                                                            {step.percentage !== undefined && step.status !== 'completed' && (
                                                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                                    {Math.round(step.percentage)}%
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {step.description}
                                                        </p>

                                                        {/* Step Progress Bar */}
                                                        {step.status !== 'pending' && step.percentage !== undefined && (
                                                            <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mt-3">
                                                                <motion.div
                                                                    className={`h-full rounded-full ${step.status === 'completed'
                                                                        ? 'bg-green-500'
                                                                        : step.status === 'error'
                                                                            ? 'bg-red-500'
                                                                            : 'bg-primary'
                                                                        }`}
                                                                    variants={progressVariants}
                                                                    initial="initial"
                                                                    animate="animate"
                                                                    style={{ width: `${step.percentage}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>

                        {/* Completion Message */}
                        <AnimatePresence>
                            {isComplete && !hasError && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="p-6 rounded-lg bg-green-500/10 border border-green-500/20 text-center space-y-3"
                                >
                                    <motion.div
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                        className="flex justify-center"
                                    >
                                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                                    </motion.div>
                                    <div>
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            Encryption Complete!
                                        </p>
                                        <p className="text-xs text-green-500/80 dark:text-green-400/80 mt-1">
                                            Your files have been successfully encrypted and saved.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isComplete}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            {isComplete && (
                                <Button
                                    onClick={handleComplete}
                                    className="flex-1"
                                >
                                    Done
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
import { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
    ArrowLeft,
    ArrowRight,
    WandSparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import TitleBar from '@/components/navigation/Titlebar';
import Step0 from './Step0';
import Step1 from './Step1';
import Step2 from './Step2';
import Footer from '@/components/navigation/Footer';


const stepVariants: Variants = {
    initial: (direction: number) => ({
        x: direction > 0 ? 40 : -40,
        opacity: 0,
    }),
    animate: {
        x: 0,
        opacity: 1,
        transition: { duration: 0.25, ease: 'easeOut' },
    },
    exit: (direction) => ({
        x: direction > 0 ? -40 : 40,
        opacity: 0,
        transition: { duration: 0.2, ease: 'easeIn' },
    }),
};

const TOTAL_STEPS = 2;

export default function SetupWizardPage({ onComplete }: { onComplete?: () => void }) {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);


    const goBack = () => {
        setDirection(-1);
        setStep((current) => Math.max(0, current - 1));
    };

    const goNext = () => {
        setDirection(1);
        setStep((current) => Math.min(TOTAL_STEPS, current + 1));
    };

    const saveSetup = async () => {
        setSaving(true);
        try {
            //await window.api.saveConfig(config);
            onComplete?.();
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <TitleBar
                component={
                    <div className="flex items-center space-x-3 py-3 pl-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary shadow-sm border border-primary/10">
                            <WandSparkles className="w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">
                            Setup Wizard
                        </h1>
                    </div>
                }
            />
            <div className="mx-auto flex h-[calc(100vh-56px)] max-w-7xl flex-col px-6 py-3 lg:px-8 overflow-hidden">
                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait" initial={false} custom={direction}>
                        <motion.div
                            key={step}
                            custom={direction}
                            variants={stepVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            {step === 0 ? <Step0 /> : null}

                            {step === 1 ? <Step1 /> : null}

                            {step === 2 ? <Step2 /> : null}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer - fixed navigation */}
                <Footer />
                <div className="shrink-0 border-t border-border/60 bg-background px-2 pt-3 pb-1">
                    <div className="flex items-center justify-between gap-2">
                        {step > 0 ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goBack}
                                disabled={step === 0}
                                className="gap-2 text-xs"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Back
                            </Button>
                        ) : <div></div>}

                        <div className="flex gap-1.5">
                            {Array(TOTAL_STEPS + 1).fill(null).map((_, index) => (
                                <motion.div
                                    key={index}
                                    className={`h-1.5 rounded-full transition-all ${index === step
                                        ? "w-6 bg-primary"
                                        : index < step
                                            ? "w-1.5 bg-primary/60"
                                            : "w-1.5 bg-muted"
                                        }`}
                                />
                            ))}
                        </div>

                        {step < 2 ? (
                            <Button onClick={goNext} className="gap-2 text-xs px-5">
                                Next
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        ) : (
                            <Button
                                onClick={saveSetup}
                                disabled={saving}
                                className="text-xs px-5"
                            >
                                {saving ? 'Saving...' : 'Complete'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

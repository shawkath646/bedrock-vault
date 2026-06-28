import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { SECURITY_GUIDELINES } from "./warningRules";

const ICON_ACCENTS = [
    "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    "bg-lime-500/10 text-lime-600 dark:text-lime-400",
    "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    "bg-teal-500/10 text-teal-600 dark:text-teal-400",
];

export default function ConfirmEncryptionPage() {

    const navigate = useNavigate();

    useEffect(() => {
        window.encryptionOptions.hasEncryptionPassword().then(hasPassword => {
            if (!hasPassword) {
                navigate("/encryption/encryption-options");
            }
        });
    }, [navigate]);

    return (
        <div className="flex h-full flex-col">
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
                                <Info className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                Warning
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 min-h-0 overflow-y-scroll px-6 lg:px-8 py-3">
                <div className="space-y-3">
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Before you continue...
                    </p>

                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {SECURITY_GUIDELINES.map((rule) => {
                            const Icon = rule.icon;
                            const accentClass = ICON_ACCENTS[(rule.id - 1) % ICON_ACCENTS.length];

                            return (
                                <article
                                    key={rule.id}
                                    className="p-3 flex items-start gap-2"
                                >
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="text-sm font-semibold text-foreground">
                                            {rule.title}
                                        </h3>
                                        <p className="text-sm leading-6 text-muted-foreground">
                                            {rule.description}
                                        </p>
                                    </div>
                                </article>
                            );
                        })}
                    </section>


                </div>
            </div>
            <div className="shrink-0 bg-background px-4 py-4 flex justify-end">
                <Button
                    type="submit"
                    size="lg"
                    className="w-auto px-8"
                    onClick={() => navigate("/encryption/encryption-progress")}
                >
                    I Understand
                    <ShieldCheck className="w-5 h-5 mr-2" />
                </Button>
            </div>
        </div>
    );
}
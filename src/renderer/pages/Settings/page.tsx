import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, Settings, Moon, Sun, Monitor, Globe, RotateCcw, AlertTriangle } from "lucide-react";
import useTheme from "@renderer/lib/theme";
import {
    DialogRoot,
    DialogPortal,
    DialogBackdrop,
    DialogPopup,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@renderer/components/ui/dialog";

export default function SettingsPage() {
    const navigate = useNavigate();
    const { theme, handleThemeChange } = useTheme();
    const [language, setLanguage] = useState("en");
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleReset = async () => {
        setIsResetting(true);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setIsResetting(false);
        setShowResetConfirm(false);
        window.location.href = window.location.pathname;
    };

    return (
        <div className="flex flex-col h-full bg-background text-foreground select-none">
            <TitleBar
                component={
                    <div className="flex items-center space-x-3 py-3 pl-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                            onClick={() => navigate(-1)}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <Settings className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 px-6 lg:px-8 w-full flex flex-col justify-start divide-y divide-border/50">
                <div className="flex items-center justify-between p-5">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Moon className="w-4 h-4 text-muted-foreground" />
                            Appearance
                        </h3>
                        <p className="text-xs text-muted-foreground">Choose your interface theme style.</p>
                    </div>
                    <div className="flex gap-1 bg-muted/40 p-1 border border-border/60 rounded-xl">
                        {[
                            { id: "light", label: "Light", icon: Sun },
                            { id: "dark", label: "Dark", icon: Moon },
                            { id: "system", label: "System", icon: Monitor },
                        ].map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => handleThemeChange(id as "light" | "dark" | "system")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${theme === id
                                        ? "bg-background text-primary shadow-xs font-semibold border border-border/40"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between p-5">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            Language
                        </h3>
                        <p className="text-xs text-muted-foreground">Set your preferred locale and language.</p>
                    </div>
                    <div className="w-48">
                        <select
                            id="lang-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full text-xs bg-background/50 border border-border/60 hover:border-border rounded-xl px-3 py-2 outline-hidden appearance-none cursor-pointer"
                        >
                            <option value="en">English (US)</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between p-5">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-muted-foreground" />
                            Reset App preferences
                        </h3>
                        <p className="text-xs text-muted-foreground">Restore all default system preferences.</p>
                    </div>
                    <div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                            onClick={() => setShowResetConfirm(true)}
                        >
                            Reset Settings
                        </Button>
                    </div>
                </div>
            </div>

            <DialogRoot open={showResetConfirm} onOpenChange={setShowResetConfirm}>
                <DialogPortal>
                    <DialogBackdrop />
                    <DialogPopup>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            Reset Preferences?
                        </DialogTitle>
                        <DialogDescription>
                            This will restore all default system preferences. This action is irreversible.
                        </DialogDescription>
                        <div className="mt-5 flex justify-end gap-2">
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                                disabled={isResetting}
                            >
                                Cancel
                            </DialogClose>
                            <DialogClose
                                className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    void handleReset();
                                }}
                                disabled={isResetting}
                            >
                                {isResetting ? "Resetting..." : "Reset Now"}
                            </DialogClose>
                        </div>
                    </DialogPopup>
                </DialogPortal>
            </DialogRoot>
        </div>
    );
}

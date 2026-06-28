import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, Settings, Moon, Sun, Monitor, Globe, RotateCcw, AlertTriangle, Clock } from "lucide-react";
import useTheme from "@renderer/lib/theme";
import { AppConfigContext } from "@renderer/contexts/AppConfigContext";
import {
    DialogRoot,
    DialogPortal,
    DialogBackdrop,
    DialogPopup,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@renderer/components/ui/dialog";

import { Input } from "@renderer/components/ui/input";
import { Switch } from "@renderer/components/ui/switch";
import { Lock, LogOut, Video, Key } from "lucide-react";

export default function SettingsPage() {
    const navigate = useNavigate();
    const { theme, handleThemeChange } = useTheme();
    const configCtx = useContext(AppConfigContext);
    if (!configCtx) throw new Error("SettingsPage must be used within AppConfigProvider");
    const { config, saveConfig } = configCtx;
    const [language, setLanguage] = useState("en");
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    
    // New placeholders
    const [enableAppLock, setEnableAppLock] = useState(config?.appLockEnabled ?? false);
    const [enableAutoLogout, setEnableAutoLogout] = useState(true);
    const [enableSecureMedia, setEnableSecureMedia] = useState(true);
    
    // Panic Button State
    const [enablePanicButton, setEnablePanicButton] = useState(false);
    const [panicHotkey, setPanicHotkey] = useState("CommandOrControl+Shift+L");
    const [panicHotkeyError, setPanicHotkeyError] = useState("");
    const [panicHotkeySuccess, setPanicHotkeySuccess] = useState("");

    useEffect(() => {
        window.panicButton.status().then((status) => {
            setEnablePanicButton(status.enabled);
            setPanicHotkey(status.hotkey);
        }).catch(console.error);
    }, []);

    const handlePanicButtonToggle = async (enabled: boolean) => {
        setEnablePanicButton(enabled);
        setPanicHotkeyError("");
        setPanicHotkeySuccess("");
        const res = await window.panicButton.set(enabled, panicHotkey);
        if (!res.success && res.error === 'HOTKEY_ALREADY_ASSIGNED') {
            setPanicHotkeyError("Hotkey is already assigned by another app.");
            setEnablePanicButton(false); // Revert toggle
        } else if (res.success && enabled) {
            setPanicHotkeySuccess("Hotkey saved and activated!");
        }
    };

    const handlePanicHotkeyBlur = async () => {
        if (!enablePanicButton) return;
        
        setPanicHotkeyError("");
        setPanicHotkeySuccess("");
        const isAvailable = await window.panicButton.checkAvailability(panicHotkey);
        if (!isAvailable) {
            setPanicHotkeyError("Hotkey is already assigned to another service.");
            return;
        }

        const res = await window.panicButton.set(enablePanicButton, panicHotkey);
        if (!res.success) {
            setPanicHotkeyError("Failed to set hotkey.");
        } else {
            setPanicHotkeySuccess("Hotkey saved and activated!");
        }
    };

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
                    <div className="flex items-center space-x-2 py-2 pl-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-8 h-8 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                            onClick={() => navigate(-1)}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-2">
                            <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                                <Settings className="w-4 h-4" />
                            </div>
                            <h1 className="text-md font-semibold tracking-tight">Settings</h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 px-4 lg:px-6 w-full flex flex-col justify-start overflow-y-auto">
                {/* Appearance Group */}
                <div className="mt-4 mb-2 px-2">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Appearance</h2>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl divide-y divide-border/50">
                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Moon className="w-4 h-4 text-muted-foreground" />
                                Theme
                            </h3>
                            <p className="text-[11px] text-muted-foreground">Choose your interface theme style.</p>
                        </div>
                        <div className="flex gap-1 bg-muted/40 p-1 border border-border/60 rounded-lg">
                            {[
                                { id: "light", label: "Light", icon: Sun },
                                { id: "dark", label: "Dark", icon: Moon },
                                { id: "system", label: "System", icon: Monitor },
                            ].map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => handleThemeChange(id as "light" | "dark" | "system")}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${theme === id
                                            ? "bg-background text-primary shadow-xs font-semibold border border-border/40"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    <Icon className="w-3 h-3" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                Language
                            </h3>
                            <p className="text-[11px] text-muted-foreground">Set your preferred locale and language.</p>
                        </div>
                        <div className="w-40">
                            <select
                                id="lang-select"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full text-xs bg-background/50 border border-border/60 hover:border-border rounded-lg px-2 py-1.5 outline-hidden appearance-none cursor-pointer"
                            >
                                <option value="en">English (US)</option>
                                <option value="es">Español</option>
                                <option value="fr">Français</option>
                                <option value="de">Deutsch</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Security & Privacy Group */}
                <div className="mt-6 mb-2 px-2">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Security & Privacy</h2>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl divide-y divide-border/50">
                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Lock className="w-4 h-4 text-muted-foreground" />
                                App Lock on Launch
                            </h3>
                            <p className="text-[11px] text-muted-foreground">Require password when opening the app.</p>
                        </div>
                        <Switch
                            checked={enableAppLock}
                            onCheckedChange={(val) => {
                                setEnableAppLock(val);
                                void saveConfig({ appLockEnabled: val });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <LogOut className="w-4 h-4 text-muted-foreground" />
                                Auto Logout / Lock
                            </h3>
                            <p className="text-[11px] text-muted-foreground">Lock vault automatically after inactivity.</p>
                        </div>
                        <Switch
                            checked={enableAutoLogout}
                            onCheckedChange={setEnableAutoLogout}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5 opacity-90">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                Auto-Lock Timeout (Seconds)
                            </h3>
                        </div>
                        <div className="w-24">
                            <Input
                                type="number"
                                min={10}
                                disabled={!enableAutoLogout}
                                value={Math.floor((config?.inactivityTimeoutMs ?? 300000) / 1000)}
                                onChange={(e) => {
                                    void saveConfig({ inactivityTimeoutMs: Number(e.target.value) * 1000 });
                                }}
                                className="text-right"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col p-3 border-t border-border/50">
                        <div className="flex items-center justify-between pb-2">
                            <div className="space-y-0.5">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <Key className="w-4 h-4 text-muted-foreground" />
                                    Enable Panic Button
                                </h3>
                                <p className="text-[11px] text-muted-foreground">Quickly lock vault and hide the app.</p>
                            </div>
                            <Switch
                                checked={enablePanicButton}
                                onCheckedChange={handlePanicButtonToggle}
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <div className="space-y-0.5 opacity-90">
                                <h3 className="text-[12px] font-medium text-muted-foreground">Global Hotkey</h3>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="w-48">
                                    <Input
                                        type="text"
                                        disabled={!enablePanicButton}
                                        value={panicHotkey}
                                        onChange={(e) => {
                                            setPanicHotkey(e.target.value);
                                            setPanicHotkeySuccess("");
                                            setPanicHotkeyError("");
                                        }}
                                        onBlur={() => { void handlePanicHotkeyBlur() }}
                                        className={`text-center font-mono text-xs ${panicHotkeyError ? "border-destructive ring-destructive/20" : ""} ${panicHotkeySuccess ? "border-green-500/50 focus-visible:ring-green-500/30" : ""}`}
                                    />
                                </div>
                                {panicHotkeyError && (
                                    <span className="text-[10px] text-destructive mt-1">{panicHotkeyError}</span>
                                )}
                                {panicHotkeySuccess && !panicHotkeyError && (
                                    <span className="text-[10px] text-green-500 mt-1">{panicHotkeySuccess}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Media & File Handling Group */}
                <div className="mt-6 mb-2 px-2">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Media & File Handling</h2>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl divide-y divide-border/50">
                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Video className="w-4 h-4 text-muted-foreground" />
                                Secure Media Preview
                            </h3>
                            <p className="text-[11px] text-muted-foreground">Preview supported media using the secured streaming protocol.</p>
                        </div>
                        <Switch
                            checked={enableSecureMedia}
                            onCheckedChange={setEnableSecureMedia}
                        />
                    </div>
                </div>

                {/* System Group */}
                <div className="mt-6 mb-2 px-2">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider">System</h2>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl divide-y divide-border/50 mb-8">
                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-muted-foreground" />
                                Reset App preferences
                            </h3>
                            <p className="text-[11px] text-muted-foreground">Restore all default system preferences.</p>
                        </div>
                        <div>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="text-xs px-3 py-1.5 h-auto rounded-lg transition-colors cursor-pointer"
                                onClick={() => setShowResetConfirm(true)}
                            >
                                Reset Settings
                            </Button>
                        </div>
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

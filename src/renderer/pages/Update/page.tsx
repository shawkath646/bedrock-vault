import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

interface UpdateInfo {
    lastUpdate: string;
    currentVersion: string;
    latestVersion: string;
    updateUrl: string;
}

export default function UpdatePage() {
    const navigate = useNavigate();
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        window.appWindow.getAppUpdateInfo().then((info) => {
            setUpdateInfo(info);
            setIsLoading(false);
        });
    }, []);

    const handleUpdate = async () => {
        if (updateInfo?.updateUrl) {
            await window.appWindow.openExternalUrl(updateInfo.updateUrl);
        }
    };

    const hasUpdate = updateInfo && updateInfo.currentVersion !== updateInfo.latestVersion;

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
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight">App Update</h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center space-y-2 text-xs text-muted-foreground">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <span>Checking for updates...</span>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className={`p-4 rounded-2xl shadow-sm ${hasUpdate ? 'bg-primary/10 text-primary' : 'bg-green-500/10 text-green-500'}`}>
                                {hasUpdate ? (
                                    <Sparkles className="w-10 h-10 animate-bounce" />
                                ) : (
                                    <CheckCircle2 className="w-10 h-10" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">
                                    {hasUpdate ? "New Update Available!" : "Your App is Up to Date"}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {hasUpdate ? "A new version of the platform has been released." : "You are currently running the latest secure release."}
                                </p>
                            </div>
                        </div>

                        <div className="w-full max-w-sm rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2.5 text-xs">
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground">Current Version</span>
                                <span className="font-semibold">{updateInfo?.currentVersion}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground">Latest Version</span>
                                <span className={`font-semibold ${hasUpdate ? 'text-primary' : 'text-foreground'}`}>
                                    {updateInfo?.latestVersion}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground">Last Updated</span>
                                <span className="font-medium">{updateInfo?.lastUpdate}</span>
                            </div>
                        </div>

                        {hasUpdate && (
                            <div className="w-full max-w-sm pt-2">
                                <Button
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
                                    onClick={handleUpdate}
                                >
                                    Update Now
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

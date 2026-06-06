import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { Progress } from "@renderer/components/ui/progress";
import { ArrowLeft, RefreshCw, Download, CheckCircle2, FileText, ChevronRight } from "lucide-react";
import type { AppUpdateInfo } from "@shared/types/global";

export default function UpdatePage() {
    const navigate = useNavigate();
    const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    useEffect(() => {
        window.appWindow.getAppUpdateInfo().then((info) => {
            setUpdateInfo(info);
            setIsLoading(false);
        });
    }, []);

    const handleUpdate = async () => {
        // OPTIMIZATION: TypeScript narrowing. 
        // By checking this flag, TS now guarantees updateUrl exists below.
        if (updateInfo?.updateAvailable !== true) return;

        setIsDownloading(true);
        setDownloadProgress(0);

        const interval = setInterval(() => {
            setDownloadProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + Math.floor(Math.random() * 15) + 5; 
            });
        }, 400);
    };

    // Derived state for cleaner JSX
    const hasUpdate = updateInfo?.updateAvailable === true;
    const downloadComplete = downloadProgress >= 100;
    
    // Fallback to current version for the "What's New" header if no update exists
    const displayVersion = hasUpdate ? updateInfo.latestVersion : updateInfo?.currentVersion;

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
                        <h1 className="text-lg font-semibold tracking-tight">Software Update</h1>
                    </div>
                }
            />

            <div className="flex-1 min-h-0 p-8">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 text-muted-foreground animate-in fade-in duration-500">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-sm font-medium">Checking for updates...</span>
                    </div>
                ) : (
                    <div className="flex h-full max-w-5xl mx-auto gap-12 animate-in slide-in-from-bottom-4 fade-in duration-500">
                        
                        {/* LEFT COLUMN: Status & Actions */}
                        <div className="w-105 shrink-0 flex flex-col space-y-8 pt-4">
                            <div className="space-y-4">
                                <div className={`inline-flex p-3 rounded-xl ${hasUpdate ? 'bg-primary/10 text-primary' : 'bg-green-500/10 text-green-500'}`}>
                                    {hasUpdate ? <Download className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight">
                                        {hasUpdate ? "Update Available" : "Up to Date"}
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {hasUpdate 
                                            ? `Version ${updateInfo.latestVersion} is ready to install.` 
                                            : "You are running the latest secure release."}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm border-y border-border/50 py-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Current Version</span>
                                    <span className="font-medium">{updateInfo?.currentVersion}</span>
                                </div>
                                {hasUpdate && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Latest Version</span>
                                        <span className="font-semibold text-primary">{updateInfo.latestVersion}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Last Checked</span>
                                    <span className="font-medium">{updateInfo?.lastUpdate}</span>
                                </div>
                            </div>

                            {/* Action Area */}
                            {hasUpdate && (
                                <div className="pt-2">
                                    {!isDownloading ? (
                                        <Button 
                                            size="lg" 
                                            className="w-full text-sm font-semibold"
                                            onClick={handleUpdate}
                                        >
                                            Download and Install
                                        </Button>
                                    ) : (
                                        <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span>{downloadComplete ? "Ready to install" : "Downloading..."}</span>
                                                <span className="text-primary">{downloadProgress}%</span>
                                            </div>
                                            <Progress value={downloadProgress} className="h-2" />
                                            {downloadComplete && (
                                                <Button 
                                                    size="sm" 
                                                    className="w-full mt-2" 
                                                    onClick={() => window.appWindow.openExternalUrl(updateInfo.updateUrl)}
                                                >
                                                    Restart App
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: What's New */}
                        <div className="flex-1 flex flex-col border border-border/60 bg-card rounded-xl overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold">Release Notes</h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-lg font-semibold tracking-tight flex items-center">
                                        What's new in {displayVersion}
                                    </h4>
                                    
                                    {updateInfo?.releaseNotes && updateInfo.releaseNotes.length > 0 ? (
                                        <ul className="space-y-3">
                                            {updateInfo.releaseNotes.map((note, index) => (
                                                <li key={index} className="flex items-start text-sm text-muted-foreground">
                                                    <ChevronRight className="w-4 h-4 mr-2 mt-0.5 text-primary shrink-0" />
                                                    <span className="leading-relaxed">{note}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No release notes provided for this version.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
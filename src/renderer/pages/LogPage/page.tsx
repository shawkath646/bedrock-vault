import { useEffect, useState, useRef } from "react";
import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Terminal, FolderOpen, RefreshCw, Check, AlertTriangle, XCircle } from "lucide-react";

export default function LogPage() {
    const [activeTab, setActiveTab] = useState<"main" | "renderer">("main");
    const [mainLogs, setMainLogs] = useState<string[]>([]);
    const [rendererLogs, setRendererLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await window.appLogs.fetchLogs();
            setMainLogs(data.main.split("\n").filter(line => line.trim() !== ""));
            setRendererLogs(data.renderer.split("\n").filter(line => line.trim() !== ""));
        } catch (err) {
            console.error("Failed to load logs:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void Promise.resolve().then(() => loadLogs());

        const unsubscribe = window.appLogs.onLogUpdate((data) => {
            if (data.fileType === "main") {
                setMainLogs(prev => [...prev, data.line]);
            } else {
                setRendererLogs(prev => [...prev, data.line]);
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [mainLogs, rendererLogs, activeTab]);

    const renderLogLine = (line: string, index: number) => {
        let textClass = "text-muted-foreground";
        let icon = null;

        if (line.includes("[INFO ]") || line.includes("[INFO]")) {
            textClass = "text-foreground";
            icon = <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />;
        } else if (line.includes("[WARN ]") || line.includes("[WARN]")) {
            textClass = "text-amber-500 font-medium";
            icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
        } else if (line.includes("[ERROR]") || line.includes("[ERROR ]")) {
            textClass = "text-destructive font-semibold";
            icon = <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
        }

        return (
            <div key={index} className="flex items-start gap-2.5 py-1 px-2 hover:bg-muted/30 transition-colors rounded-sm font-mono text-[11px] leading-relaxed break-all">
                {icon}
                <span className={textClass}>{line}</span>
            </div>
        );
    };

    const activeLogs = activeTab === "main" ? mainLogs : rendererLogs;

    return (
        <div className="flex flex-col h-full bg-background text-foreground select-none">
            <TitleBar
                component={
                    <div className="flex items-center space-x-3 py-3 pl-2">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <Terminal className="w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight">System Logs</h1>
                    </div>
                }
            />

            <div className="flex-1 flex flex-col p-6 min-h-0 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex gap-1 bg-muted/40 p-1 border border-border/60 rounded-xl">
                        <button
                            onClick={() => setActiveTab("main")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === "main"
                                    ? "bg-background text-primary shadow-xs border border-border/40"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Main Process
                        </button>
                        <button
                            onClick={() => setActiveTab("renderer")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === "renderer"
                                    ? "bg-background text-primary shadow-xs border border-border/40"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Renderer
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8.5 rounded-xl cursor-pointer"
                            onClick={() => void loadLogs()}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8.5 rounded-xl cursor-pointer"
                            onClick={() => void window.appLogs.viewFolder()}
                        >
                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                            View Logs Folder
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 relative border border-border/60 rounded-2xl bg-muted/10 p-2">
                    <ScrollArea ref={scrollRef} className="h-full w-full">
                        <div className="space-y-1 p-2">
                            {activeLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground">
                                    No log entries available for this session.
                                </div>
                            ) : (
                                activeLogs.map((line, idx) => renderLogLine(line, idx))
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

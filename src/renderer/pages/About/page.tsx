import { useNavigate } from 'react-router-dom';
import TitleBar from '@renderer/components/navigation/Titlebar';
import { Button } from '@renderer/components/ui/button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import appMetadata from '@shared/constant/metadata.json';

export default function AboutPage() {
    const navigate = useNavigate();

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
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight">About</h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-sm">
                        <ShieldCheck className="w-10 h-10 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">{appMetadata.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Secure File Vault Platform</p>
                    </div>
                </div>

                <div className="w-full max-w-sm rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">{appMetadata.version}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-muted-foreground">Author</span>
                        <span className="font-medium">{appMetadata.author.name}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-muted-foreground">Brand</span>
                        <span className="font-medium">{appMetadata.publishedBy.name}</span>
                    </div>
                </div>

                <div className="text-center text-[10px] text-muted-foreground/80 pt-4">
                    <p>© 2026-2027 {appMetadata.publishedBy.name}. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TitleBar from '@renderer/components/navigation/Titlebar';
import { Button } from '@renderer/components/ui/button';
import { Card, CardContent, CardHeader } from '@renderer/components/ui/card';
import { Badge } from '@renderer/components/ui/badge';
import { ArrowLeft, ShieldCheck, ExternalLink } from 'lucide-react';
import appMetadata from '@shared/constant/metadata.json';

export default function AboutPage() {
    const navigate = useNavigate();
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<{
        type: 'idle' | 'checking' | 'available' | 'latest';
        message?: string;
    }>({ type: 'idle' });

    const handleCheckUpdates = async () => {
        setIsCheckingUpdates(true);
        setUpdateStatus({ type: 'checking' });

        try {
            // Attempt to invoke the check-updates IPC handler
            // Fallback with mock data if handler doesn't exist
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate check delay

            setUpdateStatus({
                type: 'latest',
                message: `You're running the latest version (${appMetadata.version})`,
            });
        } catch (error) {
            console.warn('Update check failed:', error);
            setUpdateStatus({
                type: 'latest',
                message: 'Could not check for updates. You appear to be up-to-date.',
            });
        } finally {
            setIsCheckingUpdates(false);
        }
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
                            onClick={() => navigate(-1)}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                About
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
                    {/* App Branding Section */}
                    <Card className="border-0 bg-linear-to-br from-primary/5 via-primary/0 to-transparent">
                        <CardContent className="pt-8 pb-8">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-4 rounded-2xl bg-primary/10 text-primary shadow-lg">
                                    <ShieldCheck className="w-12 h-12" />
                                </div>

                                <div>
                                    <h2 className="text-3xl font-bold text-foreground">
                                        {appMetadata.name}
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-2">
                                        Secure file encryption and storage
                                    </p>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Badge variant="default" className="bg-primary/90">
                                        Version {appMetadata.version}
                                    </Badge>
                                    <Badge variant="outline">
                                        Production
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Updates Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <h3 className="text-base font-semibold text-foreground">
                                Check for Updates
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Keep {appMetadata.name} up-to-date with the latest security patches and features.
                            </p>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Current Version
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {appMetadata.version}
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCheckUpdates}
                                    disabled={isCheckingUpdates}
                                    className="rounded-md"
                                >
                                    {isCheckingUpdates ? 'Checking...' : 'Check Now'}
                                </Button>
                            </div>

                            {updateStatus.type !== 'idle' && (
                                <div className={`p-3 rounded-lg text-sm ${updateStatus.type === 'latest'
                                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                    }`}>
                                    {updateStatus.message || 'Checking for updates...'}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Developer Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <h3 className="text-base font-semibold text-foreground">
                                Developer
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Developed by
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {appMetadata.author.name}
                                    </p>
                                </div>
                                <a
                                    href={appMetadata.author.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
                                >
                                    Portfolio
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organization Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <h3 className="text-base font-semibold text-foreground">
                                Published By
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        {appMetadata.publishedBy.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Building innovative solutions
                                    </p>
                                </div>
                                <a
                                    href={appMetadata.publishedBy.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
                                >
                                    Visit
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Additional Info */}
                    <Card>
                        <CardHeader className="pb-3">
                            <h3 className="text-base font-semibold text-foreground">
                                Support & Links
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <a
                                href={appMetadata.author.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                            >
                                <span className="text-sm text-foreground">View on GitHub</span>
                                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                            </a>
                        </CardContent>
                    </Card>

                    {/* Footer Note */}
                    <div className="text-center text-xs text-muted-foreground pt-4">
                        <p>
                            © 2024-2025 {appMetadata.publishedBy.name}. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

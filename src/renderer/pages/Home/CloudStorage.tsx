import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Cloud, RefreshCw, Settings, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { CloudStatus } from "@shared/types/cloudDrive";

import driveIcon from "@/assets/cloud-providers/google-drive.svg";
import dropboxIcon from "@/assets/cloud-providers/dropbox.svg";
import onedriveIcon from "@/assets/cloud-providers/onedrive.svg";
import megaIcon from "@/assets/cloud-providers/mega.svg";

const cloudIcons: Record<string, string> = {
    "google-drive": driveIcon,
    "dropbox": dropboxIcon,
    "onedrive": onedriveIcon,
    "mega": megaIcon,
};


export default function CloudStorage() {
    const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);

    useEffect(() => {
        (async () => {
            const status = await window.cloudDrive.getCloudStatus();
            setCloudStatus(status);
        })();
    }, []);

    if (!cloudStatus) {
        return (
            <Card className="md:col-span-5 flex flex-col border-border/70 bg-card/95 shadow-sm min-h-72">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                        <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between space-y-6">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                            <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                            <div className="h-5 w-48 bg-muted rounded animate-pulse" />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-6">
                        <div className="h-10 w-28 bg-muted rounded-md animate-pulse" />
                        <div className="h-10 flex-1 bg-muted rounded-md animate-pulse" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { isActive } = cloudStatus;
    const activeDrives = cloudStatus.drives.filter(d => d.isActive);

    return (
        <Card className="md:col-span-5 flex flex-col border-border/70 bg-card/95 shadow-sm min-h-72">
            <CardHeader>
                <CardTitle className="flex items-center text-lg text-foreground">
                    <Cloud className={`mr-2 h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    Cloud Sync
                </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col justify-between">
                {/* 2. Inactive / Empty State */}
                {!isActive ? (
                    <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-center">
                        <div className="rounded-full bg-muted/50 p-4">
                            <Cloud className="h-8 w-8 text-muted-foreground/70" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-foreground">Cloud backup is not active</h3>
                            <p className="text-sm text-muted-foreground max-w-62.5">
                                Secure your data by connecting a cloud drive.
                            </p>
                        </div>
                        <Button disabled className="mt-2" onClick={() => console.log('Initiate setup')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Setup Backup
                        </Button>
                    </div>
                ) : (
                    /* 3. Active State */
                    <div className="flex flex-col flex-1 justify-between space-y-6">
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-muted-foreground mb-2">Total Cloud Drives Connected</p>
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl font-bold text-foreground leading-none">
                                        {activeDrives.length}
                                    </span>

                                    {activeDrives.length > 0 && (
                                        <div className="flex -space-x-2">
                                            {activeDrives.slice(0, 3).map((drive, i) => (
                                                <div
                                                    key={i}
                                                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary shadow-sm overflow-hidden"
                                                    title={drive.provider}
                                                >
                                                    <img
                                                        src={cloudIcons[drive.provider] || driveIcon}
                                                        alt={drive.provider}
                                                        className="h-4 w-4"
                                                    />
                                                </div>
                                            ))}
                                            {activeDrives.length > 3 && (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground shadow-sm">
                                                    +{activeDrives.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Last Backup On</p>
                                <p className="font-medium text-foreground">{cloudStatus.lastBackup}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-6">
                            <Button variant="secondary" size="lg">
                                <Settings className="mr-2 h-4 w-4" />
                                Manage
                            </Button>

                            <Button className="flex-1" size="lg">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Instant Backup
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
import { lazy, useEffect, useState } from 'react';
import type { AppData } from "@shared/types/global";

import TitleBar from '@renderer/components/navigation/Titlebar';
import CloudStorage from './CloudStorage';
import MenuCard from './MenuCard';
import { Skeleton } from "@/components/ui/skeleton";

import cloudBurstLabLogo from "@/assets/cloudburst_lab_logo_transparent.png";
import appIcon from "@/assets/icon.svg";

const StatusBox = lazy(() => import('./StatusBox'));

export default function HomePage() {
    const [appData, setAppData] = useState<AppData | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await window.appWindow.getAppData();
                setAppData(data);
            } catch (err) {
                console.error("Failed to load app data:", err);
            }
        })();
    }, []);

    if (!appData) {
        return (
            <>
                <TitleBar />
                <div className="mx-auto max-w-7xl space-y-5 py-3 px-6 lg:px-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="size-9.5 rounded-full mt-2 shrink-0" />
                            <Skeleton className="h-9 w-64" />
                        </div>
                        <Skeleton className="h-5 w-32 ml-13 mt-1" />
                    </div>
                    <div className="mt-12 grid flex-1 grid-cols-1 gap-4 md:grid-cols-12 lg:gap-6">
                        <Skeleton className="md:col-span-7 min-h-74 rounded-xl" />
                        <Skeleton className="md:col-span-5 min-h-74 rounded-xl" />
                    </div>
                </div>
            </>
        );
    }

    // 2. Render the actual app once data is loaded
    return (
        <>
            <TitleBar />
            <div className="mx-auto max-w-7xl space-y-5 py-3 px-6 lg:px-8">
                <div>
                    <div className="flex items-center gap-3">
                        <img
                            src={appIcon}
                            height={38}
                            width={38}
                            alt={appData.name}
                            className="mt-2 shrink-0"
                        />
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            {appData.name}
                        </h1>
                    </div>
                    <p className="max-w-2xl pl-13 text-sm leading-6 text-muted-foreground">
                        Version {appData.version}
                    </p>
                </div>
                
                <div className="mt-12 grid flex-1 grid-cols-1 gap-4 md:grid-cols-12 lg:gap-6">
                    <StatusBox />
                    <CloudStorage />
                </div>
                <MenuCard />
            </div>
            
            <footer className="mt-3 flex shrink-0 items-center justify-end gap-2 bg-background/70 px-4 py-2">
                <p className="text-xs font-semibold text-muted-foreground">An open source software by</p>
                <img
                    src={cloudBurstLabLogo}
                    height={15}
                    width={50}
                    alt={appData.publishedBy.name}
                />
            </footer>
        </>
    );
}
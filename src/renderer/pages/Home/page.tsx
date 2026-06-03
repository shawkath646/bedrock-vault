import { lazy, Suspense } from 'react';
const LocalStorage = lazy(() => import('./Localstorage'));
import CloudStorage from './CloudStorage';
import MenuCard from './MenuCard';
import appMetadata from "@shared/constant/metadata.json";
import TitleBar from '@renderer/components/navigation/Titlebar';
import cloudBurstLabLogo from "@/assets/cloudburst_lab_logo_transparent.png";
import appIcon from "@/assets/icon_1024x1024.png";


export default function HomePage() {
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
                            alt={appMetadata.publishedBy.name}
                            className="mt-2"
                        />
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{appMetadata.name}</h1>
                    </div>
                    <p className="max-w-2xl pl-13 text-sm leading-6 text-muted-foreground">
                        Version {appMetadata.version}
                    </p>
                </div>
                <div className="mt-12 grid flex-1 grid-cols-1 gap-4 md:grid-cols-12 lg:gap-6">
                    <Suspense fallback={
                        <div className="md:col-span-7 flex flex-col border border-border/70 bg-card/95 shadow-sm rounded-xl p-6 min-h-74 justify-between">
                            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                            <div className="flex gap-6 items-center flex-1 mt-4">
                                <div className="size-40 rounded-full border-12 border-muted animate-pulse shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-16 bg-muted rounded animate-pulse" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-12 bg-muted rounded animate-pulse" />
                                        <div className="h-12 bg-muted rounded animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    }>
                        <LocalStorage />
                    </Suspense>
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
                    alt={appMetadata.publishedBy.name}
                />
            </footer>
        </>
    );
}
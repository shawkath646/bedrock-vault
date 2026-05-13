import LocalStorage from './Localstorage';
import CloudStorage from './CloudStorage';
import MenuCard from './MenuCard';
import Footer from '@renderer/components/navigation/Footer';
import { ShieldCheck } from "lucide-react";
import appMetadata from "@shared/constant/metadata.json";
import TitleBar from '@renderer/components/navigation/Titlebar';

export default function HomePage() {
    return (
        <>
            <TitleBar />
            <div className="mx-auto max-w-7xl space-y-5 py-3 px-6 lg:px-8">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-primary/15 bg-primary/10 p-2 text-primary shadow-sm">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{appMetadata.name}</h1>
                    </div>
                    <p className="max-w-2xl pl-13 text-sm leading-6 text-muted-foreground">
                        Version {appMetadata.version}
                    </p>
                </div>
                <div className="mt-12 grid flex-1 grid-cols-1 gap-4 md:grid-cols-12 lg:gap-6">
                    <LocalStorage />
                    <CloudStorage />
                </div>
                <MenuCard />
            </div>
            <Footer />
        </>
    );
}
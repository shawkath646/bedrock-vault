import { app } from "electron";
import type { AppUpdateInfo } from "@shared/types/global";

export const getAppMetadata = () => ({
    name: app.getName(),
    version: app.getVersion(),
    author: {
        name: "Shawkat Hossain Maruf",
        url: "https://shawkath646.pro"
    },
    publishedBy: {
        name: "Cloudburst Lab",
        url: "https://cloudburstlab.vercel.app",
        icon: "https://cloudburstlab.vercel.app/api/branding/logo?variant=transparent"
    }
});

export const getAppUpdateInfo = (): AppUpdateInfo => {
    return {
        updateAvailable: true,
        lastUpdate: '2026-05-28',
        currentVersion: app.getVersion(),
        latestVersion: '1.2.5',
        updateUrl: 'https://github.com/shawkath646/bedrock-vault',
        releaseNotes: [
            "Added TPM hardware acceleration for level 2 and 3 encryption.",
            "Improved memory wiping for cached passwords.",
            "Optimized the UI layout for 1000x700 displays.",
            "Fixed a bug where the app would crash on empty folder selection.",
            "Upgraded the underlying Electron framework to v28 for better security."
        ]
    };
};
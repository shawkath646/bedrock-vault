import { app } from "electron";

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

export const getAppUpdateInfo = () => {
    return {
        lastUpdate: '2026-05-28',
        currentVersion: app.getVersion(),
        latestVersion: '1.2.5',
        updateUrl: 'https://github.com/shawkath646/anonymous-file-storage'
    };
};
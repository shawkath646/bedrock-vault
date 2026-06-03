import appMetadata from '@shared/constant/metadata.json'


export const getAppUpdateInfo = () => {
    return {
        lastUpdate: '2026-05-28',
        currentVersion: appMetadata.version,
        latestVersion: '1.2.5',
        updateUrl: 'https://github.com/shawkath646/anonymous-file-storage'
    };
};
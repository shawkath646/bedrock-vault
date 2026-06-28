import type { CloudStatus } from "@shared/types/cloud-drive";

export default class CloudSyncService {
    start() {
        console.log("Cloud service started")
    }

    stop() {
        console.log("Cloud service stopped")
    }

    public async getCloudStatus(): Promise<CloudStatus> {
        const cloudStatus: CloudStatus = {
            isActive: false,
            lastBackup: new Date("2026-06-30").toLocaleString(),
            drives: [
                {
                    isActive: false,
                    provider: "google-drive"
                },
                {
                    isActive: true,
                    provider: "onedrive"
                },
                {
                    isActive: true,
                    provider: "dropbox"
                },
                {
                    isActive: true,
                    provider: "mega"
                },
            ]
        };
        return cloudStatus;
    }
}
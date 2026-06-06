interface CloudDriveStatus {
    provider: string;
    isActive: boolean;
}

export interface CloudStatus {
    isActive: boolean;
    lastBackup: string;
    drives: CloudDriveStatus[];
}
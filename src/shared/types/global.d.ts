import { VALID_ENCRYPTION_LEVELS } from "@shared/constant/encryption-options.constants";

export interface AppConfig {
    initialized: boolean;
    theme: "system" | "light" | "dark";
    shouldUpdate: boolean;
    inactivityTimeoutMs?: number;
}

export type EncryptionLevel = typeof VALID_ENCRYPTION_LEVELS[number];

export type PopupType = 'info' | 'warning' | 'error' | 'success';

export interface PopupPayload {
    type: PopupType;
    message: string;
    closable: boolean;
}

export type SaveResult<T> =
    | { success: true; data: T }
    | { success: false; errors: Record<string, string[]> };

export interface AppData {
    name: string;
    version: string;
    author: {
        name: string;
        url: string;
    };
    publishedBy: {
        name: string;
        url: string;
        icon: string;
    };
}

export type AppUpdateInfo = {
    updateAvailable: true;
    lastUpdate: string;
    currentVersion: string;
    latestVersion: string;
    updateUrl: string;
    releaseNotes: string[];
} | {
    updateAvailable: false;
    lastUpdate: string;
    currentVersion: string;
    releaseNotes: string[];
}
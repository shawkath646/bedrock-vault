export interface AppConfig {
    initialized: boolean;
    theme: "system" | "light" | "dark";
    shouldUpdate: boolean;
}

export type PopupType = 'info' | 'warning' | 'error' | 'success';

export interface PopupPayload {
    type: PopupType;
    message: string;
    /** If true the user must dismiss manually; if false it auto-closes after 4 s. */
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
export type PopupType = 'info' | 'warning' | 'error' | 'success';

export interface PopupPayload {
    type: PopupType;
    message: string;
    /** If true the user must dismiss manually; if false it auto-closes after 4 s. */
    closable: boolean;
}

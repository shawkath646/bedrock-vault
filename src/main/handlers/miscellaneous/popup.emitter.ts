import type { PopupPayload, PopupType } from '@shared/types/global';
import type WindowManager from '../../window-manager';

export type { PopupPayload, PopupType };

export class PopupService {
    private windowManager: WindowManager;

    constructor(windowManager: WindowManager) {
        this.windowManager = windowManager;
    }

    public showPopup(type: PopupType, message: string, closable = false): void {
        this.windowManager.getMainWindow()?.webContents.send('popup:show', { type, message, closable });
    }
}

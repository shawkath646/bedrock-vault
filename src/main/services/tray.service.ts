import { Menu, Tray } from "electron";
import { getAppAssetPath } from '@main/utils/path.utils';
import type WindowManager from '@main/window-manager';

export default class TrayService {
    private tray: Tray | null = null;

    private windowManager: WindowManager;
    private onStartForeground: () => void;
    private onQuitApp: () => void;

    constructor(
        windowManager: WindowManager,
        onStartForeground: () => void,
        onQuitApp: () => void
    ) {
        this.windowManager = windowManager;
        this.onStartForeground = onStartForeground;
        this.onQuitApp = onQuitApp;
    }

    public createTrayIcon(): void {
        this.tray = new Tray(getAppAssetPath('icon'));

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open Bedrock Vault',
                click: () => this.handleOpenApp()
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => this.onQuitApp()
            }
        ]);

        this.tray.setToolTip('Bedrock Vault');
        this.tray.setContextMenu(contextMenu);

        this.tray.on('click', () => this.handleOpenApp());
    }

    public getTray(): Tray | null {
        return this.tray;
    }

    public destroy(): void {
        if (this.tray && !this.tray.isDestroyed()) {
            this.tray.destroy();
            this.tray = null;
        }
    }

    private handleOpenApp(): void {
        const mainWindow = this.windowManager.getMainWindow();

        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
        } else {
            this.onStartForeground();
        }
    }
}
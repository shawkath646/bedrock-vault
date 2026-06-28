import { BrowserWindow } from 'electron'
import { getAppAssetPath } from './utils/path.utils'
import type { LoggerService } from './utils/logger'

export default class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private previewWindow: BrowserWindow | null = null;
    private logsWindow: BrowserWindow | null = null;
    private devServerUrl?: string;
    private logger: LoggerService | null = null;

    constructor(devServerUrl?: string) {
        this.devServerUrl = devServerUrl;
    }

    public setLoggerService(logger: LoggerService) {
        this.logger = logger;
    }

    public createMainWindow(): BrowserWindow {
        if (this.mainWindow) {
            this.mainWindow.focus();
            return this.mainWindow;
        }

        this.mainWindow = new BrowserWindow({
            width: 1000,
            height: 700,
            frame: false,
            icon: getAppAssetPath('icon'),
            webPreferences: {
                preload: getAppAssetPath('preload'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            },
            fullscreenable: false,
            resizable: false
        });

        if (this.logger) void this.logger.info('WindowManager', 'Main window instance created');

        this.mainWindow.on('closed', () => {
            if (this.logger) void this.logger.info('WindowManager', 'Main window closed. Tearing down child windows.');
            this.mainWindow = null;

            if (this.logsWindow) {
                this.logsWindow.close();
            }
            if (this.previewWindow) {
                this.previewWindow.close();
            }
        });

        this.loadRoute(this.mainWindow, '');

        return this.mainWindow;
    }

    public createPreviewWindow(streamUrl: string, token: string): BrowserWindow {
        if (this.previewWindow) {
            this.previewWindow.close();
        }

        this.previewWindow = new BrowserWindow({
            width: 1100,
            height: 800,
            title: 'Media Preview',
            frame: false,
            webPreferences: {
                preload: getAppAssetPath('preload'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            },
            resizable: true,
            backgroundColor: '#000000',
            x: 150,
            y: 100
        });

        if (this.logger) void this.logger.info('WindowManager', 'Preview window instance created');

        this.previewWindow.on('closed', () => {
            if (this.logger) void this.logger.info('WindowManager', 'Preview window closed');
            this.previewWindow = null;
        });

        const safeStreamUrl = encodeURIComponent(streamUrl);
        const route = `/decryption/preview?src=${safeStreamUrl}&token=${token}`;

        this.loadRoute(this.previewWindow, route);

        return this.previewWindow;
    }

    public createLogsWindow(): BrowserWindow {
        if (this.logsWindow) {
            this.logsWindow.focus();
            return this.logsWindow;
        }

        this.logsWindow = new BrowserWindow({
            width: 850,
            height: 600,
            title: 'System Logs',
            frame: false,
            webPreferences: {
                preload: getAppAssetPath('preload'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            },
            resizable: true
        });

        if (this.logger) void this.logger.info('WindowManager', 'Logs window instance created');

        this.logsWindow.on('closed', () => {
            if (this.logger) void this.logger.info('WindowManager', 'Logs window closed');
            this.logsWindow = null;
        });

        this.loadRoute(this.logsWindow, '/logs');

        return this.logsWindow;
    }

    public getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    /**
     * Private helper to cleanly handle URL loading for both Dev and Prod environments
     */
    private loadRoute(window: BrowserWindow, hashRoute: string) {
        if (this.devServerUrl) {
            const url = hashRoute ? `${this.devServerUrl}#${hashRoute}` : this.devServerUrl;
            void window.loadURL(url);
        } else {
            if (hashRoute) {
                void window.loadFile(getAppAssetPath('dist'), { hash: hashRoute });
            } else {
                void window.loadFile(getAppAssetPath('dist'));
            }
        }
    }
}
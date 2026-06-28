import { globalShortcut, BrowserWindow } from 'electron';
import type { AppConfigService } from '../handlers/config/app-config.handler';
import type LoggerService from '../utils/logger';

export class PanicButtonService {
    private appConfigService: AppConfigService;
    private logger: LoggerService;
    private currentHotkey: string | null = null;

    constructor(appConfigService: AppConfigService, logger: LoggerService) {
        this.appConfigService = appConfigService;
        this.logger = logger;
    }

    public async initialize(): Promise<void> {
        const config = await this.appConfigService.fetchAppConfiguration();
        const enabled = config.panicButtonEnabled ?? false;
        const hotkey = config.panicButtonHotkey ?? "CommandOrControl+Shift+L";

        if (enabled) {
            this.register(hotkey);
        }
    }

    public async getStatus(): Promise<{ enabled: boolean; hotkey: string }> {
        const config = await this.appConfigService.fetchAppConfiguration();
        return {
            enabled: config.panicButtonEnabled ?? false,
            hotkey: config.panicButtonHotkey ?? "CommandOrControl+Shift+L"
        };
    }

    public async set(enabled: boolean, hotkey: string): Promise<{ success: boolean; error?: string }> {
        try {
            if (this.currentHotkey) {
                globalShortcut.unregister(this.currentHotkey);
                this.currentHotkey = null;
            }

            if (enabled && !this.checkAvailability(hotkey)) {
                const config = await this.appConfigService.fetchAppConfiguration();
                if (config.panicButtonEnabled && config.panicButtonHotkey) {
                    this.register(config.panicButtonHotkey);
                }
                return { success: false, error: 'HOTKEY_ALREADY_ASSIGNED' };
            }

            if (enabled) {
                this.register(hotkey);
            }

            await this.appConfigService.updateAppConfiguration(undefined, {
                panicButtonEnabled: enabled,
                panicButtonHotkey: hotkey
            });

            return { success: true };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logger.error('PanicButton', `Failed to set panic button: ${errorMessage}`);
            return { success: false, error: 'INTERNAL_ERROR' };
        }
    }

    public checkAvailability(hotkey: string): boolean {
        return !globalShortcut.isRegistered(hotkey);
    }

    private register(hotkey: string): void {
        try {
            const success = globalShortcut.register(hotkey, () => {
                void this.logger.warn('App', 'Panic Button triggered! Closing all windows immediately.');
                const windows = BrowserWindow.getAllWindows();
                for (const window of windows) {
                    if (!window.isDestroyed()) {
                        window.close();
                    }
                }
            });

            if (!success) {
                void this.logger.error('PanicButton', `Failed to register global shortcut: ${hotkey}`);
            } else {
                this.currentHotkey = hotkey;
                void this.logger.info('PanicButton', `Successfully registered global shortcut: ${hotkey}`);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void this.logger.error('PanicButton', `Error registering shortcut ${hotkey}: ${errorMessage}`);
        }
    }
}

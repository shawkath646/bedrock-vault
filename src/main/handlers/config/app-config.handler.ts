import { app, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import z from 'zod';
import type { AppConfig } from '@shared/types/global';
import type LoggerService from '@main/utils/logger';

const defaultAppConfig: AppConfig = {
    initialized: false,
    theme: 'system',
    shouldUpdate: false,
    inactivityTimeoutMs: 300000,
};

const appConfigFilePath = path.join(app.getPath('userData'), 'config.json');

const AppConfigSchema: z.ZodSchema<AppConfig> = z.object({
    initialized: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
    shouldUpdate: z.boolean(),
    inactivityTimeoutMs: z.number().int().positive().default(300000),
    panicButtonEnabled: z.boolean().default(false).optional(),
    panicButtonHotkey: z.string().default("CommandOrControl+Shift+L").optional(),
    appLockEnabled: z.boolean().default(false).optional(),
});

export class AppConfigService {
    private logger: LoggerService;

    constructor(logger: LoggerService) {
        this.logger = logger;
    }

    private async ensureAppConfigDirectoryExists(): Promise<void> {
        await fs.mkdir(path.dirname(appConfigFilePath), { recursive: true });
    }

    public async resetAppConfiguration(): Promise<AppConfig> {
        await this.ensureAppConfigDirectoryExists();
        await fs.writeFile(appConfigFilePath, JSON.stringify(defaultAppConfig, null, 2));
        await this.logger.warn('AppConfig', 'App configuration has been reset to defaults');
        return defaultAppConfig;
    }

    public async fetchAppConfiguration(): Promise<AppConfig> {
        try {
            const rawContent = await fs.readFile(appConfigFilePath, 'utf-8');
            const parsed = AppConfigSchema.parse(JSON.parse(rawContent));
            await this.logger.info('AppConfig', 'App configuration loaded successfully');
            return parsed;
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code !== 'ENOENT') {
                console.error('Failed to read or validate app config:', error);
                await this.logger.error('AppConfig', `Failed to read or validate app config: ${error}`);
            } else {
                await this.logger.info('AppConfig', 'No existing config file found, using defaults');
            }
            return defaultAppConfig;
        }
    }

    public async updateAppConfiguration(_event: IpcMainInvokeEvent | undefined, partialConfig: Partial<AppConfig>): Promise<AppConfig> {
        const existingConfig = await this.fetchAppConfiguration();
        const mergedConfig = {
            ...existingConfig,
            ...partialConfig,
        };

        const validatedConfig = AppConfigSchema.parse(mergedConfig);

        await this.ensureAppConfigDirectoryExists();
        const tempFilePath = `${appConfigFilePath}.tmp`;
        await fs.writeFile(tempFilePath, JSON.stringify(validatedConfig, null, 2));
        await fs.rename(tempFilePath, appConfigFilePath);

        await this.logger.info('AppConfig', `App configuration updated: ${JSON.stringify(partialConfig)}`);

        return validatedConfig;
    }
}
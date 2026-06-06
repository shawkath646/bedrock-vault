import { app, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import z from 'zod';
import type { AppConfig } from '@shared/types/global';
import logger from '../../utils/logger';

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
});

async function ensureAppConfigDirectoryExists(): Promise<void> {
    await fs.mkdir(path.dirname(appConfigFilePath), { recursive: true });
}

export async function resetAppConfiguration(): Promise<AppConfig> {
    await ensureAppConfigDirectoryExists();
    await fs.writeFile(appConfigFilePath, JSON.stringify(defaultAppConfig, null, 2));
    await logger.warn('AppConfig', 'App configuration has been reset to defaults');
    return defaultAppConfig;
}

export async function fetchAppConfiguration(): Promise<AppConfig> {
    try {
        const rawContent = await fs.readFile(appConfigFilePath, 'utf-8');
        const parsed = AppConfigSchema.parse(JSON.parse(rawContent));
        await logger.info('AppConfig', 'App configuration loaded successfully');
        return parsed;
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
            console.error('Failed to read or validate app config:', error);
            await logger.error('AppConfig', `Failed to read or validate app config: ${error}`);
        } else {
            await logger.info('AppConfig', 'No existing config file found, using defaults');
        }
        return defaultAppConfig;
    }
}

export async function updateAppConfiguration(_event: IpcMainInvokeEvent, partialConfig: Partial<AppConfig>): Promise<AppConfig> {
    const existingConfig = await fetchAppConfiguration();
    const mergedConfig = {
        ...existingConfig,
        ...partialConfig,
    };

    const validatedConfig = AppConfigSchema.parse(mergedConfig);

    await ensureAppConfigDirectoryExists();
    await fs.writeFile(appConfigFilePath, JSON.stringify(validatedConfig, null, 2));

    await logger.info('AppConfig', `App configuration updated: ${JSON.stringify(partialConfig)}`);

    return validatedConfig;
}
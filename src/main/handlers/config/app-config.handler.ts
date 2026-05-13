import { app, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import z from 'zod';
import type { AppConfig } from '@shared/types/global';

const defaultAppConfig: AppConfig = {
    initialized: false,
    theme: 'system',
    shouldUpdate: false,
};

const appConfigFilePath = path.join(app.getPath('userData'), 'config.json');

const AppConfigSchema: z.ZodSchema<AppConfig> = z.object({
    initialized: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
    shouldUpdate: z.boolean(),
});

async function ensureAppConfigDirectoryExists(): Promise<void> {
    await fs.mkdir(path.dirname(appConfigFilePath), { recursive: true });
}

export async function resetAppConfiguration(): Promise<AppConfig> {
    await ensureAppConfigDirectoryExists();
    await fs.writeFile(appConfigFilePath, JSON.stringify(defaultAppConfig, null, 2));
    return defaultAppConfig;
}

export async function fetchAppConfiguration(): Promise<AppConfig> {
    try {
        const rawContent = await fs.readFile(appConfigFilePath, 'utf-8');
        return AppConfigSchema.parse(JSON.parse(rawContent));
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
            console.error('Failed to read or validate app config:', error);
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

    return validatedConfig;
}
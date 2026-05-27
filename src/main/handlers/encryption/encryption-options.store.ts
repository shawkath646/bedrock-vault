import { type IpcMainInvokeEvent, app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import z from 'zod';
import { fetchAllSelectedItems } from "@main/handlers/file-selection/file-selection.handler"
import { defaultOptions as defaultOptions } from '@shared/constant/encryptionOptions';
import type { EncryptionOptions } from '@shared/types/fileEncryption';
import appMetadata from "@shared/constant/metadata.json";

const encryptionOptionsFilePath = path.join(app.getPath('userData'), 'encryption_preferences.json');

const getDefaultOptions = (): EncryptionOptions => {

    const chunkName = fetchAllSelectedItems().selectedOptions.chunkName;
    const defaultPath = path.join(app.getPath("documents"), appMetadata.name, chunkName);

    return {
        ...defaultOptions,
        fileOutputDirectory: defaultPath,
        backupKeyFileDirectory: defaultPath,
        backupKeyDirectory: defaultPath
    }
};

const EncryptionOptionsSchema: z.ZodType<EncryptionOptions> = z.object({
    encryptionLevel: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3)
    ]),
    keySaveDirectory: z.string(),
    fileOutputDirectory: z.string(),
    backupKeyFileDirectory: z.string().optional(),
    encryptFileNameAndDirectory: z.boolean(),
    addToCloudSync: z.boolean(),
    addTrap: z.boolean(),
});

async function ensureEncryptionOptionsDirectoryExists(): Promise<void> {
    await fs.mkdir(path.dirname(encryptionOptionsFilePath), { recursive: true });
}

export async function selectEncryptionOutputDirectory(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });

    if (canceled || filePaths.length === 0) {
        return null;
    }

    return filePaths[0];
}

export async function fetchEncryptionOptions(): Promise<EncryptionOptions> {
    try {
        const rawContent = await fs.readFile(encryptionOptionsFilePath, 'utf-8');
        return EncryptionOptionsSchema.parse(JSON.parse(rawContent));
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
            console.error('Failed to read or validate encryption options:');
            await fs.rm(encryptionOptionsFilePath, { force: true });
        }

        return getDefaultOptions();
    }
}

export async function updateEncryptionOptions(
    _event: IpcMainInvokeEvent | undefined,
    partialOptions: Partial<EncryptionOptions>,
): Promise<EncryptionOptions> {
    const existingOptions = await fetchEncryptionOptions();
    const mergedOptions = {
        ...existingOptions,
        ...partialOptions,
    };

    const validatedOptions = EncryptionOptionsSchema.parse(mergedOptions);

    await ensureEncryptionOptionsDirectoryExists();
    await fs.writeFile(encryptionOptionsFilePath, JSON.stringify(validatedOptions, null, 2));

    return validatedOptions;
}

export async function resetEncryptionOptions(): Promise<EncryptionOptions> {
    await ensureEncryptionOptionsDirectoryExists();
    await fs.writeFile(encryptionOptionsFilePath, JSON.stringify(getDefaultOptions(), null, 2));
    return getDefaultOptions();
}
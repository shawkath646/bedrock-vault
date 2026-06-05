import { type IpcMainInvokeEvent, app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import z from 'zod';
import { fetchAllSelectedItems } from "@main/handlers/file-selection/file-selection.handler"
import { defaultOptions } from '@shared/constant/encryption-options.constants';
import type { EncryptionOptions } from '@shared/types/fileEncryption';
import type { SaveResult } from '@shared/types/global';
import logger from '@main/utils/logger';
import { isSoftwareKspAvailable, isTpmAvailable } from '@main/utils/native-crypto';
import { validatePath, ensureIsFilePath } from '@main/utils/path.utils';
import {
  DEFAULT_RECOVERY_PHRASE_FILENAME,
  DEFAULT_KEY_FILENAME,
  PREFERENCES_FILENAME
} from '@main/constant/file.constants';

const encryptionOptionsFilePath = path.join(app.getPath('userData'), PREFERENCES_FILENAME);

const getDefaultOptions = (): EncryptionOptions => {
    const chunkName = fetchAllSelectedItems().selectedOptions.chunkName;
    const defaultPath = path.join(app.getPath("documents"), app.getName(), chunkName);

    return {
        ...defaultOptions,
        encryptionLevel: (isTpmAvailable() || isSoftwareKspAvailable()) ? 3 : 1,
        fileOutputDirectory: defaultPath,
        recoveryPhrasePath: path.join(defaultPath, DEFAULT_RECOVERY_PHRASE_FILENAME),
        recoveryPhraseFilePath: path.join(defaultPath, DEFAULT_KEY_FILENAME),
        addToRecordTable: true
    }
};

const EncryptionOptionsSchema: z.ZodType<EncryptionOptions> = z.object({
    encryptionLevel: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3)
    ]),
    fileOutputDirectory: z.string().refine(validatePath, { error: "Invalid path selected" }),
    recoveryPhrasePath: z.string().refine(validatePath, { error: "Invalid path selected" }),
    recoveryPhraseFilePath: z.string().refine(validatePath, { error: "Invalid path selected" }).optional(),
    encryptFileNameAndDirectory: z.boolean(),
    addToCloudSync: z.boolean(),
    addTrap: z.boolean(),
    cleanupAfterEncryption: z.boolean(),
    addToRecordTable: z.boolean(),
});

async function ensureEncryptionOptionsDirectoryExists(): Promise<void> {
    await fs.mkdir(path.dirname(encryptionOptionsFilePath), { recursive: true });
}

export async function selectEncryptionOutputDirectory(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });

    if (canceled || filePaths.length === 0) {
        await logger.info('EncryptionOptions', 'Encryption output directory selection cancelled');
        return null;
    }

    await logger.info('EncryptionOptions', `Encryption output directory selected: ${filePaths[0]}`);
    return filePaths[0];
}

export async function selectRecoveryPhraseSavePath(): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: DEFAULT_RECOVERY_PHRASE_FILENAME,
        filters: [{ name: 'Recovery Phrase Text File', extensions: ['txt'] }],
    });

    if (canceled || !filePath) {
        await logger.info('EncryptionOptions', 'Recovery phrase save path selection cancelled');
        return null;
    }

    await logger.info('EncryptionOptions', `Recovery phrase save path selected: ${filePath}`);
    return filePath;
}

export async function selectFileKeySavePath(): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: DEFAULT_KEY_FILENAME,
    });

    if (canceled || !filePath) {
        await logger.info('EncryptionOptions', 'File key save path selection cancelled');
        return null;
    }

    await logger.info('EncryptionOptions', `File key save path selected: ${filePath}`);
    return filePath;
}

export async function fetchEncryptionOptions(): Promise<EncryptionOptions> {
    try {
        const rawContent = await fs.readFile(encryptionOptionsFilePath, 'utf-8');
        const parsed = EncryptionOptionsSchema.parse(JSON.parse(rawContent));
        await logger.info('EncryptionOptions', 'Encryption preferences loaded successfully');
        return parsed;
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
            console.error('Failed to read or validate encryption options.');
            await logger.error('EncryptionOptions', `Failed to read or validate encryption preferences: ${error}`);
            await fs.rm(encryptionOptionsFilePath, { force: true });
        } else {
            await logger.info('EncryptionOptions', 'No custom encryption preferences found, using default preferences');
        }

        return getDefaultOptions();
    }
}

export async function updateEncryptionOptions(
    _event: IpcMainInvokeEvent | undefined,
    partialOptions: Partial<EncryptionOptions>,
): Promise<SaveResult<EncryptionOptions>> {
    try {
        const existingOptions = await fetchEncryptionOptions();
        const mergedOptions = {
            ...existingOptions,
            ...partialOptions,
        };

        if (mergedOptions.recoveryPhrasePath) {
            mergedOptions.recoveryPhrasePath = ensureIsFilePath(mergedOptions.recoveryPhrasePath, DEFAULT_RECOVERY_PHRASE_FILENAME)!;
        }
        if (mergedOptions.recoveryPhraseFilePath) {
            mergedOptions.recoveryPhraseFilePath = ensureIsFilePath(mergedOptions.recoveryPhraseFilePath, DEFAULT_KEY_FILENAME)!;
        }

        const validatedOptions = EncryptionOptionsSchema.parse(mergedOptions);

        await ensureEncryptionOptionsDirectoryExists();
        await fs.writeFile(encryptionOptionsFilePath, JSON.stringify(validatedOptions, null, 2));

        await logger.info('EncryptionOptions', `Encryption preferences updated: ${JSON.stringify(partialOptions)}`);

        return { success: true, data: validatedOptions };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
            };
        }
        throw error;
    }
}

export async function resetEncryptionOptions(): Promise<EncryptionOptions> {
    await ensureEncryptionOptionsDirectoryExists();
    await fs.writeFile(encryptionOptionsFilePath, JSON.stringify(getDefaultOptions(), null, 2));
    await logger.warn('EncryptionOptions', 'Encryption preferences have been reset to defaults');
    return getDefaultOptions();
}
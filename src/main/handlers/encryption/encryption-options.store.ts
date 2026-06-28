import { type IpcMainInvokeEvent, app, dialog } from 'electron';
import path from 'node:path';
import z from 'zod';
import { defaultOptions } from '@shared/constant/encryption-options.constants';
import type { EncryptionOptions } from '@shared/types/file-encryption';
import type { SaveResult } from '@shared/types/global';
import type LoggerService from '@main/utils/logger';
import type { FileSelectionOptions, SelectedFile } from '@shared/types/file-selection';
import type { NativeCryptoService } from '@main/utils/native-crypto';
import { validatePath, ensureIsFilePath } from '@main/utils/path.utils';
import {
    DEFAULT_RECOVERY_PHRASE_FILENAME,
    DEFAULT_KEY_FILENAME
} from '@main/constant/file.constants';


type FetchAllSelectedItemsFn = () => {
    selectedFiles: SelectedFile[];
    totalSize: number;
    fileCount: number;
    selectedOptions: FileSelectionOptions;
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

export class EncryptionOptionsService {
    private sessionOptions: EncryptionOptions | null = null;
    private fetchAllSelectedItems: FetchAllSelectedItemsFn;
    private logger: LoggerService;
    private nativeCrypto: NativeCryptoService;

    constructor(
        fetchAllSelectedItems: FetchAllSelectedItemsFn,
        logger: LoggerService,
        nativeCrypto: NativeCryptoService
    ) {
        this.fetchAllSelectedItems = fetchAllSelectedItems;
        this.logger = logger;
        this.nativeCrypto = nativeCrypto;
    }

    public cleanup(): void {
        this.sessionOptions = null;
    }

    public async selectEncryptionOutputDirectory(): Promise<string | null> {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory'],
        });

        if (canceled || filePaths.length === 0) {
            await this.logger.info('EncryptionOptions', 'Encryption output directory selection cancelled');
            return null;
        }

        await this.logger.info('EncryptionOptions', `Encryption output directory selected: ${filePaths[0]}`);
        return filePaths[0];
    }

    public async selectRecoveryPhraseSavePath(): Promise<string | null> {
        const { canceled, filePath } = await dialog.showSaveDialog({
            defaultPath: DEFAULT_RECOVERY_PHRASE_FILENAME,
            filters: [{ name: 'Recovery Phrase Text File', extensions: ['txt'] }],
        });

        if (canceled || !filePath) {
            await this.logger.info('EncryptionOptions', 'Recovery phrase save path selection cancelled');
            return null;
        }

        await this.logger.info('EncryptionOptions', `Recovery phrase save path selected: ${filePath}`);
        return filePath;
    }

    public async selectFileKeySavePath(): Promise<string | null> {
        const { canceled, filePath } = await dialog.showSaveDialog({
            defaultPath: DEFAULT_KEY_FILENAME,
        });

        if (canceled || !filePath) {
            await this.logger.info('EncryptionOptions', 'File key save path selection cancelled');
            return null;
        }

        await this.logger.info('EncryptionOptions', `File key save path selected: ${filePath}`);
        return filePath;
    }

    public async fetchEncryptionOptions(): Promise<EncryptionOptions> {
        if (this.sessionOptions) {
            return this.sessionOptions;
        }
        return this.getDefaultOptions();
    }

    public async updateEncryptionOptions(
        _event: IpcMainInvokeEvent | undefined,
        partialOptions: Partial<EncryptionOptions>,
    ): Promise<SaveResult<EncryptionOptions>> {
        try {
            const existingOptions = await this.fetchEncryptionOptions();
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

            // Store only in memory
            this.sessionOptions = validatedOptions;

            await this.logger.info('EncryptionOptions', `Encryption preferences updated: ${JSON.stringify(partialOptions)}`);

            return { success: true, data: validatedOptions };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    success: false,
                    errors: error.flatten().fieldErrors as Record<string, string[]>,
                };
            }
            throw error;
        }
    }

    public async resetEncryptionOptions(): Promise<EncryptionOptions> {
        this.sessionOptions = this.getDefaultOptions();
        await this.logger.warn('EncryptionOptions', 'Encryption preferences have been reset to defaults');
        return this.sessionOptions;
    }

    // --- PRIVATE HELPERS ---

    private getDefaultOptions(): EncryptionOptions {
        // We dynamically call the injected function here to ensure we get the latest state
        const chunkName = this.fetchAllSelectedItems().selectedOptions.chunkName;
        const defaultPath = path.join(app.getPath("documents"), app.getName(), chunkName);

        return {
            ...defaultOptions,
            encryptionLevel: (this.nativeCrypto.isTpmAvailable() || this.nativeCrypto.isSoftwareKspAvailable()) ? 3 : 1,
            fileOutputDirectory: defaultPath,
            recoveryPhrasePath: path.join(defaultPath, DEFAULT_RECOVERY_PHRASE_FILENAME),
            recoveryPhraseFilePath: path.join(defaultPath, DEFAULT_KEY_FILENAME),
            addToRecordTable: true
        };
    }
}
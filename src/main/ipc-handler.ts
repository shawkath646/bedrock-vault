import { ipcMain, BrowserWindow } from 'electron';
import type WindowManager from './window-manager';
import type FileSelectionService from './handlers/file-selection/file-selection.handler';
import type LoggerService from './utils/logger';
import type { AppConfigService } from './handlers/config/app-config.handler';
import type { EncryptionOptionsService } from './handlers/encryption/encryption-options.store';
import type { EncryptionSessionService } from './handlers/encryption/helpers/abort-controller.helper';
import type { EncryptionWorkflowService } from './handlers/encryption/encryption-workflow.main';
import type { PopupService } from './handlers/miscellaneous/popup.emitter';
import type { EncryptionEmitterService } from "./handlers/encryption/helpers/encryption-emitter.helper";
import type CloudSyncService from '@main/services/cloud-sync.service';
import type { NativeCryptoService } from '@main/utils/native-crypto';
import type { ShellCommandsService } from '@main/handlers/miscellaneous/shell-commands';
import type { AppInfoService } from './handlers/miscellaneous/miscellaneous';
import type { EncryptionRecordService } from './utils/enc-record';
import type { DecryptionService } from './handlers/decryption/decrypt-metadata.main';
import type { VaultFileService } from './handlers/decryption/open-vault-file';
import type { AutoLockerService } from './handlers/decryption/helpers/auto-locker.helpers';
import type { PanicButtonService } from './services/panic-button.service';

export interface AppServices {
    windowManager: WindowManager;
    fileSelectionService: FileSelectionService;
    loggerService: LoggerService;
    appConfigService: AppConfigService;
    encryptionOptionsService: EncryptionOptionsService;
    encryptionSessionService: EncryptionSessionService;
    encryptionWorkflowService: EncryptionWorkflowService;
    popupService: PopupService;
    encryptionEmitterService: EncryptionEmitterService;
    cloudSyncService: CloudSyncService;
    nativeCryptoService: NativeCryptoService;
    shellCommandsService: ShellCommandsService;
    appInfoService: AppInfoService;
    encryptionRecordService: EncryptionRecordService;
    decryptionService: DecryptionService;
    vaultFileService: VaultFileService;
    autoLockerService: AutoLockerService;
    panicButtonService: PanicButtonService;
}

export function registerIpcHandlers(services: AppServices): void {
    const { 
        windowManager, 
        fileSelectionService,
        loggerService,
        appConfigService,
        encryptionOptionsService,
        encryptionSessionService,
        encryptionWorkflowService,
        cloudSyncService,
        nativeCryptoService,
        shellCommandsService,
        appInfoService,
        encryptionRecordService,
        decryptionService,
        vaultFileService,
        autoLockerService,
        panicButtonService
    } = services;

    // Window Management
    ipcMain.handle('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
    ipcMain.handle('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
    
    if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
        ipcMain.handle('open-dev-tools', () => windowManager.getMainWindow()?.webContents.openDevTools({ mode: 'detach' }));
    }

    // System / Shell
    ipcMain.handle('open-file-with-sys-app', (e, p) => shellCommandsService.openPathWithSysApp(e, p));
    ipcMain.handle('open-external-url', (e, u) => shellCommandsService.openExternalUrl(e, u));

    // Configuration & Updates
    ipcMain.handle('get-app-config', () => appConfigService.fetchAppConfiguration());
    ipcMain.handle('save-app-config', (e, config) => appConfigService.updateAppConfiguration(e, config));
    ipcMain.handle('get-app-update-info', () => appInfoService.getAppUpdateInfo());
    ipcMain.handle('get-cloud-status', () => cloudSyncService.getCloudStatus());
    ipcMain.handle('get-app-data', () => appInfoService.getAppMetadata());

    // File Selection
    ipcMain.handle('get-selected-files-state', () => fileSelectionService.fetchSelectedFilesState());
    ipcMain.handle('save-selected-files-options', (event, options) => fileSelectionService.updateFileSelectionOptions(event, options));
    ipcMain.handle('add-selected-files', (event, options) => fileSelectionService.handleFileSelectionAddFiles(event, options));
    ipcMain.handle('add-selected-folder', (event, options) => fileSelectionService.handleFileSelectionAddFolder(event, options));
    ipcMain.handle('remove-selected-item', (event, targetPath) => fileSelectionService.handleFileSelectionRemoveItem(event, targetPath));
    ipcMain.handle('clear-selected-items', () => fileSelectionService.clearSelectedItems());
    ipcMain.handle('get-current-path-files', (event, currentPath) => fileSelectionService.fetchCurrentPathSelectedFiles(event, currentPath));

    // Encryption Setup
    ipcMain.handle('get-encryption-options', () => encryptionOptionsService.fetchEncryptionOptions());
    ipcMain.handle('save-encryption-options', (e, opts) => encryptionOptionsService.updateEncryptionOptions(e, opts));
    ipcMain.handle('select-encrypted-output-directory', () => encryptionOptionsService.selectEncryptionOutputDirectory());
    ipcMain.handle('select-recovery-phrase-save-path', () => encryptionOptionsService.selectRecoveryPhraseSavePath());
    ipcMain.handle('select-file-key-save-path', () => encryptionOptionsService.selectFileKeySavePath());
    ipcMain.handle('prompt-and-set-password', () => encryptionSessionService.setEncryptionPassword());
    ipcMain.handle('has-encryption-password', () => encryptionSessionService.hasEncryptionPassword());
    ipcMain.handle('clear-encryption-password', () => encryptionSessionService.clearCachedPassword());
    ipcMain.handle('is-tpm-available', () => nativeCryptoService.isTpmAvailable());
    ipcMain.handle('is-software-ksp-available', () => nativeCryptoService.isSoftwareKspAvailable());

    // Encryption Workflow
    ipcMain.handle('start-encryption-flow', () => encryptionWorkflowService.handleStartEncryptionWorkflow());
    ipcMain.handle('abort-encryption-flow', () => encryptionSessionService.abortEncryption());

    // Encryption Record Management
    ipcMain.handle('encryption-record:get-records', () => encryptionRecordService.getRecords());
    ipcMain.handle('encryption-record:add-record', () => encryptionRecordService.addRecord());
    ipcMain.handle('encryption-record:remove-record', (e, dir, delPerm) => encryptionRecordService.removeRecord(e, dir, delPerm));

    // Decryption Workflow
    ipcMain.handle('decryption:decrypt-metadata', (e, dir) => decryptionService.decryptMetadata(e, dir));
    ipcMain.handle('decryption:get-current-path-files', (e, path) => decryptionService.fetchCurrentPathDecryptedFiles(e, path));
    ipcMain.handle('decryption:open-vault-file', (e, path) => vaultFileService.openVaultFile(e, path));
    ipcMain.handle('decryption:lock-vault', () => decryptionService.clearDecryptedCache());
    ipcMain.on('start-security-timer', () => autoLockerService.startSecurityTimer());
    ipcMain.on('stop-security-timer', () => autoLockerService.stopSecurityTimer());
    ipcMain.on('ping-activity', () => autoLockerService.pingActivity());

    // Panic Button
    ipcMain.handle('panic-button:status', () => panicButtonService.getStatus());
    ipcMain.handle('panic-button:set', (e, enabled, hotkey) => panicButtonService.set(enabled, hotkey));
    ipcMain.handle('panic-button:checkAvailability', (e, hotkey) => panicButtonService.checkAvailability(hotkey));

    // Logging & Tools
    ipcMain.handle('app-log', (e, level, op, msg) => loggerService.logRenderer(e, level, op, msg));
    ipcMain.handle('fetch-logs', () => loggerService.fetchLogs());
    ipcMain.handle('view-logs-folder', () => loggerService.viewLogsFolder());
    ipcMain.handle('open-logs-window', () => windowManager.createLogsWindow());
}
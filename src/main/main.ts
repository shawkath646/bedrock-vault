import { app, globalShortcut } from 'electron';
import LoggerService from './utils/logger';
import { registerIpcHandlers } from './ipc-handler';
import WindowManager from './window-manager';

import TrayService from './services/tray.service';
import CloudSyncService from './services/cloud-sync.service';
import { MediaServerService } from './handlers/decryption/media-server';
import FileSelectionService from './handlers/file-selection/file-selection.handler';

import { AppConfigService } from './handlers/config/app-config.handler';
import { NativeCryptoService } from './utils/native-crypto';
import { EncryptionOptionsService } from './handlers/encryption/encryption-options.store';
import { EncryptionSessionService } from './handlers/encryption/helpers/abort-controller.helper';
import { PopupService } from './handlers/miscellaneous/popup.emitter';
import { EncryptionEmitterService } from './handlers/encryption/helpers/encryption-emitter.helper';
import { EncryptionWorkflowService } from './handlers/encryption/encryption-workflow.main';
import { AppInfoService } from './handlers/miscellaneous/miscellaneous';
import { ShellCommandsService } from './handlers/miscellaneous/shell-commands';
import { EncryptionRecordService } from './utils/enc-record';
import { DecryptionService } from './handlers/decryption/decrypt-metadata.main';
import { VaultFileService } from './handlers/decryption/open-vault-file';
import { AutoLockerService } from './handlers/decryption/helpers/auto-locker.helpers';
import { PanicButtonService } from './services/panic-button.service';

const windowManager = new WindowManager(process.env.VITE_DEV_SERVER_URL);
const loggerService = new LoggerService();
windowManager.setLoggerService(loggerService);
const fileSelectionService = new FileSelectionService(loggerService);
const appConfigService = new AppConfigService(loggerService);
const nativeCryptoService = new NativeCryptoService(windowManager);
const encryptionOptionsService = new EncryptionOptionsService(() => fileSelectionService.fetchAllSelectedItems(), loggerService, nativeCryptoService);
const popupService = new PopupService(windowManager);
const encryptionEmitterService = new EncryptionEmitterService(windowManager);
const encryptionSessionService = new EncryptionSessionService(nativeCryptoService);
const encryptionRecordService = new EncryptionRecordService(loggerService);
const encryptionWorkflowService = new EncryptionWorkflowService(
  loggerService,
  fileSelectionService,
  encryptionOptionsService,
  encryptionSessionService,
  encryptionEmitterService,
  encryptionRecordService,
  nativeCryptoService
);
const cloudSyncService = new CloudSyncService();
const shellCommandsService = new ShellCommandsService(fileSelectionService, encryptionOptionsService);
const appInfoService = new AppInfoService();

const mediaServerService = new MediaServerService(loggerService);
const decryptionService = new DecryptionService(mediaServerService, loggerService, nativeCryptoService);
const vaultFileService = new VaultFileService(decryptionService, mediaServerService, windowManager, loggerService);
const autoLockerService = new AutoLockerService(decryptionService, encryptionSessionService, appConfigService, loggerService);
const panicButtonService = new PanicButtonService(appConfigService, loggerService);

let isQuitting = false;

export function quitApp() {
  isQuitting = true;
  app.quit();
}

const trayService = new TrayService(windowManager, startForeground, quitApp);

app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    return;
  }

  globalShortcut.unregisterAll();
  trayService.destroy();
  cloudSyncService.stop();
});

app.on('window-all-closed', () => {
  void loggerService.info('App', 'All windows closed, switching to background mode');
  
  // Clean up services
  fileSelectionService.cleanup();
  encryptionOptionsService.cleanup();
  encryptionSessionService.cleanup();
  encryptionEmitterService.clearFileProgressThrottle();
  
  // Securely lock the vault and stop timers
  decryptionService.clearDecryptedCache();
  autoLockerService.stopSecurityTimer();
});

function setupSingleInstanceLock(): boolean {
  const gotLock = app.requestSingleInstanceLock();

  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      startForeground();
    }
  });

  return true;
}

async function startForeground() {
  const config = await appConfigService.fetchAppConfiguration();
  if (config.appLockEnabled) {
    const authenticated = await nativeCryptoService.authenticateOsUser();
    if (!authenticated) {
      quitApp();
      return;
    }
  }

  await fileSelectionService.initialize();
  windowManager.createMainWindow();
}

if (setupSingleInstanceLock()) {

  registerIpcHandlers({
    windowManager,
    fileSelectionService,
    loggerService,
    appConfigService,
    encryptionOptionsService,
    encryptionSessionService,
    encryptionWorkflowService,
    popupService,
    encryptionEmitterService,
    cloudSyncService,
    nativeCryptoService,
    shellCommandsService,
    appInfoService,
    encryptionRecordService,
    decryptionService,
    vaultFileService,
    autoLockerService,
    panicButtonService
  });

  app.whenReady().then(async () => {
    await loggerService.initialize();
    await loggerService.info('APP_START', `version=${app.getVersion()}`);

    trayService.createTrayIcon();
    cloudSyncService.start();
    
    // Register custom protocol once for the whole application lifecycle
    mediaServerService.registerMediaProtocol();

    // Initialize Panic Button global shortcut
    await panicButtonService.initialize();

    await startForeground();
  });
}
import { dialog, BrowserWindow } from 'electron';
import type { DecryptionService } from '../decrypt-metadata.main';
import type { EncryptionSessionService } from '@main/handlers/encryption/helpers/abort-controller.helper';
import type { AppConfigService } from '@main/handlers/config/app-config.handler';
import type LoggerService from '@main/utils/logger';

export class AutoLockerService {
  private inactivityTimer: NodeJS.Timeout | null = null;
  private isVaultActive = false;

  private decryptionService: DecryptionService;
  private encryptionSessionService: EncryptionSessionService;
  private appConfigService: AppConfigService;
  private logger: LoggerService;

  constructor(
    decryptionService: DecryptionService,
    encryptionSessionService: EncryptionSessionService,
    appConfigService: AppConfigService,
    logger: LoggerService
  ) {
    this.decryptionService = decryptionService;
    this.encryptionSessionService = encryptionSessionService;
    this.appConfigService = appConfigService;
    this.logger = logger;
  }

  private async getInactivityTimeout(): Promise<number> {
    try {
      const config = await this.appConfigService.fetchAppConfiguration();
      return config.inactivityTimeoutMs ?? 300000;
    } catch {
      return 300000;
    }
  }

  public async executeAutoLock(): Promise<void> {
    if (this.encryptionSessionService.isInProgress()) {
      void this.logger.warn('AutoLocker', 'Skipping auto-lock: encryption in progress');
      await this.resetTimer();
      return;
    }

    this.isVaultActive = false;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    this.decryptionService.clearDecryptedCache();
    this.encryptionSessionService.clearCachedPassword();
    this.encryptionSessionService.abortEncryption();

    await this.logger.warn('AutoLocker', 'Inactivity timeout reached. Locking vault.');

    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('vault-locked-inactivity');
      }
    }

    if (windows.length > 0 && !windows[0].isDestroyed()) {
      await dialog.showMessageBox(windows[0], {
        type: 'warning',
        title: 'Vault Locked',
        message: 'Your vault was automatically locked due to inactivity.',
      });
    } else {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Vault Locked',
        message: 'Your vault was automatically locked due to inactivity.',
      });
    }
  }

  private async resetTimer(): Promise<void> {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    const timeoutMs = await this.getInactivityTimeout();
    this.inactivityTimer = setTimeout(() => {
      void this.executeAutoLock();
    }, timeoutMs);
  }

  public async startSecurityTimer() {
    void this.logger.info('AutoLocker', 'Starting security timer');
    this.isVaultActive = true;
    await this.resetTimer();
  }

  public stopSecurityTimer() {
    void this.logger.info('AutoLocker', 'Stopping security timer');
    this.isVaultActive = false;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  public async pingActivity() {
    if (this.isVaultActive) {
      await this.resetTimer();
    }
  }
}
import { dialog, BrowserWindow } from 'electron';
import { clearDecryptedCache } from '../decrypt-metadata.main';
import { clearCachedPassword, abortEncryption, isInProgress } from '@main/handlers/encryption/helpers/abort-controller.helper';
import { fetchAppConfiguration } from '@main/handlers/config/app-config.handler';
import logger from '@main/utils/logger';

let inactivityTimer: NodeJS.Timeout | null = null;
let isVaultActive = false;

async function getInactivityTimeout(): Promise<number> {
  try {
    const config = await fetchAppConfiguration();
    return config.inactivityTimeoutMs ?? 300000;
  } catch {
    return 300000;
  }
}

export async function executeAutoLock(): Promise<void> {
  if (isInProgress()) {
    void logger.warn('AutoLocker', 'Skipping auto-lock: encryption in progress');
    await resetTimer();
    return;
  }

  isVaultActive = false;
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  clearDecryptedCache();
  clearCachedPassword();
  abortEncryption();

  await logger.warn('AutoLocker', 'Inactivity timeout reached. Locking vault.');

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

async function resetTimer(): Promise<void> {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  const timeoutMs = await getInactivityTimeout();
  inactivityTimer = setTimeout(() => {
    void executeAutoLock();
  }, timeoutMs);
}

export const startSecurityTimer = async () => {
  void logger.info('AutoLocker', 'Starting security timer');
  isVaultActive = true;
  await resetTimer();
}

export const stopSecurityTimer = () => {
  void logger.info('AutoLocker', 'Stopping security timer');
  isVaultActive = false;
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

export const pingActivity = async () => {
  if (isVaultActive) {
    await resetTimer();
  }
}
import { shell, type IpcMainInvokeEvent } from 'electron';
import { getActiveSelectedFolder, getDecryptedFileKeyEntry } from '../decryption/decrypt-metadata.main';
import os from 'node:os';
import pathModule from 'node:path';
import { normalizeVirtualPath } from '@main/handlers/file-selection/file-selection.utils';

export const openVaultFile = async (_event: IpcMainInvokeEvent, virtualPath: string) => {
  const activeFolder = getActiveSelectedFolder();
  if (!activeFolder) {
    throw new Error('Vault is not open');
  }

  const normalized = normalizeVirtualPath(virtualPath);
  const entry = getDecryptedFileKeyEntry(normalized);
  if (!entry) {
    throw new Error(`File not found in vault: ${virtualPath}`);
  }

  const platform = os.platform();
  let mountedPath: string;

  if (platform === 'win32') {
    mountedPath = 'Z:' + normalized.replace(/\//g, '\\');
  } else if (platform === 'darwin') {
    mountedPath = pathModule.join('/Volumes/SecureVault', normalized);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const errorMsg = await shell.openPath(mountedPath);
  if (errorMsg) {
    throw new Error(errorMsg);
  }
  return { success: true };
}


import { dialog, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath } from '@main/utils/path.utils';
import { askPassword } from '@main/utils/native-crypto';
import logger from '@main/utils/logger';
import { decryptMetadataPayload } from './helpers/decryption.helpers';
import type { DecryptedFileEntry, DecryptMetadataResult } from '@shared/types/file-decryption';
import {
  getVirtualParentPath,
  getVirtualBaseName,
  normalizeVirtualPath,
} from '@main/handlers/file-selection/file-selection.utils';
import {
  startWebDavServer,
  mountDrive,
  unmountDriveAndStop,
} from '@main/handlers/webdav/webdav-server';

let decryptedItemsMap: Map<string, DecryptedFileEntry> | null = null;
let childrenIndexMap: Map<string, string[]> | null = null;
const secureFileKeysMap = new Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }>();
let activeSelectedFolder: string | null = null;

export function getDecryptedFileKeyEntry(virtualPath: string) {
  return secureFileKeysMap.get(virtualPath) || null;
}

export function getDecryptedItemsMap(): Map<string, DecryptedFileEntry> | null {
  return decryptedItemsMap;
}

export function getChildrenIndexMap(): Map<string, string[]> | null {
  return childrenIndexMap;
}

export function getSecureFileKeysMap(): Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }> {
  return secureFileKeysMap;
}

export function getActiveSelectedFolder(): string | null {
  return activeSelectedFolder;
}

export function clearDecryptedCache(): void {
  decryptedItemsMap = null;
  childrenIndexMap = null;
  activeSelectedFolder = null;
  for (const entry of secureFileKeysMap.values()) {
    entry.key.fill(0);
    entry.iv.fill(0);
  }
  secureFileKeysMap.clear();
  void unmountDriveAndStop();
}

function getRootLevelDecryptedFiles(map: Map<string, DecryptedFileEntry>): DecryptedFileEntry[] {
  const folderPaths = new Set(
    [...map.values()]
      .filter((file) => file.isDir)
      .map((file) => file.virtualPath)
  );

  return [...map.values()].filter((file) => {
    const parentDirectory = getVirtualParentPath(file.virtualPath);
    return parentDirectory === null || !folderPaths.has(parentDirectory);
  });
}

export async function fetchCurrentPathDecryptedFiles(
  _event: IpcMainInvokeEvent,
  currentPath: string | null
): Promise<DecryptedFileEntry[]> {
  if (!decryptedItemsMap) {
    return [];
  }

  if (!currentPath) {
    return getRootLevelDecryptedFiles(decryptedItemsMap);
  }

  const normalizedCurrentPath = normalizeVirtualPath(currentPath);
  const result: DecryptedFileEntry[] = [];

  for (const item of decryptedItemsMap.values()) {
    const parentPath = getVirtualParentPath(item.virtualPath);
    if (parentPath === normalizedCurrentPath) {
      result.push(item);
    }
  }

  return result;
}

export default async function decryptMetadata(
  _event: IpcMainInvokeEvent,
  directoryPath?: string
): Promise<DecryptMetadataResult> {
  decryptedItemsMap = null;
  activeSelectedFolder = null;
  for (const entry of secureFileKeysMap.values()) {
    entry.key.fill(0);
    entry.iv.fill(0);
  }
  secureFileKeysMap.clear();

  let selectedFolder = directoryPath;

  if (!selectedFolder) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'CANCELLED' };
    }

    selectedFolder = filePaths[0];
  }

  if (!validatePath(selectedFolder)) {
    return { success: false, error: 'INVALID_PATH' };
  }

  const metadataPath = path.join(selectedFolder, 'v');
  try {
    await fs.access(metadataPath);
  } catch {
    return { success: false, error: 'NO_METADATA_FILE' };
  }

  let passwordBuffer: Buffer | null = null;

  try {
    const metadataBuffer = await fs.readFile(metadataPath);
    passwordBuffer = await askPassword();
    if (!passwordBuffer) {
      return { success: false, error: 'PASSWORD_REQUIRED' };
    }

    const decrypted = await decryptMetadataPayload(metadataBuffer, passwordBuffer);

    const allFilesInDir = new Set(await fs.readdir(selectedFolder));
    const map = new Map<string, DecryptedFileEntry>();

    for (const entry of decrypted.fileMetadata) {
      const safeEncName = path.basename(entry.encName);
      const isAvailable = allFilesInDir.has(safeEncName);
      const normalizedPath = normalizeVirtualPath(entry.virtualPath);

      map.set(normalizedPath, {
        name: entry.name,
        encName: safeEncName,
        virtualPath: normalizedPath,
        size: entry.size,
        ext: entry.ext,
        isAvailable,
        isDir: false
      });

      secureFileKeysMap.set(normalizedPath, {
        key: entry.key,
        iv: entry.iv,
        encName: safeEncName,
        size: entry.size,
        ext: entry.ext
      });

      let currentParent = getVirtualParentPath(normalizedPath);
      while (currentParent !== null && currentParent !== '/') {
        if (!map.has(currentParent)) {
          const folderName = getVirtualBaseName(currentParent);
          map.set(currentParent, {
            name: folderName,
            virtualPath: currentParent,
            size: 0,
            ext: '',
            isAvailable: true,
            isDir: true
          });
        }
        currentParent = getVirtualParentPath(currentParent);
      }
    }

    const childrenMap = new Map<string, string[]>();
    const folderPaths = new Set(
      [...map.values()].filter((f) => f.isDir).map((f) => f.virtualPath)
    );

    for (const item of map.values()) {
      const parentPath = getVirtualParentPath(item.virtualPath);
      if (parentPath === null || !folderPaths.has(parentPath)) {
        if (!childrenMap.has('/')) {
          childrenMap.set('/', []);
        }
        childrenMap.get('/')!.push(path.basename(item.virtualPath));
      } else {
        if (!childrenMap.has(parentPath)) {
          childrenMap.set(parentPath, []);
        }
        childrenMap.get(parentPath)!.push(path.basename(item.virtualPath));
      }
    }

    for (const [k, val] of childrenMap.entries()) {
      childrenMap.set(k, [...new Set(val)]);
    }

    decryptedItemsMap = map;
    childrenIndexMap = childrenMap;
    activeSelectedFolder = selectedFolder;

    try {
      const mountInfo = await startWebDavServer();
      if (mountInfo) {
        await mountDrive(mountInfo.port, mountInfo.mountToken);
      }
    } catch (err) {
      await logger.error('DecryptionHandler', `WebDAV mount failed: ${err}`);
    }

    return {
      success: true,
      chunkName: decrypted.chunkName,
      level: decrypted.level,
    };

  } catch (err: unknown) {
    await logger.error('DecryptionHandler', `Decryption workflow error: ${err}`);
    decryptedItemsMap = null;
    childrenIndexMap = null;
    activeSelectedFolder = null;
    for (const entry of secureFileKeysMap.values()) {
      entry.key.fill(0);
      entry.iv.fill(0);
    }
    secureFileKeysMap.clear();
    void unmountDriveAndStop();

    if (err instanceof Error) {
      if (err.message === 'INVALID_METADATA_HEADER' || err.message === 'CORRUPTED_METADATA') {
        return { success: false, error: 'CORRUPTED_METADATA' };
      }
      if (err.message === 'INVALID_PASSWORD') {
        return { success: false, error: 'INVALID_PASSWORD' };
      }
      if (err.message === 'TPM_UNAVAILABLE') {
        return { success: false, error: 'TPM_UNAVAILABLE', level: (err as Error & { level?: number }).level };
      }
      if (err.name === 'ZodError') {
        return { success: false, error: 'INVALID_METADATA_STRUCTURE' };
      }
    }
    
    return { success: false, error: 'DECRYPTION_FAILED' };
  } finally {
    if (passwordBuffer) {
      passwordBuffer.fill(0);
    }
  }
}

export function setTestingMaps(
  items: Map<string, DecryptedFileEntry> | null,
  keys: Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }>,
  folder: string | null
): void {
  decryptedItemsMap = items;
  activeSelectedFolder = folder;
  secureFileKeysMap.clear();
  for (const [k, v] of keys.entries()) {
    secureFileKeysMap.set(k, v);
  }
}

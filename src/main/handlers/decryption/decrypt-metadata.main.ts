import { dialog, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath } from '@main/utils/path.utils';
import type { NativeCryptoService } from '@main/utils/native-crypto';
import type LoggerService from '@main/utils/logger';
import { decryptMetadataPayload } from './helpers/decryption.helpers';
import type { DecryptedFileEntry, DecryptMetadataResult } from '@shared/types/file-decryption';
import {
  getVirtualParentPath,
  getVirtualBaseName,
  normalizeVirtualPath,
} from '@main/handlers/file-selection/file-selection.utils';
import type { MediaServerService } from './media-server';

export class DecryptionService {
  private decryptedItemsMap: Map<string, DecryptedFileEntry> | null = null;
  private childrenIndexMap: Map<string, string[]> | null = null;
  private secureFileKeysMap = new Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }>();
  private activeSelectedFolder: string | null = null;
  private mediaServerService: MediaServerService;
  private logger: LoggerService;
  private nativeCrypto: NativeCryptoService;

  constructor(mediaServerService: MediaServerService, logger: LoggerService, nativeCrypto: NativeCryptoService) {
    this.mediaServerService = mediaServerService;
    this.logger = logger;
    this.nativeCrypto = nativeCrypto;
    this.mediaServerService.setDecryptionService(this);
  }

  public getDecryptedFileKeyEntry(virtualPath: string) {
    return this.secureFileKeysMap.get(virtualPath) || null;
  }

  public getDecryptedItemsMap(): Map<string, DecryptedFileEntry> | null {
    return this.decryptedItemsMap;
  }

  public getChildrenIndexMap(): Map<string, string[]> | null {
    return this.childrenIndexMap;
  }

  public getSecureFileKeysMap(): Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }> {
    return this.secureFileKeysMap;
  }

  public getActiveSelectedFolder(): string | null {
    return this.activeSelectedFolder;
  }

  public clearDecryptedCache(): void {
    this.decryptedItemsMap = null;
    this.childrenIndexMap = null;
    this.activeSelectedFolder = null;
    this.mediaServerService.clearMediaTokens();
    for (const entry of this.secureFileKeysMap.values()) {
      entry.key.fill(0);
      entry.iv.fill(0);
    }
    this.secureFileKeysMap.clear();
  }

  private getRootLevelDecryptedFiles(map: Map<string, DecryptedFileEntry>): DecryptedFileEntry[] {
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

  public async fetchCurrentPathDecryptedFiles(
    _event: IpcMainInvokeEvent | undefined,
    currentPath: string | null
  ): Promise<DecryptedFileEntry[]> {
    if (!this.decryptedItemsMap) {
      return [];
    }

    if (!currentPath) {
      return this.getRootLevelDecryptedFiles(this.decryptedItemsMap);
    }

    const normalizedCurrentPath = normalizeVirtualPath(currentPath);
    const result: DecryptedFileEntry[] = [];

    for (const item of this.decryptedItemsMap.values()) {
      const parentPath = getVirtualParentPath(item.virtualPath);
      if (parentPath === normalizedCurrentPath) {
        result.push(item);
      }
    }

    return result;
  }

  public async decryptMetadata(
    _event: IpcMainInvokeEvent | undefined,
    directoryPath?: string
  ): Promise<DecryptMetadataResult> {
    this.decryptedItemsMap = null;
    this.activeSelectedFolder = null;
    for (const entry of this.secureFileKeysMap.values()) {
      entry.key.fill(0);
      entry.iv.fill(0);
    }
    this.secureFileKeysMap.clear();

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
      passwordBuffer = await this.nativeCrypto.askPassword();
      if (!passwordBuffer) {
        return { success: false, error: 'PASSWORD_REQUIRED' };
      }

      const decrypted = await decryptMetadataPayload(metadataBuffer, passwordBuffer, this.logger, this.nativeCrypto);

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

        this.secureFileKeysMap.set(normalizedPath, {
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

      this.decryptedItemsMap = map;
      this.childrenIndexMap = childrenMap;
      this.activeSelectedFolder = selectedFolder;

      return {
        success: true,
        chunkName: decrypted.chunkName,
        level: decrypted.level,
      };

    } catch (err: unknown) {
      await this.logger.error('DecryptionHandler', `Decryption workflow error: ${err}`);
      this.decryptedItemsMap = null;
      this.childrenIndexMap = null;
      this.activeSelectedFolder = null;
      for (const entry of this.secureFileKeysMap.values()) {
        entry.key.fill(0);
        entry.iv.fill(0);
      }
      this.secureFileKeysMap.clear();

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

  public setTestingMaps(
    items: Map<string, DecryptedFileEntry> | null,
    keys: Map<string, { key: Buffer; iv: Buffer; encName: string; size: number; ext: string }>,
    folder: string | null
  ): void {
    this.decryptedItemsMap = items;
    this.activeSelectedFolder = folder;
    this.secureFileKeysMap.clear();
    for (const [k, v] of keys.entries()) {
      this.secureFileKeysMap.set(k, v);
    }
  }
}

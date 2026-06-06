import { v2 as webdav } from 'webdav-server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pathModule from 'node:path';
import { Readable, Writable } from 'node:stream';
import {
  getDecryptedItemsMap,
  getDecryptedFileKeyEntry,
  getActiveSelectedFolder,
  getChildrenIndexMap,
} from '@main/handlers/decryption/decrypt-metadata.main';
import {
  normalizeVirtualPath,
} from '@main/handlers/file-selection/file-selection.utils';
import logger from '@main/utils/logger';

class SecureSerializer implements webdav.FileSystemSerializer {
  uid(): string {
    return 'secure-file-system-serializer';
  }
  serialize(_fs: webdav.FileSystem, callback: webdav.ReturnCallback<unknown>): void {
    callback(undefined, {});
  }
  unserialize(_serializedData: unknown, callback: webdav.ReturnCallback<webdav.FileSystem>): void {
    callback(new Error('Unserialization not supported'));
  }
}

export class SecureFileSystem extends webdav.FileSystem {
  constructor() {
    super(new SecureSerializer());
  }

  // --- CORE STREAMING LOGIC ---

  protected _openReadStream(
    path: webdav.Path,
    _ctx: webdav.OpenReadStreamInfo,
    callback: webdav.ReturnCallback<Readable>
  ): void {
    const virtualPath = normalizeVirtualPath(path.toString());
    const entry = getDecryptedFileKeyEntry(virtualPath);

    if (!entry) {
      return callback(new Error(`File keys not found for path: ${virtualPath}`));
    }

    const activeFolder = getActiveSelectedFolder();
    if (!activeFolder) {
      return callback(new Error('No active vault folder'));
    }

    const physicalPath = pathModule.join(activeFolder, entry.encName);

    fs.promises.open(physicalPath, 'r')
      .then(async (handle) => {
        try {
          const authTag = Buffer.alloc(16);
          await handle.read(authTag, 0, 16, 12 + entry.size);

          const readStream = fs.createReadStream(physicalPath, {
            start: 12,
            end: 12 + entry.size - 1,
          });

          const decipher = crypto.createDecipheriv('aes-256-gcm', entry.key, entry.iv);
          decipher.setAuthTag(authTag);

          decipher.on('error', (err) => {
            void logger.error('SecureFS', `Decipher error for ${virtualPath}: ${err}`);
          });

          callback(undefined, readStream.pipe(decipher));
        } finally {
          await handle.close();
        }
      })
      .catch((err) => {
        void logger.error('SecureFS', `Failed to open read stream: ${err}`);
        callback(err);
      });
  }

  // --- STRICTLY READ-ONLY ENFORCEMENT ---

  protected _openWriteStream(_p: webdav.Path, _i: webdav.OpenWriteStreamInfo, cb: webdav.ReturnCallback<Writable>): void {
    cb(webdav.Errors.Locked);
  }

  protected _create(_p: webdav.Path, _i: webdav.CreateInfo, cb: webdav.SimpleCallback): void {
    cb(webdav.Errors.Locked);
  }

  protected _delete(_p: webdav.Path, _i: webdav.DeleteInfo, cb: webdav.SimpleCallback): void {
    cb(webdav.Errors.Locked);
  }

  protected _move(_pf: webdav.Path, _pt: webdav.Path, _i: webdav.MoveInfo, cb: webdav.ReturnCallback<boolean>): void {
    cb(webdav.Errors.Locked);
  }

  protected _rename(_pf: webdav.Path, _nn: string, _i: webdav.RenameInfo, cb: webdav.ReturnCallback<boolean>): void {
    cb(webdav.Errors.Locked);
  }

  // --- VAULT METADATA LOGIC ---

  protected _size(path: webdav.Path, _ctx: webdav.SizeInfo, callback: webdav.ReturnCallback<number>): void {
    const virtualPath = normalizeVirtualPath(path.toString());
    if (virtualPath === '/') return callback(undefined, 0);

    const entry = getDecryptedItemsMap()?.get(virtualPath);
    if (!entry) return callback(webdav.Errors.ResourceNotFound);

    callback(undefined, entry.size);
  }

  protected _type(path: webdav.Path, _ctx: webdav.TypeInfo, callback: webdav.ReturnCallback<webdav.ResourceType>): void {
    const virtualPath = normalizeVirtualPath(path.toString());
    if (virtualPath === '/') return callback(undefined, webdav.ResourceType.Directory);

    const entry = getDecryptedItemsMap()?.get(virtualPath);
    if (!entry) return callback(webdav.Errors.ResourceNotFound);

    callback(undefined, entry.isDir ? webdav.ResourceType.Directory : webdav.ResourceType.File);
  }

  protected _readDir(path: webdav.Path, _ctx: webdav.ReadDirInfo, callback: webdav.ReturnCallback<string[]>): void {
    const virtualPath = normalizeVirtualPath(path.toString());
    const itemsMap = getDecryptedItemsMap();

    if (!itemsMap) return callback(undefined, []);

    if (virtualPath !== '/' && !itemsMap.has(virtualPath)) {
      return callback(webdav.Errors.ResourceNotFound);
    }

    const childrenMap = getChildrenIndexMap();
    const children = childrenMap?.get(virtualPath) ?? [];
    callback(undefined, children);
  }

  // --- WEBDAV COMPLIANCE BOILERPLATE ---

  protected _lockManager(_p: webdav.Path, _i: webdav.LockManagerInfo, cb: webdav.ReturnCallback<webdav.ILockManager>): void {
    cb(undefined, new webdav.LocalLockManager());
  }

  protected _propertyManager(_p: webdav.Path, _i: webdav.PropertyManagerInfo, cb: webdav.ReturnCallback<webdav.IPropertyManager>): void {
    cb(undefined, new webdav.LocalPropertyManager());
  }

  protected _creationDate(_p: webdav.Path, _i: webdav.CreationDateInfo, cb: webdav.ReturnCallback<number>): void {
    cb(undefined, Date.now());
  }

  protected _lastModifiedDate(_p: webdav.Path, _i: webdav.LastModifiedDateInfo, cb: webdav.ReturnCallback<number>): void {
    cb(undefined, Date.now());
  }
}
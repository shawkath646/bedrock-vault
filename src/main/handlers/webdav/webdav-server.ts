import { v2 as webdav } from 'webdav-server';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import logger from '@main/utils/logger';
import { SecureFileSystem } from './secure-fs';

const execAsync = promisify(exec);

async function safeExec(cmd: string, mountToken: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(cmd);
  } catch (err: unknown) {
    const error = err as Error;
    if (error && typeof error.message === 'string') {
      error.message = error.message.replace(new RegExp(mountToken, 'g'), '[TOKEN_REDACTED]');
    }
    throw error;
  }
}

let server: webdav.WebDAVServer | null = null;
let currentMountInfo: { port: number; mountToken: string } | null = null;

export async function startWebDavServer(): Promise<{ port: number; mountToken: string } | null> {
  if (server) {
    return currentMountInfo;
  }

  const mountToken = crypto.randomBytes(32).toString('hex');

  server = new webdav.WebDAVServer({
    port: 0,
    hostname: '127.0.0.1',
    requireAuthentification: false,
  });

  server.setFileSystemSync('/', new webdav.VirtualFileSystem());

  const secureFS = new SecureFileSystem();
  server.setFileSystemSync(`/${mountToken}`, secureFS);

  server.beforeRequest((ctx, next) => {
    const host = ctx.request.headers['host'];
    if (!host || (!host.startsWith('127.0.0.1:') && host !== '127.0.0.1')) {
      ctx.response.writeHead(403);
      ctx.response.end();
      return;
    }

    const res = ctx.response;
    const req = ctx.request;

    // Reject GET/PROPFIND etc. on paths that don't start with mountToken
    const url = req.url || '';
    const cleanUrl = url.split('?')[0]; // remove query string
    const normalizedUrl = cleanUrl.replace(/\/+/g, '/');

    if (req.method !== 'OPTIONS') {
      if (normalizedUrl !== `/${mountToken}` && !normalizedUrl.startsWith(`/${mountToken}/`)) {
        res.writeHead(403);
        res.end();
        return;
      }
    }

    const originalWriteHead = res.writeHead;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.writeHead = function (statusCode: number, ...args: any[]) {
      const headers = (typeof args[0] === 'object' && args[0] !== null) ? args[0] : {};

      if (statusCode === 401) {
        statusCode = 403;
      }

      delete headers['WWW-Authenticate'];
      delete headers['www-authenticate'];

      if (args.length > 0 && typeof args[0] === 'object') {
        args[0] = headers;
      } else {
        args.unshift(headers);
      }

      return originalWriteHead.call(this, statusCode, ...args);
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'MS-Author-Via': 'DAV',
        'DAV': '1, 2',
        'Allow': 'OPTIONS, GET, HEAD, PROPFIND',
        'Content-Length': '0'
      });
      res.end();
      return;
    }

    next();
  });

  return new Promise((resolve, reject) => {
    server!.start((httpServer) => {
      if (httpServer) {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          currentMountInfo = { port: address.port, mountToken };
          void logger.info('WebDavServer', `WebDAV started on 127.0.0.1:${address.port}/[TOKEN_REDACTED]`);
          resolve(currentMountInfo);
        } else {
          reject(new Error('Failed to retrieve WebDAV address info'));
        }
      } else {
        reject(new Error('HTTP server failed to initialize'));
      }
    });
  });
}

export async function mountDrive(port: number, mountToken: string): Promise<void> {
  const platform = os.platform();

  if (platform === 'win32') {
    await safeExec('net use Z: /delete /y', mountToken).catch(() => { /* Ignore */ });

    try {
      void logger.info('WebDavServer', `Mounting Windows Drive Z:`);
      await safeExec(`net use Z: http://127.0.0.1:${port}/${mountToken} /persistent:no`, mountToken);
    } catch {
      void logger.warn('WebDavServer', `Standard mount failed, retrying with DavWWWRoot`);
      await safeExec(`net use Z: \\\\127.0.0.1@${port}\\DavWWWRoot\\${mountToken} /persistent:no`, mountToken);
    }
  } else if (platform === 'darwin') {
    await fs.promises.mkdir('/Volumes/SecureVault', { recursive: true }).catch(() => { /* Ignore */ });
    await safeExec('umount /Volumes/SecureVault', mountToken).catch(() => { /* Ignore */ });

    void logger.info('WebDavServer', `Mounting macOS Drive`);
    await safeExec(`mount_webdav http://127.0.0.1:${port}/${mountToken} /Volumes/SecureVault`, mountToken);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function unmountDriveAndStop(): Promise<void> {
  const platform = os.platform();
  const cmd = platform === 'win32' ? 'net use Z: /delete /y' : 'umount /Volumes/SecureVault';

  try {
    void logger.info('WebDavServer', `Unmounting drive...`);
    await execAsync(cmd);
  } catch (err) {
    void logger.warn('WebDavServer', `Unmount warning: ${err}`);
  }

  if (server) {
    void logger.info('WebDavServer', 'Stopping WebDAV server');
    await new Promise<void>((resolve) => {
      server!.stop(() => {
        server = null;
        currentMountInfo = null;
        resolve();
      });
    });
  }
}
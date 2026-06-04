import { app } from 'electron'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url';


export function getPreloadPath(): string {
  return join(app.getAppPath(), 'dist/preload/preload.mjs')
}

export function getDistPath(): string {
  return join(app.getAppPath(), 'dist/renderer/index.html')
}

export function getIconPath(): string {
  return join(app.getAppPath(), 'dist/renderer/icon.png')
}

export const WORKER_PATH = (() => {
  try {
    return fileURLToPath(new URL('./handlers/encryption/helpers/run-pool-job.js', import.meta.url));
  } catch {
    return resolve(import.meta.dirname, 'handlers/encryption/helpers/run-pool-job.js');
  }
})();

export function validatePath(inputPath: string): boolean {
  if (typeof inputPath !== 'string' || !inputPath) {
    return false;
  }

  const sanitizedInput = inputPath.replace(/\0/g, '');

  const projectRoot = resolve(process.cwd());
  const absoluteTarget = resolve(projectRoot, sanitizedInput);

  const systemPatterns = [
    /^\/(etc|var|usr|bin|sbin|dev|proc|sys|root|home\/[^/]+(?:\/\.[^/]+)*)$/,
    /^[c-z]:\\(windows|winnt|program files|programdata|users\\[^\\]+\\appdata)/
  ];

  const isSystemPath = systemPatterns.some(pattern => pattern.test(absoluteTarget.toLowerCase()));
  if (isSystemPath) {
    return false;
  }

  return true;
}

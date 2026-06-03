import { app } from 'electron'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url';

/**
 * Get the preload script path relative to the app root at runtime
 */
export function getPreloadPath(): string {
  return join(app.getAppPath(), '../preload/preload.mjs')
}

/**
 * Get the renderer HTML entry point relative to the app root at runtime
 */
export function getDistPath(): string {
  return join(app.getAppPath(), '../renderer/index.html')
}

/**
 * Get the application icon path relative to the app root at runtime
 */
export function getIconPath(): string {
  return join(app.getAppPath(), '../renderer/icon_1024x1024.png')
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

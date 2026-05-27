import { app } from 'electron'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url';

/**
 * Get the preload script path relative to the app root at runtime
 */
export function getPreloadPath(): string {
  return join(app.getAppPath(), 'dist/preload/preload.mjs')
}

/**
 * Get the renderer HTML entry point relative to the app root at runtime
 */
export function getDistPath(): string {
  return join(app.getAppPath(), 'dist/renderer/index.html')
}

export const WORKER_PATH = (() => {
  try {
    return fileURLToPath(new URL('./helpers/run-pool-job.js', import.meta.url));
  } catch {
    return resolve(import.meta.dirname, 'run-pool-job.js');
  }
})();

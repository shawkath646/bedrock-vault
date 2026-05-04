import { app } from 'electron'
import { join } from 'node:path'

/**
 * Get the preload script path relative to the app root at runtime
 */
export function getPreloadPath(): string {
  return join(app.getAppPath(), 'dist-electron/preload.mjs')
}

/**
 * Get the renderer HTML entry point relative to the app root at runtime
 */
export function getDistPath(): string {
  return join(app.getAppPath(), 'dist/index.html')
}

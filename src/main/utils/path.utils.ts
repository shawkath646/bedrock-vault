import { app, dialog } from 'electron';
import * as fs from 'node:fs/promises';
import { statSync } from 'node:fs';
import { basename, join, resolve, extname } from 'node:path';

// Constants
import {
  SYSTEM_PATH_PATTERNS
} from '@main/constant/file.constants';

export function getAppAssetPath(assetType: 'preload' | 'dist' | 'icon' | 'worker'): string {
  const mapping = {
    preload: 'dist/preload/preload.mjs',
    dist: 'dist/renderer/index.html',
    icon: 'dist/renderer/icon_1024x1024.png',
    worker: 'dist/main/run-pool-job.js'
  };
  return join(app.getAppPath(), mapping[assetType]);
}

export function validatePath(inputPath: string): boolean {
  if (typeof inputPath !== 'string' || !inputPath) {
    return false;
  }

  const sanitizedInput = inputPath.replace(/\0/g, '');

  const projectRoot = resolve(process.cwd());
  const absoluteTarget = resolve(projectRoot, sanitizedInput);

  const isSystemPath = SYSTEM_PATH_PATTERNS.some(pattern => pattern.test(absoluteTarget.toLowerCase()));
  if (isSystemPath) {
    return false;
  }

  return true;
}

export const ensureIsFilePath = (inputPath: string | undefined, defaultFileName: string): string | undefined => {
  if (!inputPath) return inputPath;

  if (basename(inputPath) === defaultFileName) {
    return inputPath;
  }

  try {
    const stats = statSync(inputPath);
    if (stats.isDirectory()) {
      return join(inputPath, defaultFileName);
    }
  } catch {
    if (inputPath.endsWith('/') || inputPath.endsWith('\\') || !extname(inputPath)) {
      return join(inputPath, defaultFileName);
    }
  }
  return inputPath;
};

export async function resolveOutputDirectory(baseDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(baseDir);
    if (entries.length === 0) return baseDir;
  } catch {
    return baseDir;
  }

  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Overwrite', 'Create New Folder', 'Cancel'],
    defaultId: 1,
    cancelId: 2,
    title: 'Output Directory Exists',
    message: `The output directory already contains files:\n${baseDir}`,
    detail: 'Choose "Overwrite" to use it as-is, or "Create New Folder" to auto-create a numbered folder.',
  });

  if (response === 2) return null;
  if (response === 0) return baseDir;

  let counter = 1;
  let candidate = `${baseDir} (${counter})`;
  while (true) {
    try {
      await fs.stat(candidate);
      counter++;
      candidate = `${baseDir} (${counter})`;
    } catch {
      return candidate;
    }
  }
}

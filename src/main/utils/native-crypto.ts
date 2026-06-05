import { createRequire } from 'node:module';
import { getMainWindow } from '../window-manager';

const require = createRequire(import.meta.url);

interface NativePromptNodeModule {
  promptPassword: (hwndBuffer?: Buffer | null) => Promise<Buffer>;
  tpmEncrypt: (data: Buffer) => Promise<Buffer>;
  tpmDecrypt: (data: Buffer) => Promise<Buffer>;
  isTpmAvailable: () => boolean;
  isSoftwareKspAvailable: () => boolean;
}

let nativePrompt: NativePromptNodeModule | null = null;

function getNativePrompt(): NativePromptNodeModule | null {
  if (nativePrompt === null) {
    try {
      nativePrompt = require('../native/native_prompt.node') as NativePromptNodeModule;
    } catch (error) {
      console.error("Failed to load native module native_prompt.node:", error);
      nativePrompt = null;
    }
  }
  return nativePrompt;
}

export async function askPassword(): Promise<Buffer | null> {
  getMainWindow()?.setIgnoreMouseEvents(true, { forward: false });
  const prompt = getNativePrompt();
  if (!prompt) {
    throw new Error("Native module not available for prompting password.");
  }
  try {
    const mainWindow = getMainWindow();
    const nativeHandle = mainWindow ? mainWindow.getNativeWindowHandle() : null;
    const buffer = await prompt.promptPassword(nativeHandle);
    
    return !buffer.length ? null : buffer;
  } catch (error) {
    console.log(error);
    if (error instanceof Error && error.message === 'USER_CANCELLED') {
      return null;
    }
    throw error;
  } finally {
    getMainWindow()?.setIgnoreMouseEvents(false);
  }
}

export async function tpmEncrypt(data: Buffer): Promise<Buffer> {
  const prompt = getNativePrompt();
  if (!prompt) {
    throw new Error("Native module not available for TPM encryption.");
  }
  return prompt.tpmEncrypt(data);
}

export async function tpmDecrypt(data: Buffer): Promise<Buffer> {
  const prompt = getNativePrompt();
  if (!prompt) {
    throw new Error("Native module not available for TPM decryption.");
  }
  return prompt.tpmDecrypt(data);
}

export function isTpmAvailable(): boolean {
  const prompt = getNativePrompt();
  if (!prompt) return false;
  try {
    return prompt.isTpmAvailable();
  } catch (err) {
    console.error("TPM check error:", err);
    return false;
  }
}

export function isSoftwareKspAvailable(): boolean {
  const prompt = getNativePrompt();
  if (!prompt) return false;
  try {
    return prompt.isSoftwareKspAvailable();
  } catch (err) {
    console.error("Software KSP check error:", err);
    return false;
  }
}

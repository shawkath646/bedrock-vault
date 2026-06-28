import { createRequire } from 'node:module';
import type WindowManager from '../window-manager';

const require = createRequire(import.meta.url);

interface NativePromptNodeModule {
  promptPassword: (hwndBuffer?: Buffer | null) => Promise<Buffer>;
  tpmEncrypt: (data: Buffer) => Promise<Buffer>;
  tpmDecrypt: (data: Buffer) => Promise<Buffer>;
  isTpmAvailable: () => boolean;
  isSoftwareKspAvailable: () => boolean;
  authenticateOsUser: () => Promise<boolean>;
}

export class NativeCryptoService {
  private nativePrompt: NativePromptNodeModule | null = null;
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  private getNativePrompt(): NativePromptNodeModule | null {
    if (this.nativePrompt === null) {
      try {
        this.nativePrompt = require('../native/native_prompt.node') as NativePromptNodeModule;
      } catch (error) {
        console.error("Failed to load native module native_prompt.node:", error);
        this.nativePrompt = null;
      }
    }
    return this.nativePrompt;
  }

  public async askPassword(): Promise<Buffer | null> {
    const mainWindow = this.windowManager.getMainWindow();
    mainWindow?.setIgnoreMouseEvents(true, { forward: false });
    const prompt = this.getNativePrompt();
    if (!prompt) {
      throw new Error("Native module not available for prompting password.");
    }
    try {
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
      this.windowManager.getMainWindow()?.setIgnoreMouseEvents(false);
    }
  }

  public async tpmEncrypt(data: Buffer): Promise<Buffer> {
    const prompt = this.getNativePrompt();
    if (!prompt) {
      throw new Error("Native module not available for TPM encryption.");
    }
    return prompt.tpmEncrypt(data);
  }

  public async tpmDecrypt(data: Buffer): Promise<Buffer> {
    const prompt = this.getNativePrompt();
    if (!prompt) {
      throw new Error("Native module not available for TPM decryption.");
    }
    return prompt.tpmDecrypt(data);
  }

  public isTpmAvailable(): boolean {
    const prompt = this.getNativePrompt();
    if (!prompt) return false;
    try {
      return prompt.isTpmAvailable();
    } catch (err) {
      console.error("TPM check error:", err);
      return false;
    }
  }

  public isSoftwareKspAvailable(): boolean {
    const prompt = this.getNativePrompt();
    if (!prompt) return false;
    try {
      return prompt.isSoftwareKspAvailable();
    } catch (err) {
      console.error("Software KSP check error:", err);
      return false;
    }
  }

  public async authenticateOsUser(): Promise<boolean> {
    const prompt = this.getNativePrompt();
    if (!prompt) return false;
    try {
      return await prompt.authenticateOsUser();
    } catch (err) {
      console.error("OS Authentication error:", err);
      return false;
    }
  }
}

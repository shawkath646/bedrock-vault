import type { NativeCryptoService } from '@main/utils/native-crypto';

export class EncryptionSessionService {
  private abortController: AbortController | null = null;
  private inProgress = false;
  private cachedPassword: Buffer | null = null;
  private nativeCrypto: NativeCryptoService;

  constructor(nativeCrypto: NativeCryptoService) {
    this.nativeCrypto = nativeCrypto;
  }

  public setInProgress(val: boolean): void {
    this.inProgress = val;
  }

  public isInProgress(): boolean {
    return this.inProgress;
  }

  public setAbortController(ac: AbortController | null): void {
    this.abortController = ac;
  }

  public getAbortController(): AbortController | null {
    return this.abortController;
  }

  public abortEncryption(): void {
    if (this.inProgress) this.abortController?.abort('USER_ABORTED');
  }

  public cleanup(): void {
    this.clearCachedPassword();
    this.abortEncryption();
    this.setInProgress(false);
  }

  public async setEncryptionPassword(): Promise<boolean> {
    const buffer = await this.nativeCrypto.askPassword();
    if (!buffer) return false;

    if (this.cachedPassword) {
      this.cachedPassword.fill(0);
    }

    this.cachedPassword = buffer;
    return true;
  }

  public hasEncryptionPassword(): boolean {
    return this.cachedPassword !== null;
  }

  public getCachedPassword(): Buffer | null {
    return this.cachedPassword;
  }

  public clearCachedPassword(): void {
    if (this.cachedPassword) {
      this.cachedPassword.fill(0);
      this.cachedPassword = null;
    }
  }
}

import type { EncryptionProgress, EncryptionStage } from '@shared/types/file-encryption';
import { THROTTLE_INTERVAL_MS } from '@main/constant/file.constants';
import type WindowManager from '@main/window-manager';

export class EncryptionEmitterService {
  private windowManager: WindowManager;
  private throttleTimeout: NodeJS.Timeout | null = null;
  private lastEmitTime = 0;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  public emitStage(message: string, progress: number, type?: EncryptionStage['type']): void {
    this.windowManager.getMainWindow()?.webContents.send('encryption-stage-update', { message, progress, type: type ?? 'CONTINUE' });
  }

  public emitFileProgress(progressMap: Map<string, EncryptionProgress>, immediate = false): void {
    const now = Date.now();
    
    const performEmit = () => {
      const encrypting: EncryptionProgress[] = [];
      const pending: EncryptionProgress[] = [];
      const done: EncryptionProgress[] = [];
      for (const f of progressMap.values()) {
        if (f.status === 'encrypting') {
          encrypting.push(f);
        } else if (f.status === 'pending') {
          pending.push(f);
        } else {
          done.push(f);
        }
      }
      this.windowManager.getMainWindow()?.webContents.send('encryption-file-progress', [...encrypting, ...pending, ...done]);
      this.lastEmitTime = Date.now();
      if (this.throttleTimeout) {
        clearTimeout(this.throttleTimeout);
        this.throttleTimeout = null;
      }
    };

    if (immediate) {
      performEmit();
      return;
    }

    if (now - this.lastEmitTime >= THROTTLE_INTERVAL_MS) {
      performEmit();
    } else {
      if (!this.throttleTimeout) {
        this.throttleTimeout = setTimeout(performEmit, THROTTLE_INTERVAL_MS - (now - this.lastEmitTime));
      }
    }
  }

  public clearFileProgressThrottle(): void {
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    this.lastEmitTime = 0;
  }
}

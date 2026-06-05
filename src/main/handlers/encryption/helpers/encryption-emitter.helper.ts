import { EventEmitter } from 'node:events';
import type { EncryptionProgress, EncryptionStage } from '@shared/types/fileEncryption';

// Constants
import { THROTTLE_INTERVAL_MS } from '@main/constant/file.constants';

interface EncryptionEventMap {
  'stage': [EncryptionStage];
  'file-progress': [EncryptionProgress[]];
}

export const encryptionEmitter = new EventEmitter<EncryptionEventMap>();

export function emitStage(message: string, progress: number, type?: EncryptionStage['type']): void {
  encryptionEmitter.emit('stage', { message, progress, type: type ?? 'CONTINUE' });
}

let throttleTimeout: NodeJS.Timeout | null = null;
let lastEmitTime = 0;

export function emitFileProgress(progressMap: Map<string, EncryptionProgress>, immediate = false): void {
  const now = Date.now();
  
  const performEmit = () => {
    const all = [...progressMap.values()];
    const encrypting = all.filter(f => f.status === 'encrypting');
    const pending    = all.filter(f => f.status === 'pending');
    const done       = all.filter(f => f.status === 'completed' || f.status === 'failed');
    encryptionEmitter.emit('file-progress', [...encrypting, ...pending, ...done]);
    lastEmitTime = Date.now();
    if (throttleTimeout) {
      clearTimeout(throttleTimeout);
      throttleTimeout = null;
    }
  };

  if (immediate) {
    performEmit();
    return;
  }

  if (now - lastEmitTime >= THROTTLE_INTERVAL_MS) {
    performEmit();
  } else {
    if (!throttleTimeout) {
      throttleTimeout = setTimeout(performEmit, THROTTLE_INTERVAL_MS - (now - lastEmitTime));
    }
  }
}

export function clearFileProgressThrottle(): void {
  if (throttleTimeout) {
    clearTimeout(throttleTimeout);
    throttleTimeout = null;
  }
  lastEmitTime = 0;
}

import { EventEmitter } from 'node:events';
import type { EncryptionProgress, EncryptionStage } from '@shared/types/fileEncryption';

interface EncryptionEventMap {
    'stage': [EncryptionStage];
    'file-progress': [EncryptionProgress[]];
}

export const encryptionEmitter = new EventEmitter<EncryptionEventMap>();

export function emitStage(message: string, progress: number, type?: EncryptionStage['type']) {
    encryptionEmitter.emit('stage', { message, progress, type: type ?? 'CONTINUE' });
}

export function emitFileProgress(progressMap: Map<string, EncryptionProgress>): void {
    const all = [...progressMap.values()];
    const encrypting = all.filter(f => f.status === 'encrypting');
    const pending    = all.filter(f => f.status === 'pending');
    const done       = all.filter(f => f.status === 'completed' || f.status === 'failed');
    encryptionEmitter.emit('file-progress', [...encrypting, ...pending, ...done]);
}

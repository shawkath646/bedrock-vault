/**
 * popup.emitter.ts
 *
 * Utility for the main process to push popup notifications to the renderer.
 * Usage from any main-process handler:
 *
 *   import { showPopup } from '@main/handlers/miscellaneous/popup.emitter';
 *   showPopup('error', 'Disk full!', true);
 */

import { EventEmitter } from 'node:events';
import type { PopupPayload, PopupType } from '@shared/types/global';

export type { PopupPayload, PopupType };

interface PopupEventMap {
    'show': [PopupPayload];
}

export const popupEmitter = new EventEmitter<PopupEventMap>();

/**
 * Push a popup notification to the renderer window.
 * @param type     - visual variant: 'info' | 'warning' | 'error' | 'success'
 * @param message  - text to display
 * @param closable - true = user must dismiss; false = auto-closes after 4 s
 */
export function showPopup(type: PopupType, message: string, closable = false): void {
    popupEmitter.emit('show', { type, message, closable });
}

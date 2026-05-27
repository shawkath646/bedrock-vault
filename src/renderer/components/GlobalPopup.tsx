/**
 * GlobalPopup.tsx
 *
 * Application-wide popup notification system. Listens to the main process
 * via `window.appWindow.onPopupShow` and renders a stack of dismissible
 * notifications in the top-right corner.
 *
 * Usage from main process:
 *   import { showPopup } from '@main/ipc/popup.emitter';
 *   showPopup('error', 'Disk full!', true);
 */

import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import type { PopupPayload, PopupType } from '@shared/types/popup';
import { cn } from '@renderer/lib/utils';

// ─── Icons (inline SVG to avoid a dependency) ────────────────────────────────

const icons: Record<PopupType, ReactElement> = {
    info: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
    ),
    success: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
    ),
    warning: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
    ),
    error: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
    ),
};

const colorMap: Record<PopupType, string> = {
    info:    'border-blue-500/30 bg-blue-500/10 text-blue-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    error:   'border-red-500/30 bg-red-500/10 text-red-200',
};

const iconColorMap: Record<PopupType, string> = {
    info:    'text-blue-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error:   'text-red-400',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PopupItem extends PopupPayload {
    id: string;
    /** Whether we're in the leave animation */
    leaving: boolean;
}

const AUTO_CLOSE_MS = 4_000;
const LEAVE_ANIMATION_MS = 300;

// ─── Single popup card ────────────────────────────────────────────────────────

function PopupCard({
    item,
    onDismiss,
}: {
    item: PopupItem;
    onDismiss: (id: string) => void;
}) {
    return (
        <div
            role="alert"
            aria-live="assertive"
            className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm',
                'transition-all duration-300',
                item.leaving
                    ? 'translate-x-10 opacity-0'
                    : 'translate-x-0 opacity-100',
                colorMap[item.type],
            )}
            style={{ minWidth: 260, maxWidth: 380 }}
        >
            <span className={cn('mt-0.5', iconColorMap[item.type])}>
                {icons[item.type]}
            </span>

            <p className="flex-1 text-sm leading-relaxed">{item.message}</p>

            {item.closable && (
                <button
                    id={`popup-close-${item.id}`}
                    aria-label="Dismiss notification"
                    onClick={() => onDismiss(item.id)}
                    className="ml-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                        <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                    </svg>
                </button>
            )}
        </div>
    );
}

// ─── Global popup container ───────────────────────────────────────────────────

export default function GlobalPopup() {
    const [items, setItems] = useState<PopupItem[]>([]);
    const idCounter = useRef(0);

    // Provide a stable unique-id base
    const uid = useId();

    const dismiss = (id: string) => {
        // Start leave animation
        setItems(prev => prev.map(p => p.id === id ? { ...p, leaving: true } : p));
        // Remove after animation
        setTimeout(() => {
            setItems(prev => prev.filter(p => p.id !== id));
        }, LEAVE_ANIMATION_MS);
    };

    useEffect(() => {
        const cleanup = window.appWindow.onPopupShow((payload) => {
            const id = `${uid}-${++idCounter.current}`;
            const item: PopupItem = { ...payload, id, leaving: false };

            setItems(prev => [...prev, item]);

            if (!payload.closable) {
                setTimeout(() => dismiss(id), AUTO_CLOSE_MS);
            }
        });

        return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (items.length === 0) return null;

    return (
        <div
            id="global-popup-container"
            aria-label="Notifications"
            className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        >
            {items.map(item => (
                <div key={item.id} className="pointer-events-auto">
                    <PopupCard item={item} onDismiss={dismiss} />
                </div>
            ))}
        </div>
    );
}

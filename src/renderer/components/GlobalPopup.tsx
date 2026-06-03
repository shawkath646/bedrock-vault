/**
 * GlobalPopup.tsx
 *
 * Application-wide popup notification system. Listens to the main process
 * via `window.appWindow.onPopupShow` and renders centered dismissible/blocking
 * modal dialogs.
 *
 * Usage from main process:
 *   import { showPopup } from '@main/handlers/miscellaneous/popup.emitter';
 *   showPopup('error', 'Disk full!', true);
 */

import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import type { PopupPayload, PopupType } from '@shared/types/global';
import { cn } from '@renderer/lib/utils';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';

const icons: Record<PopupType, ReactElement> = {
    info: <Info className="h-6 w-6 text-blue-500" />,
    success: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    error: <XCircle className="h-6 w-6 text-red-500" />,
};

const badgeColors: Record<PopupType, string> = {
    info: 'bg-blue-500/10 text-blue-500',
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    error: 'bg-red-500/10 text-red-500',
};

const borderColors: Record<PopupType, string> = {
    info: 'border-blue-500/20',
    success: 'border-emerald-500/20',
    warning: 'border-amber-500/20',
    error: 'border-red-500/20',
};

const titles: Record<PopupType, string> = {
    info: 'Information',
    success: 'Success',
    warning: 'Warning',
    error: 'Error Occurred',
};

interface PopupItem extends PopupPayload {
    id: string;
    leaving: boolean;
}

const LEAVE_ANIMATION_MS = 300;

function PopupModal({
    item,
    onDismiss,
}: {
    item: PopupItem;
    onDismiss: (id: string) => void;
}) {
    return (
        <div
            className={cn(
                'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all duration-300',
                item.leaving ? 'opacity-0' : 'opacity-100'
            )}
            onClick={() => {
                if (item.closable) {
                    onDismiss(item.id);
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                className={cn(
                    'relative w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl transition-all duration-300 flex flex-col items-center text-center space-y-4',
                    item.leaving ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
                    borderColors[item.type]
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {item.closable && (
                    <button
                        id={`popup-close-${item.id}`}
                        aria-label="Dismiss notification"
                        onClick={() => onDismiss(item.id)}
                        className="absolute top-4 right-4 text-muted-foreground opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}

                <div className={cn('p-3 rounded-full', badgeColors[item.type])}>
                    {icons[item.type]}
                </div>

                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground leading-none">
                        {titles[item.type]}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed pt-2">
                        {item.message}
                    </p>
                </div>

                {item.closable && (
                    <Button
                        onClick={() => onDismiss(item.id)}
                        className="w-full mt-4 cursor-pointer"
                    >
                        Dismiss
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function GlobalPopup() {
    const [items, setItems] = useState<PopupItem[]>([]);
    const idCounter = useRef(0);
    const uid = useId();

    const dismiss = (id: string) => {
        setItems(prev => prev.map(p => p.id === id ? { ...p, leaving: true } : p));
        setTimeout(() => {
            setItems(prev => prev.filter(p => p.id !== id));
        }, LEAVE_ANIMATION_MS);
    };

    useEffect(() => {
        const cleanup = window.appWindow.onPopupShow((payload) => {
            const id = `${uid}-${++idCounter.current}`;
            const item: PopupItem = { ...payload, id, leaving: false };

            setItems(prev => [...prev, item]);
        });

        return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (items.length === 0) return null;

    const activeItem = items[items.length - 1];

    return (
        <PopupModal item={activeItem} onDismiss={dismiss} />
    );
}

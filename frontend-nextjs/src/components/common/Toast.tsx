'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Icon from './Icon';

interface ToastItem {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
    toasts: ToastItem[];
    onRemove: (id: string) => void;
}

// Toast display component
function ToastContainer({ toasts, onRemove }: ToastProps) {
    const getIcon = (type: ToastItem['type']) => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            default: return 'info';
        }
    };

    const getColors = (type: ToastItem['type']) => {
        switch (type) {
            case 'success': return 'bg-green-500/90 border-green-400';
            case 'error': return 'bg-red-500/90 border-red-400';
            case 'warning': return 'bg-amber-500/90 border-amber-400';
            default: return 'bg-primary/90 border-primary';
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`${getColors(toast.type)} px-4 py-3 rounded-xl border shadow-lg text-white flex items-center gap-3 animate-in slide-in-from-right duration-300`}
                >
                    <Icon name={getIcon(toast.type)} className="text-xl shrink-0" />
                    <span className="flex-1 text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => onRemove(toast.id)}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <Icon name="close" className="text-sm" />
                    </button>
                </div>
            ))}
        </div>
    );
}

// Hook to manage toasts locally
export function useToastState() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, showToast, removeToast };
}

export { ToastContainer };
export type { ToastItem };

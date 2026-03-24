'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
    footer?: React.ReactNode;
    compact?: boolean;
    bodyClassName?: string;
    headerClassName?: string;
    footerClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    footer,
    compact = false,
    bodyClassName = '',
    headerClassName = '',
    footerClassName = '',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    // Ensure we're on client-side before using createPortal
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        '2xl': 'max-w-6xl',
        '3xl': 'max-w-7xl',
        '4xl': 'max-w-[90vw]',
        '5xl': 'max-w-[95vw]',
        full: 'max-w-full m-2',
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                ref={modalRef}
                className={`relative w-full ${sizeClasses[size]} max-h-[96vh] flex flex-col bg-surface-dark rounded-2xl border border-border-color shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200 overflow-hidden`}
            >
                {/* Header */}
                <div className={`flex items-center justify-between px-6 border-b border-border-color shrink-0 ${compact ? 'py-2' : 'py-4'} ${headerClassName}`}>
                    <h2 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-text-base line-clamp-1`}>{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-surface-highlight transition-colors text-text-secondary hover:text-text-base inline-flex items-center justify-center cursor-pointer"
                    >
                        <Icon name="close" className="text-xl" />
                    </button>
                </div>

                {/* Body */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar ${compact ? 'p-2' : 'p-6'} ${bodyClassName}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className={`px-6 py-4 border-t border-border-color flex items-center justify-end gap-3 shrink-0 ${footerClassName}`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    // Use Portal to render modal directly to document.body
    // This ensures modal appears above all elements including sidebar
    return createPortal(modalContent, document.body);
};

export default Modal;

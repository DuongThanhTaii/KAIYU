'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '../common/Icon';

/**
 * LandingNavbar - A navbar component for public/landing pages that doesn't require AuthContext.
 * Use this for pages that are rendered statically and don't need user authentication.
 */
const LandingNavbar: React.FC = () => {
    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4">
            <nav className="bg-white/4 dark:bg-surface-dark/80 backdrop-blur-md border border-white/10 dark:border-border-color rounded-full px-6 py-3 flex items-center justify-between w-full max-w-[960px] shadow-lg">
                <Link href="/" className="flex items-center gap-2">
                    <div className="size-8 bg-primary rounded-full flex items-center justify-center text-background-dark">
                        <Icon name="translate" size="md" />
                    </div>
                    <span className="font-bold text-lg tracking-tight hidden sm:block">KAIYU</span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <a href="/#features" className="text-sm font-medium hover:text-primary transition-colors">Tính năng</a>
                    <a href="/#pricing" className="text-sm font-medium hover:text-primary transition-colors">Bảng giá</a>
                    <a href="/#faq" className="text-sm font-medium hover:text-primary transition-colors">FAQ</a>
                </div>

                <Link
                    href="/login"
                    className="bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
                >
                    Bắt đầu học
                </Link>
            </nav>
        </div>
    );
};

export default LandingNavbar;

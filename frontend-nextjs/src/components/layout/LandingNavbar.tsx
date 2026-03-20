'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import Icon from '@/components/common/Icon';

/**
 * LandingNavbar - A navbar component for public/landing pages that doesn't require AuthContext.
 * Use this for pages that are rendered statically and don't need user authentication.
 */
const LandingNavbar: React.FC = () => {
    const { themeMode, setThemeMode } = useTheme();

    const toggleTheme = () => {
        setThemeMode(themeMode === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4">
            <nav className="bg-surface-dark/80 backdrop-blur-md border border-border-color rounded-full px-6 py-3 flex items-center justify-between w-full max-w-[960px] shadow-lg transition-colors duration-300">
                <Link href="/" className="flex items-center gap-3">
                    <div className="size-9 flex items-center justify-center shrink-0">
                        <Image src="/images/logo_nentrang.png" alt="KAIYU Logo" width={36} height={36} className="object-contain rounded-full" />
                    </div>
                    <div className="hidden sm:flex flex-col leading-none">
                        <span className="font-extrabold text-lg tracking-widest text-text-base uppercase">
                            KAIYU
                        </span>
                        <span className="text-[8px] font-semibold tracking-[0.18em] text-text-secondary uppercase">
                            CHINESE LANGUAGE SYSTEM
                        </span>
                    </div>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <a href="/#features" className="text-sm font-medium text-text-base hover:text-primary transition-colors">Tính năng</a>
                    <a href="/#faq" className="text-sm font-medium text-text-base hover:text-primary transition-colors">FAQ</a>
                </div>

                <div className="flex items-center gap-4">
                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-surface-highlight text-text-base transition-colors flex items-center justify-center"
                        title={themeMode === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
                    >
                        <Icon name={themeMode === 'light' ? 'dark_mode' : 'light_mode'} size="md" />
                    </button>

                    <Link
                        href="/login"
                        className="bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold px-5 py-2.5 rounded-full transition-colors flex items-center"
                    >
                        Bắt đầu học
                    </Link>
                </div>
            </nav>
        </div>
    );
};

export default LandingNavbar;

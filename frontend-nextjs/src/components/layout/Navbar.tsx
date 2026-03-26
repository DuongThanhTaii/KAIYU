'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '../common/Icon';
import StreakBadge from '../common/StreakBadge';
import NotificationDropdown from '../common/NotificationDropdown';
import { useAuth } from '../../contexts/AuthContext';
import { addNotification, hasRecentNotification } from '../../services/notificationService';
import { flashcardApi } from '../../services/flashcardApi';

interface NavbarProps {
    variant?: 'landing' | 'app';
    onMobileMenuClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ variant = 'landing', onMobileMenuClick }) => {
    const router = useRouter();
    const { user } = useAuth();

    // Auto-trigger notifications
    useEffect(() => {
        if (variant !== 'app' || !user) return;

        const checkAndAddNotifications = async () => {
            // Welcome notification for new users (first visit)
            const firstVisitKey = 'KAIYU_first_visit';
            if (!localStorage.getItem(firstVisitKey)) {
                localStorage.setItem(firstVisitKey, 'true');
                addNotification(
                    'welcome',
                    'Chào mừng đến KAIYU! 👋',
                    'Hãy bắt đầu học tiếng Trung ngay hôm nay. Chúc bạn học tốt!',
                    '/learn'
                );
            }

            // Flashcard review reminder (check if any due)
            if (!hasRecentNotification('review', 3600000)) { // 1 hour
                try {
                    const stats = await flashcardApi.getStats();
                    if (stats && stats.dueToday > 0) {
                        addNotification(
                            'review',
                            'Đến giờ ôn tập! 📚',
                            `Bạn có ${stats.dueToday} từ cần ôn tập hôm nay.`,
                            '/review'
                        );
                    }
                } catch {
                    // Ignore errors
                }
            }

            // Daily goal reminder (if user hasn't met goal today)
            const today = new Date().toDateString();
            const lastGoalReminder = localStorage.getItem('KAIYU_goal_reminder_date');
            if (lastGoalReminder !== today && !hasRecentNotification('daily_goal', 86400000)) {
                localStorage.setItem('KAIYU_goal_reminder_date', today);
                addNotification(
                    'daily_goal',
                    'Mục tiêu hôm nay 🎯',
                    `Hãy hoàn thành ${user.dailyGoalMinutes} phút học tập để duy trì streak!`,
                    '/dashboard'
                );
            }
        };

        checkAndAddNotifications();
    }, [variant, user]);

    if (variant === 'landing') {
        return (
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4">
                <nav className="bg-white/4 dark:bg-surface-dark/80 backdrop-blur-md border border-white/10 dark:border-border-color rounded-full px-6 py-3 flex items-center justify-between w-full max-w-[960px] shadow-lg">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="size-9 flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-white">
                            <Image src="/images/logo_nentrang.png" alt="KAIYU Logo" width={36} height={36} className="object-contain" />
                        </div>
                        <div className="hidden sm:flex flex-col leading-none">
                            <span className="font-extrabold text-lg tracking-widest text-text-base uppercase">KAIYU</span>
                            <span className="text-[8px] font-semibold tracking-[0.18em] text-text-secondary uppercase">CHINESE LANGUAGE SYSTEM</span>
                        </div>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Tính năng</a>
                        <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Bảng giá</a>
                        <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors">FAQ</a>
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
    }

    // Get user display name
    const displayName = user?.name || user?.email?.split('@')[0] || 'User';
    const initials = displayName.charAt(0).toUpperCase();

    // App variant navbar
    return (
        <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border-color bg-[var(--color-background-dark)]/90 backdrop-blur-md sticky top-0 z-20">
            {/* Mobile: Hamburger + Title */}
            <div className="flex items-center gap-3 lg:hidden">
                <button
                    onClick={onMobileMenuClick}
                    className="p-2 rounded-xl hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
                    aria-label="Mở menu"
                >
                    <Icon name="menu" size="md" className="text-text-base" />
                </button>
                {/* Mobile logo shown in app header */}
                <div className="size-8 flex items-center justify-center rounded-full overflow-hidden bg-white">
                    <Image src="/images/logo_nentrang.png" alt="KAIYU" width={32} height={32} className="object-contain" />
                </div>
            </div>

            <div className="hidden lg:flex flex-1 max-w-md">
                <div className="relative w-full group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon name="search" className="text-text-secondary group-focus-within:text-text-base transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 border-none rounded-full leading-5 bg-surface-dark text-text-base placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm transition-all"
                        placeholder="Tìm bài học, từ vựng..."
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
                {/* Streak Display */}
                <StreakBadge count={user?.streak || 0} size="lg" className="hidden md:inline-flex" />

                {/* XP Display */}
                <div className="hidden md:flex items-center gap-2 bg-cyan-500/10 px-4 py-2 rounded-full border border-cyan-500/20 shadow-sm transition-all hover:scale-105">
                    <Icon name="sailing" className="text-cyan-600 dark:text-cyan-400" size="md" />
                    <span className="text-sm font-black text-text-base">{user?.xp || 0}</span>
                </div>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User Avatar - Clickable */}
                <button
                    onClick={() => router.push('/profile')}
                    className="flex items-center gap-3 pl-2 border-l border-border-color cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-text-base leading-tight">{displayName}</p>
                        <p className="text-xs text-text-secondary">HSK {user?.hskLevel || 1}</p>
                    </div>
                    {user?.avatarUrl ? (
                        <img
                            src={user.avatarUrl}
                            alt={displayName}
                            className="rounded-full size-10 ring-2 ring-border-color object-cover"
                        />
                    ) : (
                        <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-full size-10 ring-2 ring-border-color flex items-center justify-center text-on-primary font-bold">
                            {initials}
                        </div>
                    )}
                </button>
            </div>
        </header>
    );
};

export default Navbar;

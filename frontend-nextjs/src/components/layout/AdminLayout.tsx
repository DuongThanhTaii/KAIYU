'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AdminSidebar from './AdminSidebar';
import Icon from '../common/Icon';
import { getNotifications, type AdminNotification } from '../../services/adminApi';

interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
    actions?: React.ReactNode;
}

// Local storage key for dismissed notifications
const DISMISSED_NOTIFS_KEY = 'KAIYU_admin_dismissed_notifs';

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, actions }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load dismissed IDs from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DISMISSED_NOTIFS_KEY);
            if (saved) {
                setDismissedIds(JSON.parse(saved));
            }
        } catch {
            // Ignore
        }
    }, []);

    // Load notifications when dropdown opens
    useEffect(() => {
        if (showNotifications) {
            fetchNotifications();
        }
    }, [showNotifications]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
                setShowClearConfirm(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications(15);
            setNotifications(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter out dismissed notifications
    const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

    // Dismiss a single notification
    const handleDismiss = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newDismissed = [...dismissedIds, id];
        setDismissedIds(newDismissed);
        localStorage.setItem(DISMISSED_NOTIFS_KEY, JSON.stringify(newDismissed));
    };

    // Clear all notifications
    const handleClearAll = () => {
        const allIds = notifications.map(n => n.id);
        setDismissedIds(allIds);
        localStorage.setItem(DISMISSED_NOTIFS_KEY, JSON.stringify(allIds));
        setShowClearConfirm(false);
    };

    // Get icon and color based on notification type
    const getNotificationStyle = (type: string) => {
        switch (type) {
            case 'user':
                return { icon: 'person_add', color: 'text-green-400', bg: 'bg-green-500/20' };
            case 'video':
                return { icon: 'videocam', color: 'text-blue-400', bg: 'bg-blue-500/20' };
            case 'achievement':
                return { icon: 'emoji_events', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
            case 'vocabulary':
                return { icon: 'translate', color: 'text-purple-400', bg: 'bg-purple-500/20' };
            default:
                return { icon: 'notifications', color: 'text-amber-400', bg: 'bg-amber-500/20' };
        }
    };

    // Get title based on notification type
    const getNotificationTitle = (type: string) => {
        switch (type) {
            case 'user': return 'Người dùng mới';
            case 'video': return 'Video mới';
            case 'achievement': return 'Thành tựu đạt được';
            case 'vocabulary': return 'Từ vựng mới';
            default: return 'Thông báo';
        }
    };

    return (
        <div className="flex h-screen w-full bg-background-dark">
            {/* Sidebar with state */}
            <AdminSidebar
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
            />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Admin Header - z-index below mobile sidebar overlay */}
                <header className="h-16 border-b border-border-color bg-surface-dark/50 backdrop-blur-md flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        {/* Mobile Hamburger */}
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="lg:hidden p-2 rounded-xl hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
                            aria-label="Mở menu"
                        >
                            <Icon name="menu" size="md" className="text-white" />
                        </button>

                        {title && (
                            <h1 className="text-lg md:text-xl font-bold text-white">{title}</h1>
                        )}
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        {actions}

                        {/* Notifications Button */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 text-text-secondary hover:text-white transition-colors rounded-full hover:bg-surface-highlight inline-flex items-center justify-center cursor-pointer"
                            >
                                <Icon name="notifications" />
                                {visibleNotifications.length > 0 && (
                                    <span className="absolute top-0.5 right-0.5 size-5 bg-red-500 rounded-full border-2 border-surface-dark flex items-center justify-center text-[10px] font-bold text-white">
                                        {visibleNotifications.length > 9 ? '9+' : visibleNotifications.length}
                                    </span>
                                )}
                            </button>

                            {/* Notifications Dropdown - Very high z-index */}
                            {showNotifications && (
                                <div className="fixed top-16 right-4 md:absolute md:top-auto md:right-0 md:mt-2 w-[calc(100vw-2rem)] md:w-96 bg-surface-dark rounded-2xl border border-border-color shadow-2xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-color bg-background-dark/50">
                                        <div className="flex items-center gap-2">
                                            <Icon name="notifications" className="text-amber-400" size="sm" />
                                            <h3 className="font-bold text-white">Thông báo</h3>
                                            {visibleNotifications.length > 0 && (
                                                <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full">
                                                    {visibleNotifications.length}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={fetchNotifications}
                                                className="p-1.5 rounded-lg hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
                                                title="Tải lại"
                                            >
                                                <Icon name="refresh" size="sm" className="text-amber-400" />
                                            </button>
                                            {visibleNotifications.length > 0 && (
                                                <button
                                                    onClick={() => setShowClearConfirm(true)}
                                                    className="p-1.5 rounded-lg hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
                                                    title="Xóa tất cả"
                                                >
                                                    <Icon name="delete_sweep" size="sm" className="text-red-400" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Clear Confirmation */}
                                    {showClearConfirm && (
                                        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
                                            <span className="text-sm text-red-400">Xóa tất cả thông báo?</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowClearConfirm(false)}
                                                    className="px-3 py-1 text-xs font-medium text-text-secondary hover:text-white rounded-lg hover:bg-surface-highlight transition-colors"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    onClick={handleClearAll}
                                                    className="px-3 py-1 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                                                >
                                                    Xóa hết
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Notifications List */}
                                    <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
                                        {loading ? (
                                            <div className="py-12 text-center">
                                                <div className="animate-spin inline-block size-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                                            </div>
                                        ) : visibleNotifications.length === 0 ? (
                                            <div className="py-12 text-center">
                                                <Icon name="notifications_off" className="text-4xl text-text-secondary/30 mb-2" />
                                                <p className="text-sm text-text-secondary">Không có thông báo</p>
                                            </div>
                                        ) : (
                                            visibleNotifications.map(notif => {
                                                const style = getNotificationStyle(notif.type);
                                                return (
                                                    <div
                                                        key={notif.id}
                                                        className="group relative flex items-start gap-3 p-4 hover:bg-surface-highlight transition-colors border-b border-border-color/30 last:border-0"
                                                    >
                                                        <div className={`p-2 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                                                            <Icon name={style.icon} className={style.color} />
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-8">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-sm font-medium text-white">
                                                                    {getNotificationTitle(notif.type)}
                                                                </p>
                                                                <span className="text-[10px] text-text-secondary whitespace-nowrap">
                                                                    {notif.time}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                                                                {notif.message}
                                                            </p>
                                                        </div>

                                                        {/* Delete button */}
                                                        <button
                                                            onClick={(e) => handleDismiss(e, notif.id)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all active:scale-95 inline-flex items-center justify-center cursor-pointer"
                                                            title="Xóa thông báo"
                                                        >
                                                            <Icon name="close" size="sm" className="text-text-secondary hover:text-red-400" />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Settings Link */}
                        <Link
                            href="/settings"
                            className="p-2 rounded-lg hover:bg-surface-highlight transition-colors text-text-secondary hover:text-white inline-flex items-center justify-center cursor-pointer"
                        >
                            <Icon name="settings" />
                        </Link>
                    </div>
                </header>

                {/* Content - Lower z-index */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth relative z-0">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;

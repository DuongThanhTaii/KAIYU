'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../common/Icon';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    formatRelativeTime,
    type Notification,
} from '../../services/notificationService';

const NotificationDropdown: React.FC = () => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load notifications
    const loadNotifications = () => {
        setNotifications(getNotifications());
    };

    useEffect(() => {
        loadNotifications();
        // Refresh every 30 seconds
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowDeleteConfirm(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);
        loadNotifications();
        if (notification.link) {
            router.push(notification.link);
            setIsOpen(false);
        }
    };

    const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Don't trigger notification click
        deleteNotification(id);
        loadNotifications();
    };

    const handleMarkAllRead = () => {
        markAllAsRead();
        loadNotifications();
    };

    const handleClearAll = () => {
        clearAllNotifications();
        loadNotifications();
        setShowDeleteConfirm(false);
    };

    const getIconBg = (color: string) => {
        const colorMap: Record<string, string> = {
            'text-yellow-400': 'bg-yellow-500/20',
            'text-orange-400': 'bg-orange-500/20',
            'text-purple-400': 'bg-purple-500/20',
            'text-primary': 'bg-primary/20',
            'text-blue-400': 'bg-blue-500/20',
            'text-green-400': 'bg-green-500/20',
        };
        return colorMap[color] || 'bg-gray-500/20';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-text-secondary hover:text-text-base transition-colors rounded-full hover:bg-surface-highlight inline-flex items-center justify-center cursor-pointer"
            >
                <Icon name="notifications" />
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 size-5 bg-red-500 rounded-full border-2 border-surface-dark flex items-center justify-center text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown - Fixed position at top right */}
            {isOpen && (
                <div className="fixed top-16 right-4 md:absolute md:top-auto md:right-0 md:mt-2 w-[calc(100vw-2rem)] md:w-96 bg-surface-dark rounded-2xl border border-border-color shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-color bg-surface-highlight/30">
                        <div className="flex items-center gap-2">
                            <Icon name="notifications" className="text-primary" size="sm" />
                            <h3 className="font-black text-text-base">Thông báo</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-black bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                                    {unreadCount} mới
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="p-1.5 rounded-lg hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
                                    title="Đánh dấu tất cả đã đọc"
                                >
                                    <Icon name="done_all" size="sm" className="text-primary" />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="p-1.5 rounded-lg hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
                                    title="Xóa tất cả thông báo"
                                >
                                    <Icon name="delete_sweep" size="sm" className="text-red-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
                            <span className="text-sm text-red-400">Xóa tất cả thông báo?</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-3 py-1 text-xs font-bold text-text-secondary hover:text-text-base rounded-lg hover:bg-surface-highlight transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    className="px-3 py-1 text-xs font-black text-on-primary bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                                >
                                    Xóa hết
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notifications List */}
                    <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Icon name="notifications_off" className="text-4xl text-text-secondary/30 mb-2" />
                                <p className="text-sm text-text-secondary">Không có thông báo</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`group relative flex items-start gap-3 p-4 hover:bg-surface-highlight transition-colors border-b border-border-color/30 cursor-pointer ${!notification.read ? 'bg-primary/5' : ''
                                        }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    {/* Icon */}
                                    <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(notification.iconColor)}`}>
                                        <Icon name={notification.icon} className={notification.iconColor} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-8">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm ${!notification.read ? 'font-black text-text-base' : 'text-text-secondary font-bold'}`}>
                                                {notification.title}
                                            </p>
                                            <span className="text-[10px] text-text-secondary font-bold whitespace-nowrap">
                                                {formatRelativeTime(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-secondary mt-0.5 font-bold line-clamp-2">
                                            {notification.message}
                                        </p>
                                    </div>

                                    {/* Unread indicator */}
                                    {!notification.read && (
                                        <div className="absolute right-12 top-1/2 -translate-y-1/2 size-2 bg-primary rounded-full" />
                                    )}

                                    {/* Delete button - visible on hover (PC) or always on mobile via touch */}
                                    <button
                                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all active:scale-95 inline-flex items-center justify-center cursor-pointer"
                                        title="Xóa thông báo"
                                    >
                                        <Icon name="close" size="sm" className="text-text-secondary hover:text-red-400" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer hint for mobile */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-border-color/30 text-center md:hidden">
                            <p className="text-[10px] text-text-secondary/60">
                                Vuốt sang trái hoặc nhấn × để xóa
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;

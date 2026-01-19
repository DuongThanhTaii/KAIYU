// Notification Service - localStorage-based notification system

const STORAGE_KEY = 'KAIYU_notifications';

export type NotificationType = 'achievement' | 'streak' | 'review' | 'welcome' | 'daily_goal';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    icon: string;
    iconColor: string;
    createdAt: string;
    read: boolean;
    link?: string;
}

/**
 * Get all notifications from localStorage
 */
export const getNotifications = (): Notification[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data) as Notification[];
    } catch {
        return [];
    }
};

/**
 * Save notifications to localStorage
 */
const saveNotifications = (notifications: Notification[]) => {
    try {
        // Keep only last 20 notifications
        const trimmed = notifications.slice(0, 20);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save notifications:', err);
    }
};

/**
 * Add a new notification
 */
export const addNotification = (
    type: NotificationType,
    title: string,
    message: string,
    link?: string
): Notification => {
    const iconMap: Record<NotificationType, { icon: string; color: string }> = {
        achievement: { icon: 'emoji_events', color: 'text-yellow-400' },
        streak: { icon: 'local_fire_department', color: 'text-orange-400' },
        review: { icon: 'style', color: 'text-purple-400' },
        welcome: { icon: 'waving_hand', color: 'text-primary' },
        daily_goal: { icon: 'flag', color: 'text-blue-400' },
    };

    const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        icon: iconMap[type].icon,
        iconColor: iconMap[type].color,
        createdAt: new Date().toISOString(),
        read: false,
        link,
    };

    const notifications = getNotifications();
    notifications.unshift(notification);
    saveNotifications(notifications);

    return notification;
};

/**
 * Mark a notification as read
 */
export const markAsRead = (id: string) => {
    const notifications = getNotifications();
    const updated = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = () => {
    const notifications = getNotifications();
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
};

/**
 * Delete a single notification by ID
 */
export const deleteNotification = (id: string) => {
    const notifications = getNotifications();
    const filtered = notifications.filter(n => n.id !== id);
    saveNotifications(filtered);
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = () => {
    localStorage.removeItem(STORAGE_KEY);
};

/**
 * Get unread count
 */
export const getUnreadCount = (): number => {
    return getNotifications().filter(n => !n.read).length;
};

/**
 * Check if notification already exists (prevent duplicates)
 */
export const hasRecentNotification = (type: NotificationType, within: number = 3600000): boolean => {
    const notifications = getNotifications();
    const cutoff = Date.now() - within;
    return notifications.some(
        n => n.type === type && new Date(n.createdAt).getTime() > cutoff
    );
};

/**
 * Format relative time (e.g., "2 phút trước")
 */
export const formatRelativeTime = (dateString: string): string => {
    const now = Date.now();
    const date = new Date(dateString).getTime();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
};

export default {
    getNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getUnreadCount,
    hasRecentNotification,
    formatRelativeTime,
};

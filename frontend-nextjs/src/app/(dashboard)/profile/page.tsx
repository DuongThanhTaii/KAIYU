'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/common/Icon';
import { userVocabularyApi, type UserVocabularyStats } from '@/services/userVocabularyApi';

// Utility function to scale and compress image
const scaleImage = (file: File, maxSize: number = 200): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Draw scaled image
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with compression (quality 0.8)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

export default function ProfilePage() {
    const router = useRouter();
    const { user, updateProfile, logout, error, clearError } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        avatarUrl: user?.avatarUrl || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [vocabStats, setVocabStats] = useState<UserVocabularyStats | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch vocabulary stats
    const fetchVocabStats = useCallback(async () => {
        try {
            const stats = await userVocabularyApi.getStats();
            setVocabStats(stats);
        } catch (err) {
            console.error('Failed to fetch vocab stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchVocabStats();
    }, [fetchVocabStats]);

    // Update form data when user changes
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                avatarUrl: user.avatarUrl || '',
            });
        }
    }, [user]);

    if (!user) {
        return null;
    }

    const handleAvatarClick = () => {
        if (isEditing && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn file ảnh');
            return;
        }

        // Validate file size (max 5MB before compression)
        if (file.size > 5 * 1024 * 1024) {
            alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB');
            return;
        }

        setIsUploadingAvatar(true);
        try {
            // Scale and compress image to 200x200 max
            const scaledDataUrl = await scaleImage(file, 200);
            setFormData({ ...formData, avatarUrl: scaledDataUrl });
        } catch (err) {
            console.error('Failed to process image:', err);
            alert('Không thể xử lý ảnh. Vui lòng thử lại.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSuccessMessage(null);
        clearError();
        try {
            await updateProfile({
                name: formData.name,
                avatarUrl: formData.avatarUrl || undefined,
            });
            setIsEditing(false);
            setSuccessMessage('Cập nhật hồ sơ thành công!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Failed to update profile:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Get display values
    const displayName = user.name || user.email?.split('@')[0] || 'User';
    const previewAvatar = formData.avatarUrl || user.avatarUrl;

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto p-6">
                <h1 className="text-2xl font-bold text-text-base mb-8 uppercase tracking-wider opacity-80">Hồ sơ cá nhân</h1>

                {/* Success Message */}
                {successMessage && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <p className="text-sm text-green-400">{successMessage}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Profile Card */}
                <div className="bg-surface-dark rounded-3xl border border-border-color p-8 mb-6 shadow-sm relative overflow-hidden transition-colors">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none" />
                    <div className="flex items-start gap-6">
                        {/* Avatar */}
                        <div className="relative">
                            <div
                                className={`size-24 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-4xl font-bold text-on-primary overflow-hidden ${isEditing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                                    }`}
                                onClick={handleAvatarClick}
                            >
                                {isUploadingAvatar ? (
                                    <div className="size-8 border-3 border-on-primary border-t-transparent rounded-full animate-spin" />
                                ) : previewAvatar ? (
                                    <img
                                        src={previewAvatar}
                                        alt={displayName}
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    displayName.charAt(0).toUpperCase()
                                )}
                            </div>
                            {isEditing && (
                                <button
                                    onClick={handleAvatarClick}
                                    className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-on-primary hover:bg-primary-hover transition-colors"
                                >
                                    <Icon name="camera_alt" className="text-sm" />
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">
                                            Họ và tên
                                        </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base focus:outline-none focus:border-primary transition-colors"
                                            />
                                    </div>
                                    <p className="text-xs text-text-secondary">
                                        💡 Nhấp vào ảnh đại diện để tải ảnh mới
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? 'Đang lưu...' : 'Lưu'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setFormData({ name: user.name || '', avatarUrl: user.avatarUrl || '' });
                                            }}
                                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-bold text-text-base">{displayName}</h2>
                                    <p className="text-text-secondary font-medium">{user.email}</p>
                                    <div className="flex items-center gap-4 mt-4">
                                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${user.role === 'admin'
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : 'bg-primary/20 text-primary'
                                            }`}>
                                            {user.role === 'admin' ? 'Admin' : 'User'}
                                        </span>
                                        {user.isPremium && (
                                            <span className="px-3 py-1 text-sm font-bold rounded-full bg-purple-500/20 text-purple-400">
                                                Premium
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="mt-4 flex items-center gap-2 text-primary hover:text-primary-hover transition-colors"
                                    >
                                        <Icon name="edit" className="text-sm" />
                                        Chỉnh sửa hồ sơ
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-emerald-500/5 dark:bg-surface-dark rounded-2xl border border-emerald-500/10 p-5 text-center transition-all hover:scale-105 group">
                        <p className="text-3xl font-black text-emerald-500">HSK {user.hskLevel}</p>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mt-1">Cấp độ</p>
                    </div>
                    <div className="bg-orange-500/5 dark:bg-surface-dark rounded-2xl border border-orange-500/10 p-5 text-center transition-all hover:scale-105 group">
                        <div className="flex items-center justify-center gap-1">
                            <Icon name="local_fire_department" className="text-2xl text-orange-500" />
                            <p className="text-3xl font-black text-text-base">{user.streak}</p>
                        </div>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mt-1">Streak</p>
                    </div>
                    <div className="bg-blue-500/5 dark:bg-surface-dark rounded-2xl border border-blue-500/10 p-5 text-center transition-all hover:scale-105 group">
                        <p className="text-3xl font-black text-text-base">{user.dailyGoalMinutes}</p>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mt-1">Phút/ngày</p>
                    </div>
                    <div className="bg-purple-500/5 dark:bg-surface-dark rounded-2xl border border-purple-500/10 p-5 text-center transition-all hover:scale-105 group">
                        <p className="text-3xl font-black text-text-base">{vocabStats?.total || 0}</p>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mt-1">Từ vựng</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-surface-dark rounded-3xl border border-border-color divide-y divide-border-color shadow-sm transition-colors">
                    <button
                        onClick={() => router.push('/settings')}
                        className="w-full flex items-center justify-between p-5 hover:bg-surface-highlight transition-colors rounded-t-3xl"
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="settings" className="text-text-secondary" />
                            <span className="text-text-base font-bold">Cài đặt</span>
                        </div>
                        <Icon name="chevron_right" className="text-text-secondary" />
                    </button>
                    {user.role === 'admin' && (
                        <button
                            onClick={() => router.push('/admin')}
                            className="w-full flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Icon name="admin_panel_settings" className="text-amber-500" />
                                <span className="text-text-base font-bold">Trang quản trị</span>
                            </div>
                            <Icon name="chevron_right" className="text-text-secondary" />
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between p-4 hover:bg-red-500/10 transition-colors text-red-400 rounded-b-2xl"
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="logout" />
                            <span>Đăng xuất</span>
                        </div>
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
}

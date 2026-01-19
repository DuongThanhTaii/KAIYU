'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import Modal from '@/components/admin/Modal';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/contexts/AuthContext';
import {
    getAllAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    type Achievement
} from '@/services/adminApi';

const iconOptions = [
    'play_circle', 'local_fire_department', 'menu_book', 'emoji_events', 'style',
    'school', 'star', 'verified', 'diamond', 'rocket_launch', 'military_tech',
    'workspace_premium', 'celebration', 'psychology', 'lightbulb', 'auto_awesome',
];

const colorOptions = [
    { label: 'Xanh dương', value: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { label: 'Cam', value: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    { label: 'Xanh lá', value: 'text-green-400', bgColor: 'bg-green-500/20' },
    { label: 'Vàng', value: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    { label: 'Tím', value: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    { label: 'Hồng', value: 'text-pink-400', bgColor: 'bg-pink-500/20' },
    { label: 'Đỏ', value: 'text-red-400', bgColor: 'bg-red-500/20' },
    { label: 'Primary', value: 'text-primary', bgColor: 'bg-primary/20' },
];

export default function AdminAchievementsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        title: '',
        description: '',
        icon: 'emoji_events',
        iconColor: 'text-yellow-400',
        xpReward: 100,
    });

    // Auth check
    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated) router.replace('/login');
            else if (user?.role !== 'admin') router.replace('/dashboard');
        }
    }, [authLoading, isAuthenticated, user, router]);

    // Fetch achievements
    const fetchAchievements = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getAllAchievements();
            setAchievements(response.data);
        } catch (err) {
            console.error('Failed to fetch achievements:', err);
            setError('Không thể tải danh sách thành tích');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            fetchAchievements();
        }
    }, [fetchAchievements, isAuthenticated, user]);

    const resetForm = () => {
        setFormData({
            code: '',
            title: '',
            description: '',
            icon: 'emoji_events',
            iconColor: 'text-yellow-400',
            xpReward: 100,
        });
        setEditingAchievement(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const handleOpenEdit = (achievement: Achievement) => {
        setEditingAchievement(achievement);
        setFormData({
            code: achievement.code,
            title: achievement.title,
            description: achievement.description || '',
            icon: achievement.icon || 'emoji_events',
            iconColor: achievement.iconColor || 'text-yellow-400',
            xpReward: achievement.xpReward,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            if (editingAchievement) {
                await updateAchievement(editingAchievement.id, formData);
            } else {
                await createAchievement(formData);
            }
            setShowModal(false);
            resetForm();
            fetchAchievements();
        } catch (err) {
            console.error('Failed to save achievement:', err);
            setError('Không thể lưu thành tích');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setIsSaving(true);
        try {
            await deleteAchievement(id);
            setAchievements(achievements.filter(a => a.id !== id));
            setShowDeleteConfirm(null);
        } catch (err) {
            console.error('Failed to delete achievement:', err);
            setError('Không thể xóa thành tích');
        } finally {
            setIsSaving(false);
        }
    };

    const getColorBg = (color: string) => {
        const found = colorOptions.find(c => c.value === color);
        return found?.bgColor || 'bg-gray-500/20';
    };

    // Stats
    const totalEarned = achievements.reduce((sum, a) => sum + (a.earnedCount || 0), 0);
    const totalXPAwarded = achievements.reduce((sum, a) => sum + (a.xpReward * (a.earnedCount || 0)), 0);

    // Show loading while checking auth
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (loading) {
        return (
            <AdminLayout title="Quản lý Achievements">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            title="Quản lý Achievements"
            actions={
                <button
                    onClick={handleOpenCreate}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50"
                >
                    <Icon name="add" />
                    Thêm Achievement
                </button>
            }
        >
            {/* Error Toast */}
            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Icon name="error" className="text-red-400" />
                        <p className="text-red-400">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                        <Icon name="close" />
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-surface-dark rounded-xl border border-border-color">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-white">{achievements.length}</p>
                            <p className="text-xs text-text-secondary">Tổng achievements</p>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <Icon name="emoji_events" className="text-2xl text-yellow-400" />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-surface-dark rounded-xl border border-border-color">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-white">{totalEarned.toLocaleString()}</p>
                            <p className="text-xs text-text-secondary">Lần đạt được</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <Icon name="celebration" className="text-2xl text-green-400" />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-surface-dark rounded-xl border border-border-color">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-white">{totalXPAwarded.toLocaleString()}</p>
                            <p className="text-xs text-text-secondary">XP đã trao</p>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon name="auto_awesome" className="text-2xl text-primary" />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-surface-dark rounded-xl border border-border-color">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {achievements.length > 0
                                    ? Math.round(totalEarned / achievements.length)
                                    : 0}
                            </p>
                            <p className="text-xs text-text-secondary">Trung bình/achievement</p>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Icon name="analytics" className="text-2xl text-purple-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Achievements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => (
                    <div
                        key={achievement.id}
                        className="bg-surface-dark rounded-xl border border-border-color p-6 hover:border-amber-500/30 transition-colors group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-4 rounded-xl flex items-center justify-center ${getColorBg(achievement.iconColor || 'text-yellow-400')}`}>
                                <Icon
                                    name={achievement.icon || 'emoji_events'}
                                    className={`text-3xl ${achievement.iconColor || 'text-yellow-400'}`}
                                />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleOpenEdit(achievement)}
                                    className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                                >
                                    <Icon name="edit" className="text-lg" />
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(achievement.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                    <Icon name="delete" className="text-lg" />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-1">{achievement.title}</h3>
                        <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                            {achievement.description}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-border-color">
                            <div className="flex items-center gap-2">
                                <Icon name="auto_awesome" className="text-primary text-sm" />
                                <span className="text-sm font-bold text-primary">+{achievement.xpReward} XP</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon name="group" className="text-text-secondary text-sm" />
                                <span className="text-sm text-text-secondary">
                                    {(achievement.earnedCount || 0).toLocaleString()} lần
                                </span>
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-text-secondary font-mono">
                            {achievement.code}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingAchievement ? 'Chỉnh sửa Achievement' : 'Thêm Achievement mới'}
                size="md"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
                        >
                            {editingAchievement ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Preview */}
                    <div className="flex items-center gap-4 p-4 bg-background-dark rounded-xl">
                        <div className={`p-3 rounded-xl flex items-center justify-center ${getColorBg(formData.iconColor)}`}>
                            <Icon name={formData.icon} className={`text-3xl ${formData.iconColor}`} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">{formData.title || 'Tiêu đề'}</h4>
                            <p className="text-sm text-text-secondary">{formData.description || 'Mô tả...'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Mã code <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white font-mono placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                                placeholder="VD: FIRST_VIDEO"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                XP Reward <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.xpReward}
                                onChange={(e) => setFormData({ ...formData, xpReward: Number(e.target.value) })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                                placeholder="100"
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Tiêu đề <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="VD: Người xem đầu tiên"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Mô tả
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors resize-none"
                            placeholder="Mô tả cách đạt được achievement..."
                            rows={2}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Icon
                        </label>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {iconOptions.map((icon) => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, icon })}
                                    className={`p-2 rounded-lg transition-colors flex items-center justify-center ${formData.icon === icon
                                        ? 'bg-primary/20 text-primary ring-2 ring-primary'
                                        : 'bg-background-dark text-text-secondary hover:text-white'
                                        }`}
                                >
                                    <Icon name={icon} className="text-xl" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Màu sắc
                        </label>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {colorOptions.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, iconColor: color.value })}
                                    className={`p-2 rounded-lg ${color.bgColor} transition-all flex items-center justify-center ${formData.iconColor === color.value
                                        ? 'ring-2 ring-white'
                                        : 'opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <Icon name={formData.icon} className={`text-xl ${color.value}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                title="Xác nhận xóa"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                            className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 transition-colors"
                        >
                            Xóa
                        </button>
                    </>
                }
            >
                <p className="text-text-secondary">
                    Bạn có chắc chắn muốn xóa achievement này? Hành động này không thể hoàn tác.
                </p>
            </Modal>
        </AdminLayout>
    );
}

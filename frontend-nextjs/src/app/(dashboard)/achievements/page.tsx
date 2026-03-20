'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Icon from '@/components/common/Icon';
import Card from '@/components/common/Card';
import { achievementsApi, type Achievement } from '@/services/achievementsApi';

type FilterType = 'all' | 'earned' | 'locked';

export default function AchievementsPage() {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [newlyAwarded, setNewlyAwarded] = useState<Achievement[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    // Fetch achievements - first check and award any new ones, then get the list
    const fetchAchievements = useCallback(async () => {
        setIsLoading(true);
        try {
            // First, check and award any achievements the user qualifies for
            const awarded = await achievementsApi.checkAchievements();
            if (awarded && awarded.length > 0) {
                setNewlyAwarded(awarded);
            }
            // Then fetch the updated list
            const data = await achievementsApi.getUserAchievements();
            setAchievements(data);
        } catch (err) {
            console.error('Failed to fetch achievements:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAchievements();
    }, [fetchAchievements]);

    // Filter achievements
    const filteredAchievements = achievements.filter(a => {
        if (filter === 'earned') return a.earnedAt !== null;
        if (filter === 'locked') return a.earnedAt === null;
        return true;
    });

    // Stats
    const totalXP = achievements
        .filter(a => a.earnedAt !== null)
        .reduce((sum, a) => sum + a.xpReward, 0);
    const earnedCount = achievements.filter(a => a.earnedAt !== null).length;
    const progress = achievements.length > 0 ? Math.round((earnedCount / achievements.length) * 100) : 0;

    // Get background color for icon
    const getIconBg = (color: string | null) => {
        const colorMap: Record<string, string> = {
            'text-blue-400': 'bg-blue-500/20',
            'text-orange-400': 'bg-orange-500/20',
            'text-green-400': 'bg-green-500/20',
            'text-yellow-400': 'bg-yellow-500/20',
            'text-purple-400': 'bg-purple-500/20',
            'text-pink-400': 'bg-pink-500/20',
            'text-red-400': 'bg-red-500/20',
            'text-primary': 'bg-primary/20',
        };
        return colorMap[color || ''] || 'bg-gray-500/20';
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-text-secondary">Đang tải thành tựu...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {/* Newly Awarded Notification */}
                {newlyAwarded.length > 0 && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl animate-pulse">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-500/30 rounded-full">
                                    <Icon name="celebration" className="text-2xl text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-text-base font-bold">🎉 Chúc mừng! Bạn đã đạt {newlyAwarded.length} thành tựu mới!</p>
                                    <p className="text-sm text-text-secondary">
                                        {newlyAwarded.map(a => a.title).join(', ')} • +{newlyAwarded.reduce((sum, a) => sum + a.xpReward, 0)} XP
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setNewlyAwarded([])}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Icon name="close" className="text-text-secondary" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="inline-flex items-center justify-center p-3 bg-yellow-500/20 rounded-xl">
                            <Icon name="emoji_events" className="text-3xl text-yellow-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-text-base">Thành tựu</h1>
                            <p className="text-text-secondary font-medium">Theo dõi tiến trình và thành tựu của bạn</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card variant="default" className="!p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-black text-primary">{totalXP}</p>
                                <p className="text-sm text-text-secondary">Tổng XP đạt được</p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-xl flex items-center justify-center">
                                <Icon name="auto_awesome" className="text-2xl text-primary" />
                            </div>
                        </div>
                    </Card>

                    <Card variant="default" className="!p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-black text-text-base leading-none mb-1">
                                    {earnedCount}<span className="text-lg text-text-secondary ml-1">/{achievements.length}</span>
                                </p>
                                <p className="text-sm text-text-secondary">Thành tựu đã đạt</p>
                            </div>
                            <div className="p-3 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                                <Icon name="military_tech" className="text-2xl text-yellow-400" />
                            </div>
                        </div>
                    </Card>

                    <Card variant="default" className="!p-5">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-bold text-text-secondary">Tiến độ tổng</p>
                                <p className="text-lg font-bold text-text-base">{progress}%</p>
                            </div>
                            <div className="h-3 bg-border-color/30 dark:bg-background-dark rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 mb-6">
                    {[
                        { key: 'all', label: 'Tất cả', count: achievements.length },
                        { key: 'earned', label: 'Đã đạt', count: earnedCount },
                        { key: 'locked', label: 'Chưa đạt', count: achievements.length - earnedCount },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as FilterType)}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${filter === tab.key
                                ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                                : 'bg-surface-dark border border-border-color text-text-secondary hover:text-text-base hover:border-primary/50'
                                }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Achievements Grid */}
                {filteredAchievements.length === 0 ? (
                    <Card variant="default" className="py-16 text-center">
                        <Icon name="emoji_events" className="text-6xl text-text-secondary/20 mb-4" />
                        <p className="text-lg font-bold text-text-base mb-2">
                            {filter === 'earned' ? 'Chưa có thành tựu nào' : 'Không có thành tựu'}
                        </p>
                        <p className="text-text-secondary">
                            {filter === 'earned'
                                ? 'Hãy tiếp tục học để đạt được thành tựu đầu tiên!'
                                : 'Bạn đã đạt được tất cả thành tựu!'
                            }
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAchievements.map(achievement => {
                            const isEarned = achievement.earnedAt !== null;
                            return (
                                <div
                                    key={achievement.id}
                                    className={`relative rounded-2xl border p-6 transition-all ${isEarned
                                        ? 'bg-primary/5 dark:bg-surface-dark border-primary/30 shadow-lg shadow-primary/5'
                                        : 'bg-surface-dark border-border-color opacity-70 grayscale'
                                        }`}
                                >
                                    {/* Earned Badge */}
                                    {isEarned && (
                                        <div className="absolute top-4 right-4">
                                            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full">
                                                <Icon name="check_circle" className="text-green-400 text-sm" />
                                                <span className="text-xs font-bold text-green-400">Đã đạt</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className={`inline-flex items-center justify-center p-4 rounded-xl mb-4 ${getIconBg(achievement.iconColor)}`}>
                                        <Icon
                                            name={achievement.icon || 'emoji_events'}
                                            className={`text-4xl ${achievement.iconColor || 'text-yellow-400'}`}
                                        />
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-lg font-bold text-text-base mb-1">{achievement.title}</h3>
                                    <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                                        {achievement.description}
                                    </p>

                                    {/* Progress Bar */}
                                    {achievement.targetValue && achievement.targetValue > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-text-secondary">Tiến độ</span>
                                                <span className={`text-xs font-bold ${isEarned ? 'text-primary' : 'text-text-secondary'}`}>
                                                    {achievement.currentValue || 0}/{achievement.targetValue}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-border-color/30 dark:bg-background-dark rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${isEarned
                                                        ? 'bg-gradient-to-r from-green-400 to-primary'
                                                        : 'bg-gradient-to-r from-yellow-500/50 to-orange-500/50'
                                                        }`}
                                                    style={{
                                                        width: `${Math.min(100, ((achievement.currentValue || 0) / achievement.targetValue) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-4 border-t border-border-color">
                                        <div className="flex items-center gap-2">
                                            <Icon name="auto_awesome" className="text-primary text-sm" />
                                            <span className="text-sm font-bold text-primary">+{achievement.xpReward} XP</span>
                                        </div>
                                        {isEarned && achievement.earnedAt && (
                                            <span className="text-xs text-text-secondary">
                                                {formatDate(achievement.earnedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

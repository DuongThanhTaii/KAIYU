'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/common/Card';
import Icon from '@/components/common/Icon';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import StreakBadge from '@/components/common/StreakBadge';
import { useAuth } from '@/contexts/AuthContext';
import { flashcardApi, type FlashcardStats } from '@/services/flashcardApi';
import { progressApi, type VideoProgress, type WeeklyProgress, type DailyProgress } from '@/services/progressApi';
import { userVocabularyApi, type UserVocabularyStats } from '@/services/userVocabularyApi';
import { achievementsApi, type Achievement } from '@/services/achievementsApi';
import { videoApi, type Video } from '@/services/videoApi';
import { saveProgress } from '@/services/progressStorage';

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useAuth();

    // State for API data
    const [flashcardStats, setFlashcardStats] = useState<FlashcardStats | null>(null);
    const [recentProgress, setRecentProgress] = useState<VideoProgress[]>([]);
    const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null);
    const [vocabStats, setVocabStats] = useState<UserVocabularyStats | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [randomVideos, setRandomVideos] = useState<Video[]>([]);
    const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch all dashboard data
    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [flashcards, progress, weekly, daily, vocab, earned, allVideos] = await Promise.all([
                flashcardApi.getStats().catch(() => null),
                progressApi.getVideoProgress().catch(() => []),
                progressApi.getWeeklyProgress().catch(() => null),
                progressApi.getDailyProgress().catch(() => null),
                userVocabularyApi.getStats().catch(() => null),
                achievementsApi.getEarnedAchievements().catch(() => []),
                videoApi.getAll({ limit: 20 }).catch(() => ({ data: [] })),
            ]);

            setFlashcardStats(flashcards);
            setRecentProgress(progress);
            setWeeklyProgress(weekly);
            setDailyProgress(daily);
            setVocabStats(vocab);
            setAchievements(earned);
            // Pick top viewed video for thumbnail
            const sortedByViews = allVideos.data.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
            if (sortedByViews.length > 0) {
                // Pick randomly from top 5 most viewed
                const topVideos = sortedByViews.slice(0, 5);
                const randomTop = topVideos[Math.floor(Math.random() * topVideos.length)];
                setRandomVideos([randomTop]);
            }

            // Save progress to localStorage for login page display
            if (user && vocab) {
                // Calculate vocab progress percent based on HSK level targets
                const hskTargets: Record<number, number> = { 1: 150, 2: 300, 3: 600, 4: 1200, 5: 2500, 6: 5000 };
                const target = hskTargets[user.hskLevel] || 600;
                const vocabPercent = Math.min(100, Math.round((vocab.total / target) * 100));

                saveProgress({
                    hskLevel: user.hskLevel,
                    vocabPercent: vocabPercent,
                    streak: user.streak,
                    userName: user.name || user.email,
                });
            }
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Get most recent video in progress
    const resumeVideo = recentProgress.find(p => p.progressPercent > 0 && p.progressPercent < 100);

    // Calculate daily goal progress from API watchTimeMinutes
    const minutesStudied = dailyProgress?.watchTimeMinutes || 0;
    const dailyGoalPercent = Math.min(100, Math.round((minutesStudied / (user?.dailyGoalMinutes || 30)) * 100));

    // Format date for achievements
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Hôm nay';
        if (diffDays === 1) return 'Hôm qua';
        return date.toLocaleDateString('vi-VN');
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-8 pb-10">
                {/* Welcome Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-text-base tracking-tight mb-2">
                            Xin chào, {user?.name || 'Bạn'}! 👋
                        </h1>
                        <p className="text-text-secondary text-lg font-bold tracking-tight mt-2">
                            {user?.streak && user.streak > 0
                                ? 'Tiếp tục phát huy nhé!'
                                : 'Hãy bắt đầu học ngay hôm nay!'
                            }
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        rightIcon={<Icon name="arrow_forward" size="sm" />}
                        onClick={() => router.push('/profile')}
                    >
                        Xem thống kê
                    </Button>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 auto-rows-min">

                    {/* 1. Resume Watching (Large Hero) */}
                    <Card
                        variant="default"
                        padding="none"
                        className="col-span-1 md:col-span-2 xl:col-span-2 relative overflow-hidden group cursor-pointer min-h-[320px]"
                        onClick={() => resumeVideo ? router.push(`/learn/${resumeVideo.videoId}`) : router.push('/learn')}
                    >
                        {/* Background with single video thumbnail */}
                        <div className="absolute inset-0">
                            {resumeVideo ? (
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${resumeVideo.video.thumbnailUrl || '/placeholder-video.jpg'})` }}
                                />
                            ) : randomVideos[0] ? (
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${randomVideos[0].thumbnailUrl || videoApi.getYouTubeThumbnail(randomVideos[0].videoUrl) || '/placeholder-video.jpg'})` }}
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface-dark to-surface-dark" />
                            )}
                        </div>
                        <div
                            className="absolute inset-0 transition-opacity duration-300"
                            style={{ background: 'var(--hero-overlay)' }}
                        />

                        <div className="relative p-6 flex flex-col justify-end h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <Badge variant="primary" size="md">
                                    {resumeVideo ? 'Tiếp tục xem' : 'Bắt đầu học'}
                                </Badge>
                                {resumeVideo && (
                                    <span className="text-primary text-sm font-bold flex items-center gap-1">
                                        <Icon name="schedule" size="sm" />
                                        {Math.round((100 - resumeVideo.progressPercent) * resumeVideo.video.durationSeconds / 100 / 60)} phút còn lại
                                    </span>
                                )}
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-text-base mb-2 leading-tight">
                                {resumeVideo?.video.title || 'Khám phá thư viện video'}
                            </h3>
                            <p className="text-text-secondary text-sm md:text-base mb-6 font-bold line-clamp-2 max-w-lg">
                                {resumeVideo
                                    ? <span>HSK {resumeVideo.video.hskLevel} • <span className="text-primary">Tiếp tục từ lần trước</span></span>
                                    : 'Học tiếng Trung qua video thực tế với phụ đề tương tác.'
                                }
                            </p>
                            <div className="flex items-center gap-4 bg-black/20 backdrop-blur-md p-2 rounded-full pr-6 w-fit border border-white/10">
                                <button className="bg-primary text-on-primary rounded-full size-10 flex items-center justify-center hover:scale-105 transition-transform">
                                    <Icon name="play_arrow" filled />
                                </button>
                                {resumeVideo ? (
                                    <div className="flex flex-col gap-1 min-w-[140px]">
                                        <div className="flex justify-between text-xs font-black text-text-base">
                                            <span>Tiến độ</span>
                                            <span>{resumeVideo.progressPercent}%</span>
                                        </div>
                                        <div className="h-1.5 bg-border-color rounded-full w-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(76,223,32,0.3)]"
                                                style={{ width: `${resumeVideo.progressPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-text-base font-medium">Xem video</span>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* 2. SRS Review Today */}
                    <Card variant="default" hover className="relative overflow-hidden group bg-orange-500/5 border-orange-500/20 shadow-sm p-4 md:p-6" padding="none">
                        <div className="absolute -right-4 -top-4 text-surface-highlight opacity-20 group-hover:opacity-30 transition-opacity transform rotate-12">
                            <Icon name="style" size="xl" className="text-[100px]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400 flex items-center justify-center">
                                    <Icon name="history_edu" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Ôn tập SRS</span>
                            </div>
                            <h3 className="text-3xl md:text-4xl font-black text-text-base mb-1">
                                {flashcardStats?.dueToday || 0}
                            </h3>
                            <p className="text-text-secondary font-bold text-sm md:text-base">Từ cần ôn hôm nay</p>
                        </div>
                        <div className="mt-8">
                            <Button
                                variant="secondary"
                                fullWidth
                                rightIcon={<Icon name="arrow_forward" size="sm" />}
                                onClick={() => router.push('/review')}
                            >
                                Bắt đầu
                            </Button>
                        </div>
                    </Card>

                    {/* 3. Vocab Stats (Tall Pillar) */}
                    <Card variant="default" padding="none" className="row-span-2 flex flex-col overflow-hidden bg-blue-500/5 border-blue-500/20 shadow-sm">
                        <div className="p-4 md:p-6 border-b border-border-color">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 flex items-center justify-center">
                                        <Icon name="bookmark" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Từ vựng</span>
                                </div>
                                <Badge variant="secondary" size="sm" className="whitespace-nowrap">
                                    +{vocabStats?.savedThisWeek || 0}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex-1 p-3 md:p-4 flex flex-col gap-3 md:gap-4">
                            <div className="flex items-center justify-between p-3 md:p-4 bg-surface-dark/50 rounded-xl border border-blue-500/10 shadow-sm">
                                <span className="text-text-secondary font-bold text-sm md:text-base">Tổng đã lưu</span>
                                <span className="text-xl md:text-2xl font-black text-text-base">{vocabStats?.total || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 md:p-4 bg-surface-dark/50 rounded-xl border border-blue-500/10 shadow-sm">
                                <span className="text-text-secondary font-bold text-sm md:text-base">Thành thạo</span>
                                <span className="text-xl md:text-2xl font-bold text-primary">{vocabStats?.mastered || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 md:p-4 bg-surface-dark/50 rounded-xl border border-blue-500/10 shadow-sm">
                                <span className="text-text-secondary font-bold text-sm md:text-base">Đang học</span>
                                <span className="text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{vocabStats?.learning || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 md:p-4 bg-surface-dark/50 rounded-xl border border-blue-500/10 shadow-sm">
                                <span className="text-text-secondary font-bold text-sm md:text-base">Cần ôn</span>
                                <span className="text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400">{(vocabStats?.review || 0) + (vocabStats?.new || 0)}</span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border-color">
                            <button
                                className="w-full text-sm font-bold text-text-secondary hover:text-text-base text-center"
                                onClick={() => router.push('/vocab')}
                            >
                                Xem tất cả
                            </button>
                        </div>
                    </Card>

                    {/* 4. Progress Chart */}
                    <Card variant="default" className="col-span-1 md:col-span-2 xl:col-span-2 p-4 md:p-6" padding="none">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-text-base">Hoạt động học tập</h3>
                                <p className="text-sm text-text-secondary">7 ngày qua</p>
                            </div>
                        </div>

                        {/* Simple Bar Chart */}
                        <div className="flex-1 flex items-end justify-between gap-1.5 md:gap-2 h-32 md:h-40 px-1 md:px-2">
                            {weeklyProgress?.days?.map((dayData, i) => {
                                const maxMinutes = Math.max(
                                    ...(weeklyProgress?.days?.map(d => (d.vocabularySaved || 0) + (d.reviewsCompleted || 0)) || [1]),
                                    1
                                );
                                const activity = (dayData.vocabularySaved || 0) + (dayData.reviewsCompleted || 0);
                                const height = maxMinutes > 0 ? (activity / maxMinutes) * 100 : 0;
                                const isToday = i === weeklyProgress.days.length - 1;
                                const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                                // Parse date string as local date (YYYY-MM-DD format)
                                const [year, month, day] = dayData.date.split('-').map(Number);
                                const localDate = new Date(year, month - 1, day);
                                const dayOfWeek = localDate.getDay();
                                return (
                                    <div key={dayData.date} className="flex flex-col items-center gap-2 group w-full">
                                        <div className="w-full bg-surface-highlight rounded-t-md relative h-32 group-hover:bg-surface-highlight/80 transition-all">
                                            <div
                                                className={`absolute bottom-0 w-full rounded-t-md transition-all ${isToday ? 'bg-primary shadow-[0_0_15px_rgba(76,223,32,0.3)]' : 'bg-primary/30'}`}
                                                style={{ height: `${Math.max(height, 8)}%` }}
                                            ></div>
                                        </div>
                                        <span className={`text-[10px] uppercase font-bold ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
                                            {dayLabels[dayOfWeek]}
                                        </span>
                                    </div>
                                );
                            }) || ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                                <div key={day} className="flex flex-col items-center gap-2 group w-full">
                                    <div className="w-full bg-surface-highlight rounded-t-md relative h-32"></div>
                                    <span className="text-[10px] uppercase font-bold text-text-secondary">{day}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* 5. Daily Goal Circle */}
                    <Card variant="default" className="flex flex-col justify-center items-center relative overflow-hidden bg-primary/5 border-primary/20 shadow-sm p-6" padding="none">
                        <div className="relative size-28 md:size-32 mb-4">
                            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                <path
                                    className="text-surface-highlight"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeWidth="3"
                                />
                                <path
                                    className="text-primary"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeDasharray={`${dailyGoalPercent}, 100`}
                                    strokeLinecap="round"
                                    strokeWidth="3"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl md:text-3xl font-bold text-text-base">{dailyGoalPercent}<span className="text-sm align-top">%</span></span>
                            </div>
                        </div>
                        <div className="text-center relative z-10">
                            <h4 className="text-text-base font-bold text-base md:text-lg">Mục tiêu hôm nay</h4>
                            <p className="text-text-secondary text-xs md:text-sm">
                                {minutesStudied}/{user?.dailyGoalMinutes || 30} phút
                            </p>
                        </div>
                    </Card>

                    {/* 6. Achievements Table */}
                    <Card variant="default" padding="none" className="col-span-1 md:col-span-2 xl:col-span-4 overflow-hidden">
                        <div className="p-6 border-b border-border-color flex justify-between items-center">
                            <h3 className="text-lg font-black text-text-base">Thành tựu gần đây</h3>
                            <Link href="/achievements" className="text-primary text-sm font-bold hover:underline">
                                Xem tất cả
                            </Link>
                        </div>
                        {achievements.length === 0 ? (
                            <div className="p-8 text-center">
                                <Icon name="emoji_events" className="text-4xl text-text-secondary mb-2" />
                                <p className="text-text-secondary">Chưa có thành tựu nào. Hãy tiếp tục học để đạt được!</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-text-secondary uppercase bg-background-dark/50">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Huy hiệu</th>
                                                <th className="px-6 py-4 font-bold">Mô tả</th>
                                                <th className="px-6 py-4 font-bold">Ngày đạt</th>
                                                <th className="px-6 py-4 font-bold text-right">XP</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-color">
                                            {achievements.slice(0, 5).map((item) => (
                                                <tr key={item.id} className="hover:bg-surface-highlight/50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-text-base flex items-center gap-3">
                                                        <div className={`size-8 rounded-full bg-${item.iconColor?.replace('text-', '')}/20 flex items-center justify-center ${item.iconColor || 'text-primary'}`}>
                                                            <Icon name={item.icon || 'emoji_events'} size="md" />
                                                        </div>
                                                        {item.title}
                                                    </td>
                                                    <td className="px-6 py-4 text-text-secondary">{item.description}</td>
                                                    <td className="px-6 py-4 text-text-secondary">{formatDate(item.earnedAt)}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-primary">+{item.xpReward} XP</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden flex flex-col divide-y divide-border-color">
                                    {achievements.slice(0, 5).map((item) => (
                                        <div key={item.id} className="p-4 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-8 rounded-full bg-${item.iconColor?.replace('text-', '')}/20 flex items-center justify-center ${item.iconColor || 'text-primary'}`}>
                                                        <Icon name={item.icon || 'emoji_events'} size="sm" />
                                                    </div>
                                                    <span className="font-bold text-text-base">{item.title}</span>
                                                </div>
                                                <span className="text-xs font-bold text-primary">+{item.xpReward} XP</span>
                                            </div>
                                            <p className="text-xs text-text-secondary">{item.description}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">{formatDate(item.earnedAt)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';
import NotificationDropdown from '@/components/common/NotificationDropdown';
import SpeakerButton from '@/components/common/SpeakerButton';
import VideoClipPlayer from '@/components/common/VideoClipPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { flashcardApi, type FlashcardReview as FlashcardType, type FlashcardStats, type SRSRating } from '@/services/flashcardApi';

export default function FlashcardReviewPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [queue, setQueue] = useState<FlashcardType[]>([]);
    const [stats, setStats] = useState<FlashcardStats | null>(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false); // Start with front side (not revealed)
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewedCount, setReviewedCount] = useState(0);

    // Fetch flashcard queue and stats
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [queueData, statsData] = await Promise.all([
                flashcardApi.getQueue(),
                flashcardApi.getStats(),
            ]);
            setQueue(queueData.cards);
            setStats(statsData);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Không thể tải dữ liệu';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const currentCard = queue[currentCardIndex];
    const totalCards = queue.length;

    // Helper to get vocabulary from card (backend returns 'word', we also support 'vocabulary')
    const getVocab = (card: FlashcardType | undefined) => card?.vocabulary || card?.word;

    const handleSRSRating = async (rating: SRSRating) => {
        if (!currentCard || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await flashcardApi.submitReview(currentCard.id, rating);
            setReviewedCount(prev => prev + 1);
            setIsRevealed(false);

            // Move to next card after animation
            setTimeout(() => {
                if (currentCardIndex < queue.length - 1) {
                    setCurrentCardIndex(prev => prev + 1);
                    setIsRevealed(false); // Start next card on front side
                } else {
                    // Queue completed
                    setCurrentCardIndex(-1);
                }
            }, 300);
        } catch (err) {
            console.error('Failed to submit review:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="bg-background-dark text-white font-display min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary">Đang tải flashcards...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-background-dark text-white font-display min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Icon name="error" className="text-6xl text-red-400 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Có lỗi xảy ra</h2>
                    <p className="text-text-secondary mb-4">{error}</p>
                    <Button variant="secondary" onClick={fetchData}>Thử lại</Button>
                </div>
            </div>
        );
    }

    // Empty queue state
    if (queue.length === 0 || currentCardIndex === -1) {
        return (
            <div className="bg-background-dark text-white font-display min-h-screen flex flex-col">
                <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-border-color px-4 md:px-8 py-3">
                    <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                        <Link href="/dashboard" className="size-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white">
                            <Icon name="arrow_back" />
                        </Link>
                        <h1 className="text-white text-lg font-bold">Ôn tập Flashcard</h1>
                        <div className="size-10" />
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center max-w-md">
                        <div className="size-24 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <Icon name="celebration" className="text-5xl text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {reviewedCount > 0 ? 'Hoàn thành!' : 'Không có từ cần ôn'}
                        </h2>
                        <p className="text-text-secondary mb-6">
                            {reviewedCount > 0
                                ? `Bạn đã ôn tập ${reviewedCount} từ. Tuyệt vời!`
                                : 'Bạn đã ôn tập hết tất cả từ vựng hôm nay. Hãy quay lại sau!'
                            }
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button variant="primary" onClick={() => router.push('/dashboard')}>
                                Về Dashboard
                            </Button>
                            <Button variant="secondary" onClick={() => router.push('/vocab')}>
                                Xem sổ từ vựng
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="bg-background-dark text-white font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary selection:text-on-primary">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-border-color px-4 md:px-8 py-3">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    {/* Left: Breadcrumb */}
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="size-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white">
                            <Icon name="arrow_back" />
                        </Link>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
                                <span>Ôn tập hàng ngày</span>
                            </div>
                            <h1 className="text-white text-lg font-bold leading-tight">Flashcards</h1>
                        </div>
                    </div>

                    {/* Center: Progress */}
                    <div className="hidden md:flex flex-col w-1/3 max-w-sm gap-2">
                        <div className="flex justify-between text-xs font-bold text-text-secondary">
                            <span>Tiến độ</span>
                            <span className="text-white">{reviewedCount} / {totalCards}</span>
                        </div>
                        <div className="h-2 w-full bg-surface-highlight rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(76,223,32,0.5)] transition-all"
                                style={{ width: `${totalCards > 0 ? (reviewedCount / totalCards) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Right: Header Elements */}
                    <div className="flex items-center gap-4">
                        {/* Streak Display */}
                        <div className="hidden md:flex items-center gap-1 bg-surface-dark px-3 py-1.5 rounded-full border border-border-color">
                            <Icon name="local_fire_department" className="text-orange-500" size="md" />
                            <span className="text-sm font-bold text-white">{user?.streak || 0}</span>
                        </div>

                        {/* XP Display */}
                        <div className="hidden md:flex items-center gap-1 bg-surface-dark px-3 py-1.5 rounded-full border border-border-color">
                            <Icon name="sailing" className="text-cyan-400" size="md" />
                            <span className="text-sm font-bold text-white">{user?.xp || 0}</span>
                        </div>

                        {/* Notifications */}
                        <NotificationDropdown />

                        {/* User Avatar */}
                        <button
                            onClick={() => router.push('/profile')}
                            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            {user?.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={user?.name || 'User'}
                                    className="rounded-full size-10 ring-2 ring-border-color object-cover"
                                />
                            ) : (
                                <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-full size-10 ring-2 ring-border-color flex items-center justify-center text-on-primary font-bold">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1">

                    {/* Left Column: Stats */}
                    <aside className="lg:col-span-3 xl:col-span-3 flex flex-col gap-4">
                        {/* Queue Stats Block */}
                        <div className="bg-surface-dark rounded-[2rem] p-6 border border-border-color flex flex-col gap-5 shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none" />
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="size-10 rounded-xl bg-surface-highlight flex items-center justify-center text-primary">
                                    <Icon name="analytics" />
                                </div>
                                <h2 className="text-white text-lg font-bold">Hàng đợi</h2>
                            </div>
                            <div className="flex flex-col gap-3 relative z-10">
                                {/* New */}
                                <div className="flex items-center justify-between p-4 bg-background-dark/50 rounded-2xl border border-border-color hover:border-surface-highlight transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                        <span className="text-text-secondary text-sm font-medium">Mới</span>
                                    </div>
                                    <span className="text-white text-xl font-bold">{stats?.new || 0}</span>
                                </div>
                                {/* Learning */}
                                <div className="flex items-center justify-between p-4 bg-background-dark/50 rounded-2xl border border-border-color hover:border-surface-highlight transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
                                        <span className="text-text-secondary text-sm font-medium">Đang học</span>
                                    </div>
                                    <span className="text-white text-xl font-bold">{stats?.learning || 0}</span>
                                </div>
                                {/* Review */}
                                <div className="flex items-center justify-between p-4 bg-background-dark/50 rounded-2xl border border-border-color hover:border-surface-highlight transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-2 rounded-full bg-primary shadow-[0_0_8px_rgba(76,223,32,0.8)]" />
                                        <span className="text-text-secondary text-sm font-medium">Ôn tập</span>
                                    </div>
                                    <span className="text-white text-xl font-bold">{stats?.review || 0}</span>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Center: Flashcard */}
                    <section className="lg:col-span-9 xl:col-span-9 flex flex-col items-center justify-start min-h-[600px] relative pb-4">
                        {/* Flip Card Container */}
                        <div
                            className="w-full max-w-3xl h-[520px] cursor-pointer perspective-1000"
                            onClick={() => setIsRevealed(!isRevealed)}
                        >
                            <div
                                className={`relative w-full h-full transition-transform duration-700 transform-style-preserve-3d ${isRevealed ? 'rotate-y-180' : ''}`}
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                {/* FRONT SIDE - Premium Design */}
                                <div
                                    className="absolute inset-0 w-full h-full flashcard-glass flashcard-border-glow card-lift rounded-2xl shadow-2xl flex flex-col items-center justify-center overflow-hidden"
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    {/* Progress Dots */}
                                    <div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-20">
                                        {Array.from({ length: Math.min(queue.length, 5) }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`progress-dot ${i < reviewedCount ? 'progress-dot-active' : 'progress-dot-inactive'}`}
                                            />
                                        ))}
                                    </div>

                                    {/* Hanzi with Glow */}
                                    <h1 className="text-8xl md:text-9xl font-bold text-white tracking-tight font-chinese mb-6 text-glow">
                                        {getVocab(currentCard)?.hanzi}
                                    </h1>

                                    {/* Level Badge - HSK Level */}
                                    <div className="level-badge px-5 py-2 rounded-xl flex items-center gap-3 mb-6">
                                        <span className="text-lg font-bold text-primary">
                                            HSK {getVocab(currentCard)?.hskLevel || currentCard?.level || 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-text-secondary">Level</span>
                                            <span className="text-sm font-bold text-yellow-400">
                                                {currentCard?.level || 1}/5
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tap hint */}
                                    <div className="flex items-center gap-2 text-text-secondary animate-pulse-glow">
                                        <Icon name="touch_app" size="md" />
                                        <span className="text-sm font-medium">Nhấn để xem đáp án</span>
                                    </div>

                                    {/* Background Decorations */}
                                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/8 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-green-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                                </div>

                                {/* BACK SIDE - Answer + Context */}
                                <div
                                    className="absolute inset-0 w-full h-full flashcard-glass rounded-2xl shadow-2xl border border-primary/20 flex flex-col overflow-hidden"
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                >
                                    {/* Scrollable Content */}
                                    <div className="flex-1 flex flex-col items-center p-6 md:p-8 pt-6 overflow-y-auto">
                                        {/* Hanzi + Pinyin */}
                                        <div className="text-center mb-4">
                                            <h2 className="text-5xl md:text-6xl font-bold text-white font-chinese mb-2">
                                                {getVocab(currentCard)?.hanzi}
                                            </h2>
                                            <div className="flex items-center justify-center gap-3">
                                                <span className="text-2xl md:text-3xl text-primary font-display font-medium">
                                                    {getVocab(currentCard)?.pinyin}
                                                </span>
                                                <SpeakerButton
                                                    text={getVocab(currentCard)?.hanzi || ''}
                                                    size="md"
                                                    className="bg-primary text-on-primary shadow-lg"
                                                />
                                            </div>
                                        </div>

                                        {/* Divider */}
                                        <div className="w-16 h-0.5 bg-primary/30 rounded-full mb-4" />

                                        {/* Meaning */}
                                        <div className="text-center mb-4">
                                            <p className="text-xl md:text-2xl text-white font-medium">
                                                {getVocab(currentCard)?.meaningVi || getVocab(currentCard)?.meaningEn}
                                            </p>
                                            {getVocab(currentCard)?.meaningVi && getVocab(currentCard)?.meaningEn && (
                                                <p className="text-base text-text-secondary mt-1">{getVocab(currentCard)?.meaningEn}</p>
                                            )}
                                        </div>

                                        {/* Example Sentence */}
                                        {getVocab(currentCard)?.examples && getVocab(currentCard)!.examples![0] && (
                                            <div className="w-full max-w-md p-4 rounded-xl bg-background-dark/50 border border-border-color mb-4">
                                                <p className="text-lg text-white font-chinese mb-1">
                                                    {getVocab(currentCard)!.examples![0].hanzi}
                                                </p>
                                                <p className="text-sm text-primary/70">{getVocab(currentCard)!.examples![0].pinyin}</p>
                                                <p className="text-sm text-text-secondary italic">{getVocab(currentCard)!.examples![0].meaning}</p>
                                            </div>
                                        )}

                                        {/* Video Context */}
                                        {(currentCard?.sourceVideoUrl || currentCard?.sourceSentence || currentCard?.sourceImageUrl) && (
                                            <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/20">
                                                <div className="flex items-center gap-2 mb-3 text-xs font-bold text-primary uppercase tracking-wider">
                                                    <Icon name="videocam" size="sm" />
                                                    <span>Ngữ cảnh từ video</span>
                                                </div>

                                                {/* Video Clip Player */}
                                                {currentCard.sourceVideoUrl && currentCard.sourceTimestamp !== undefined && (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <VideoClipPlayer
                                                            videoUrl={currentCard.sourceVideoUrl}
                                                            startTime={currentCard.sourceTimestamp}
                                                            duration={5}
                                                            className="mb-3"
                                                        />
                                                    </div>
                                                )}

                                                {/* Fallback: Static thumbnail */}
                                                {!currentCard.sourceVideoUrl && currentCard.sourceImageUrl && (
                                                    <div className="relative rounded-lg overflow-hidden mb-3 aspect-video bg-black/20">
                                                        <img
                                                            src={currentCard.sourceImageUrl}
                                                            alt="Video context"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Source Sentence */}
                                                {currentCard.sourceSentence && (
                                                    <div className="p-3 bg-black/20 rounded-lg">
                                                        <p className="text-base text-white font-chinese">
                                                            {currentCard.sourceSentence}
                                                        </p>
                                                        {currentCard.sourcePinyin && (
                                                            <p className="text-sm text-primary/70 mt-1">
                                                                {currentCard.sourcePinyin}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tap hint at bottom */}
                                    <div className="flex items-center justify-center gap-2 py-3 text-text-secondary border-t border-border-color bg-background-dark/50">
                                        <Icon name="touch_app" size="sm" />
                                        <span className="text-xs font-medium">Nhấn để lật lại</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SRS Controls */}
                        <div className="w-full max-w-3xl mt-8">
                            {/* Keyboard Shortcuts */}
                            <div className="flex justify-between px-6 mb-3 text-[10px] uppercase font-bold tracking-widest text-text-secondary opacity-50">
                                <span>Phím: 1</span>
                                <span>Phím: 2</span>
                                <span>Phím: 3</span>
                                <span>Phím: 4</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                {/* Again */}
                                <button
                                    onClick={() => handleSRSRating('again')}
                                    disabled={isSubmitting || !isRevealed}
                                    className="relative overflow-hidden h-20 md:h-24 rounded-2xl bg-gradient-to-br from-red-950/40 to-red-900/20 border border-red-500/20 hover:border-red-500/50 transition-all group flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
                                >
                                    <span className="text-2xl group-hover:scale-125 transition-transform">😓</span>
                                    <span className="text-red-400 font-bold text-base">Lại</span>
                                    <span className="text-[10px] text-red-400/60 font-medium">&lt; 1 phút</span>
                                </button>

                                {/* Hard */}
                                <button
                                    onClick={() => handleSRSRating('hard')}
                                    disabled={isSubmitting || !isRevealed}
                                    className="relative overflow-hidden h-20 md:h-24 rounded-2xl bg-gradient-to-br from-orange-950/40 to-orange-900/20 border border-orange-500/20 hover:border-orange-500/50 transition-all group flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
                                >
                                    <span className="text-2xl group-hover:scale-125 transition-transform">😐</span>
                                    <span className="text-orange-400 font-bold text-base">Khó</span>
                                    <span className="text-[10px] text-orange-400/60 font-medium">2 ngày</span>
                                </button>

                                {/* Good */}
                                <button
                                    onClick={() => handleSRSRating('good')}
                                    disabled={isSubmitting || !isRevealed}
                                    className="relative overflow-hidden h-20 md:h-24 rounded-2xl bg-gradient-to-br from-green-950/40 to-green-900/20 border border-green-500/20 hover:border-green-500/50 transition-all group flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                                >
                                    <span className="text-2xl group-hover:scale-125 transition-transform">😊</span>
                                    <span className="text-green-400 font-bold text-base">Tốt</span>
                                    <span className="text-[10px] text-green-400/60 font-medium">4 ngày</span>
                                </button>

                                {/* Easy */}
                                <button
                                    onClick={() => handleSRSRating('easy')}
                                    disabled={isSubmitting || !isRevealed}
                                    className="relative overflow-hidden h-20 md:h-24 rounded-2xl bg-gradient-to-br from-blue-950/40 to-blue-900/20 border border-blue-500/20 hover:border-blue-500/50 transition-all group flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
                                >
                                    <span className="text-2xl group-hover:scale-125 transition-transform">🤩</span>
                                    <span className="text-blue-400 font-bold text-base">Dễ</span>
                                    <span className="text-[10px] text-blue-400/60 font-medium">7 ngày</span>
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

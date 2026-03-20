'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/common/Icon';
import { videoApi, type Video, type Subtitle } from '@/services/videoApi';

export default function VideoDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, isLoading: authLoading, isAuthenticated } = useAuth();
    const [video, setVideo] = useState<Video | null>(null);
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (id && typeof id === 'string' && isAuthenticated) {
            loadData(id);
        }
    }, [id, isAuthenticated]);

    const loadData = async (videoId: string) => {
        try {
            const [videoData, subtitleData] = await Promise.all([
                videoApi.getById(videoId),
                videoApi.getSubtitles(videoId),
            ]);
            setVideo(videoData);
            setSubtitles(subtitleData);
        } catch (error) {
            console.error('Failed to load video:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Extract vocabulary preview from subtitles
    const vocabularyPreview = subtitles
        .filter(sub => sub.hanzi)
        .slice(0, 8)
        .map(sub => ({
            hanzi: sub.hanzi,
            pinyin: sub.pinyin || '',
        }));

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--color-background-dark)]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!video) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-background-dark)] gap-4">
                <Icon name="error" size="xl" className="text-red-500" />
                <h2 className="text-xl font-black text-text-base">Video không tồn tại</h2>
                <Link href="/learn" className="text-primary hover:underline font-bold">
                    ← Quay lại thư viện
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-background-dark)] overflow-y-auto">
            {/* Content Body */}
            <div className="p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full">
                {/* Back Button */}
                <Link
                    href="/learn"
                    className="mb-6 flex items-center gap-2 text-text-secondary hover:text-primary transition-colors cursor-pointer w-fit"
                >
                    <Icon name="arrow_back" size="sm" />
                    <span className="text-sm font-black uppercase tracking-wider">Quay lại thư viện</span>
                </Link>

                {/* Bento Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 auto-rows-min">
                    {/* 1. Hero Video Card (Large) */}
                    <div className="col-span-1 lg:col-span-8 relative group overflow-hidden rounded-2xl bg-surface-dark aspect-video lg:aspect-auto lg:min-h-[480px] shadow-2xl border border-border-color">
                        {/* Thumbnail */}
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                            style={{
                                backgroundImage: video.thumbnailUrl
                                    ? `url("${video.thumbnailUrl}")`
                                    : video.videoUrl
                                        ? `url("${videoApi.getYouTubeThumbnail(video.videoUrl)}")`
                                        : 'linear-gradient(135deg, #1c2b18 0%, #152112 100%)'
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        {/* Play Overlay */}
                        <Link
                            href={`/learn/${video.id}`}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <button className="size-20 rounded-full bg-primary/90 hover:bg-primary text-black flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 shadow-[0_0_30px_rgba(76,223,32,0.4)]">
                                <Icon name="play_arrow" size="xl" className="ml-1" filled />
                            </button>
                        </Link>

                        {/* Video overlay info */}
                        <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex justify-between items-end gap-4 pointer-events-none">
                            <div className="flex flex-wrap gap-3">
                                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2 shadow-lg">
                                    <span className="size-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                    <span className="text-white text-[10px] font-black uppercase tracking-widest leading-none">HD Video</span>
                                </div>
                                <div className="px-4 py-1.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-full shadow-lg flex items-center justify-center">
                                    <span className="text-white text-[10px] font-black uppercase tracking-widest leading-none">Vietsub + Pinyin</span>
                                </div>
                            </div>
                            <span className="text-white/90 font-mono text-xs bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                                {formatDuration(video.durationSeconds)}
                            </span>
                        </div>
                    </div>

                    {/* 2. Info & Action Column */}
                    <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
                        {/* Title Card */}
                        <div className="bg-surface-dark p-6 rounded-2xl border border-border-color flex flex-col justify-between gap-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Icon name="school" size="xl" className="text-primary text-[80px] rotate-12" />
                            </div>
                            <div>
                                <div className="flex gap-2 mb-4 flex-wrap">
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider border border-primary/20">
                                        Video học
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-black uppercase tracking-wider border border-orange-500/20">
                                        HSK {video.hskLevel || '—'}
                                    </span>
                                    {video.category && (
                                        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-wider border border-blue-500/20">
                                            {video.category}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-text-base leading-tight mb-2">{video.title}</h1>
                                <div className="flex items-center gap-4 text-sm text-text-secondary mt-3">
                                    <div className="flex items-center gap-1 font-bold">
                                        <Icon name="visibility" size="sm" />
                                        <span>{video.viewCount ? `${(video.viewCount / 1000).toFixed(1)}k` : '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 font-bold">
                                        <Icon name="schedule" size="sm" />
                                        <span>{Math.round(video.durationSeconds / 60)} min</span>
                                    </div>
                                </div>
                            </div>
                            <Link
                                href={`/learn/${video.id}`}
                                className="w-full py-4 bg-primary hover:bg-primary/90 text-on-primary text-lg font-black rounded-full transition-all flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(76,223,32,0.3)] hover:shadow-[0_4px_30px_rgba(76,223,32,0.5)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                <span>Học video này</span>
                                <Icon name="arrow_forward" size="sm" />
                            </Link>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 flex-1">
                            {/* Stat 1 */}
                            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors shadow-sm">
                                <Icon name="translate" size="lg" className="text-primary" />
                                <div className="text-center">
                                    <p className="text-2xl font-black text-text-base">{subtitles.length}</p>
                                    <p className="text-text-secondary text-[10px] font-black uppercase tracking-wider">Câu phụ đề</p>
                                </div>
                            </div>
                            {/* Stat 2 */}
                            <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10 flex flex-col items-center justify-center gap-2 hover:bg-blue-500/10 transition-colors shadow-sm">
                                <Icon name="psychology" size="lg" className="text-blue-500 dark:text-blue-400" />
                                <div className="text-center">
                                    <p className="text-2xl font-black text-text-base">85%</p>
                                    <p className="text-text-secondary text-[10px] font-black uppercase tracking-wider">Đánh giá</p>
                                </div>
                            </div>
                            {/* Stat 3 */}
                            <div className="bg-orange-500/5 p-5 rounded-2xl border border-orange-500/10 flex flex-col items-center justify-center gap-2 hover:bg-orange-500/10 transition-colors shadow-sm">
                                <Icon name="local_fire_department" size="lg" className="text-orange-500 dark:text-yellow-400" />
                                <div className="text-center">
                                    <p className="text-2xl font-black text-text-base">{video.xpReward || 20}xp</p>
                                    <p className="text-text-secondary text-[10px] font-black uppercase tracking-wider">Phần thưởng</p>
                                </div>
                            </div>
                            {/* Stat 4 */}
                            <div className="bg-purple-500/5 p-5 rounded-2xl border border-purple-500/10 flex flex-col items-center justify-center gap-2 hover:bg-purple-500/10 transition-colors shadow-sm">
                                <Icon name="record_voice_over" size="lg" className="text-purple-600 dark:text-purple-400" />
                                <div className="text-center">
                                    <p className="text-2xl font-black text-text-base">Native</p>
                                    <p className="text-text-secondary text-[10px] font-black uppercase tracking-wider">Giọng đọc</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Description Block */}
                    <div className="col-span-1 lg:col-span-7 bg-surface-dark rounded-2xl p-6 md:p-8 border border-border-color shadow-sm flex flex-col gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Icon name="description" size="sm" />
                                </div>
                                <h3 className="text-xl font-black text-text-base">Về bài học này</h3>
                            </div>
                            <div className="bg-surface-highlight/30 p-5 rounded-2xl border border-border-color/50">
                                <p className="text-text-secondary text-base leading-relaxed font-medium">
                                    {video.description?.replace(/[📌📚]/g, '') || 'Bài học tập trung vào việc thành thạo thanh điệu và sử dụng các trợ từ lịch sự một cách chính xác trong hội thoại hàng ngày.'}
                                </p>
                            </div>
                        </div>
                        {/* Key Points List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex items-center gap-5 p-6 bg-surface-highlight/20 rounded-2xl border border-border-color/30 group hover:bg-surface-highlight/40 transition-colors shadow-sm">
                                <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Icon name="hearing" size="sm" />
                                </div>
                                <div>
                                    <h4 className="text-text-base font-black text-sm uppercase tracking-wide">Luyện nghe</h4>
                                    <p className="text-text-secondary text-xs font-bold mt-1 leading-relaxed">Nghe và hiểu người bản xứ nói</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-5 p-6 bg-surface-highlight/20 rounded-2xl border border-border-color/30 group hover:bg-surface-highlight/40 transition-colors shadow-sm">
                                <div className="size-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Icon name="menu_book" size="sm" />
                                </div>
                                <div>
                                    <h4 className="text-text-base font-black text-sm uppercase tracking-wide">Học từ vựng</h4>
                                    <p className="text-text-secondary text-xs font-bold mt-1 leading-relaxed">Từ vựng thực tế trong ngữ cảnh</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-5 p-6 bg-surface-highlight/20 rounded-2xl border border-border-color/30 group hover:bg-surface-highlight/40 transition-colors shadow-sm">
                                <div className="size-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Icon name="subtitles" size="sm" />
                                </div>
                                <div>
                                    <h4 className="text-text-base font-black text-sm uppercase tracking-wide">Phụ đề song ngữ</h4>
                                    <p className="text-text-secondary text-xs font-bold mt-1 leading-relaxed">Tiếng Trung, Pinyin và Tiếng Việt</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-5 p-6 bg-surface-highlight/20 rounded-2xl border border-border-color/30 group hover:bg-surface-highlight/40 transition-colors shadow-sm">
                                <div className="size-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Icon name="touch_app" size="sm" />
                                </div>
                                <div>
                                    <h4 className="text-text-base font-black text-sm uppercase tracking-wide">Phụ đề tương tác</h4>
                                    <p className="text-text-secondary text-xs font-bold mt-1 leading-relaxed">Click từ để xem nghĩa và lưu</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Vocabulary Cloud */}
                    <div className="col-span-1 lg:col-span-5 bg-surface-dark rounded-2xl p-6 md:p-8 border border-border-color flex flex-col shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Icon name="school" size="sm" />
                                </div>
                                <h3 className="text-xl font-black text-text-base">Từ vựng chính</h3>
                            </div>
                            <Link href={`/learn/${video.id}`} className="text-primary text-sm font-black hover:underline uppercase tracking-wider">
                                Xem tất cả
                            </Link>
                        </div>
                        <div className="flex flex-wrap content-start gap-3">
                            {vocabularyPreview.length > 0 ? vocabularyPreview.map((vocab, index) => (
                                <div
                                    key={index}
                                    className="group cursor-pointer flex items-center gap-3 pl-4 pr-3 py-2 bg-surface-highlight/30 hover:bg-surface-highlight border border-border-color/50 hover:border-primary/50 rounded-full transition-all shadow-sm"
                                >
                                    <span className="text-text-base font-black" lang="zh-CN">{vocab.hanzi}</span>
                                    {vocab.pinyin && (
                                        <span className="text-primary text-xs font-black font-pinyin tracking-tight">{vocab.pinyin}</span>
                                    )}
                                    <button className="size-6 rounded-full bg-black/20 group-hover:bg-primary group-hover:text-black flex items-center justify-center transition-colors ml-1">
                                        <Icon name="volume_up" size="sm" />
                                    </button>
                                </div>
                            )) : (
                                <p className="text-text-secondary text-sm">Chưa có từ vựng</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

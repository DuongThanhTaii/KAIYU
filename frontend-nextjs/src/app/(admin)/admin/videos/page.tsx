'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import FileUpload from '@/components/admin/FileUpload';
import { videoApi, type Video, type CreateVideoDto, type Subtitle } from '@/services/videoApi';
import { useAuth } from '@/contexts/AuthContext';
import YouTubePlayer, { type YouTubePlayerHandle } from '@/components/video/YouTubePlayer';
import { WordPopover, Icon } from '@/components/common';

// Initialize native Chinese word segmenter
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
    : null;

// Helper to group Pinyin syllables to match Hanzi word segmentation
const renderGroupedPinyin = (hanzi: string, pinyin: string, tokens?: any[]) => {
    if (!pinyin) return pinyin;

    // IF explicit tokens exist (admin re-segmented), use their pinyin directly
    if (tokens && tokens.length > 0) {
        return tokens.map(t => t.pinyin || '').join(' ').replace(/\s+/g, ' ').trim();
    }

    // Keep original spaces exactly as the admin entered them in the subtitle file!
    return pinyin;
};

export default function AdminVideosPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    });

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showSubtitlesModal, setShowSubtitlesModal] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preview state
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
    const [previewSubtitles, setPreviewSubtitles] = useState<Subtitle[]>([]);
    const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
    const [popoverWord, setPopoverWord] = useState<string | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const youtubePlayerRef = React.useRef<YouTubePlayerHandle>(null);
    const nativeVideoRef = React.useRef<HTMLVideoElement>(null);
    const subtitleListRef = React.useRef<HTMLDivElement>(null);
    const subtitleItemRefs = React.useRef<(HTMLDivElement | null)[]>([]);

    // Form state
    const [formData, setFormData] = useState<CreateVideoDto>({
        title: '',
        description: '',
        videoUrl: '',
        thumbnailUrl: '',
        durationSeconds: 0,
        hskLevel: 1,
        category: '',
    });
    const [fetchingYouTube, setFetchingYouTube] = useState(false);
    const [youtubeApiConfigured, setYoutubeApiConfigured] = useState<boolean | null>(null);

    // Subtitle editor state
    interface SubtitleLine {
        id: string;
        startTime: string;  // Format: "MM:SS" or "HH:MM:SS"
        endTime: string;
        hanzi: string;
        pinyin: string;
        meaningVi: string;
    }
    const [subtitleLines, setSubtitleLines] = useState<SubtitleLine[]>([]);
    const [loadingSubtitles, setLoadingSubtitles] = useState(false);
    const [savingSubtitles, setSavingSubtitles] = useState(false);

    // Auth check
    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated) router.replace('/login');
            else if (user?.role !== 'admin') router.replace('/dashboard');
        }
    }, [authLoading, isAuthenticated, user, router]);

    // Fetch videos
    const fetchVideos = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const response = await videoApi.getAllAdmin({ page, limit: 10 });
            setVideos(response.data);
            setPagination({
                page: response.meta.page,
                limit: response.meta.limit,
                total: response.meta.total,
                totalPages: response.meta.totalPages,
            });
        } catch (err) {
            console.error('Failed to fetch videos:', err);
            setError('Không thể tải danh sách video');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            fetchVideos();
        }
    }, [fetchVideos, isAuthenticated, user]);

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            videoUrl: '',
            thumbnailUrl: '',
            durationSeconds: 0,
            hskLevel: 1,
            category: '',
        });
        setEditingVideo(null);
    };

    // Fetch YouTube video info when URL is entered
    const fetchYouTubeInfo = async (url: string) => {
        // Check if it's a YouTube URL
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        if (!isYouTube) return;

        setFetchingYouTube(true);
        try {
            const response = await videoApi.getYouTubeInfo(url);
            setYoutubeApiConfigured(response.configured);

            if (response.success && response.data) {
                const { title, description, thumbnailUrl, durationSeconds } = response.data;

                // Only update empty fields to not overwrite user input
                setFormData(prev => ({
                    ...prev,
                    title: prev.title || title,
                    description: prev.description || description?.substring(0, 500) || '',
                    thumbnailUrl: prev.thumbnailUrl || thumbnailUrl || '',
                    durationSeconds: durationSeconds || prev.durationSeconds,
                }));
            }
        } catch (err) {
            console.error('Failed to fetch YouTube info:', err);
        } finally {
            setFetchingYouTube(false);
        }
    };

    const handleOpenCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const handleOpenEdit = (video: Video) => {
        setEditingVideo(video);
        setFormData({
            title: video.title,
            description: video.description || '',
            videoUrl: video.videoUrl,
            thumbnailUrl: video.thumbnailUrl || '',
            durationSeconds: video.durationSeconds,
            hskLevel: video.hskLevel,
            category: video.category || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            if (editingVideo) {
                await videoApi.update(editingVideo.id, formData);
            } else {
                await videoApi.create(formData);
            }
            setShowModal(false);
            resetForm();
            fetchVideos(pagination.page);
        } catch (err) {
            console.error('Failed to save video:', err);
            setError('Không thể lưu video');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await videoApi.remove(id);
            setShowDeleteConfirm(null);
            fetchVideos(pagination.page);
        } catch (err) {
            console.error('Failed to delete video:', err);
            setError('Không thể xóa video');
        }
    };

    const handlePublish = async (id: string) => {
        try {
            await videoApi.publish(id);
            fetchVideos(pagination.page);
        } catch (err) {
            console.error('Failed to publish video:', err);
            setError('Không thể xuất bản video');
        }
    };

    const formatSecondsToTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Fetch subtitles for preview
    useEffect(() => {
        if (showPreviewModal && previewVideo) {
            videoApi.getSubtitles(previewVideo.id)
                .then(setPreviewSubtitles)
                .catch(err => console.error('Failed to load preview subtitles:', err));
        } else {
            setPreviewSubtitles([]);
            setPreviewCurrentTime(0);
        }
    }, [showPreviewModal, previewVideo]);

    const handlePreviewTimeUpdate = (time: number) => {
        setPreviewCurrentTime(time);
    };

    const currentSubtitleIndex = previewSubtitles.findIndex(
        (sub) => previewCurrentTime >= sub.startTime && previewCurrentTime <= sub.endTime
    );

    const currentSubtitle = previewSubtitles[currentSubtitleIndex];

    const handleSeekTo = (seconds: number) => {
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(seconds);
        } else if (nativeVideoRef.current) {
            nativeVideoRef.current.currentTime = seconds;
        }
    };

    // Auto-scroll to current subtitle in the list
    useEffect(() => {
        if (showPreviewModal && currentSubtitleIndex >= 0 && subtitleItemRefs.current[currentSubtitleIndex]) {
            subtitleItemRefs.current[currentSubtitleIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentSubtitleIndex, showPreviewModal]);

    // Subtitle management functions
    const generateId = () => Math.random().toString(36).substring(2, 9);

    const parseTimeToSeconds = (timeStr: string): number => {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0;
    };


    const loadSubtitles = async (videoId: string) => {
        setLoadingSubtitles(true);
        try {
            const subtitles = await videoApi.getSubtitles(videoId);
            if (subtitles && subtitles.length > 0) {
                setSubtitleLines(subtitles.map((sub: any) => ({
                    id: sub.id,
                    startTime: formatSecondsToTime(sub.startTime),
                    endTime: formatSecondsToTime(sub.endTime),
                    hanzi: sub.hanzi || sub.textChinese || '',
                    pinyin: sub.pinyin || sub.textPinyin || '',
                    meaningVi: sub.meaningVi || sub.textVietnamese || '',
                })));
            } else {
                // Start with one empty line
                setSubtitleLines([{
                    id: generateId(),
                    startTime: '00:00',
                    endTime: '00:05',
                    hanzi: '',
                    pinyin: '',
                    meaningVi: '',
                }]);
            }
        } catch (err) {
            console.error('Failed to load subtitles:', err);
            // Start with one empty line on error
            setSubtitleLines([{
                id: generateId(),
                startTime: '00:00',
                endTime: '00:05',
                hanzi: '',
                pinyin: '',
                meaningVi: '',
            }]);
        } finally {
            setLoadingSubtitles(false);
        }
    };

    const openSubtitlesModal = (videoId: string) => {
        setShowSubtitlesModal(videoId);
        loadSubtitles(videoId);
    };

    const addSubtitleLine = () => {
        const lastLine = subtitleLines[subtitleLines.length - 1];
        const newStartTime = lastLine ? lastLine.endTime : '00:00';
        const newEndSeconds = parseTimeToSeconds(newStartTime) + 5;

        setSubtitleLines([...subtitleLines, {
            id: generateId(),
            startTime: newStartTime,
            endTime: formatSecondsToTime(newEndSeconds),
            hanzi: '',
            pinyin: '',
            meaningVi: '',
        }]);
    };

    const removeSubtitleLine = (id: string) => {
        if (subtitleLines.length > 1) {
            setSubtitleLines(subtitleLines.filter(line => line.id !== id));
        }
    };

    const updateSubtitleLine = (id: string, field: keyof SubtitleLine, value: string) => {
        setSubtitleLines(subtitleLines.map(line =>
            line.id === id ? { ...line, [field]: value } : line
        ));
    };

    const parseSrtContent = (content: string) => {
        // Normalize line endings (Windows CRLF to Unix LF)
        const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const blocks = normalizedContent.trim().split(/\n\n+/);
        const parsed: SubtitleLine[] = [];

        // Language detection helpers
        const isChinese = (text: string) => /[\u4e00-\u9fff]/.test(text);
        const isPinyin = (text: string) => {
            // Pinyin has tone marks: ā á ǎ à ē é ě è ī í ǐ ì ō ó ǒ ò ū ú ǔ ù ǖ ǘ ǚ ǜ
            return /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(text) && !isChinese(text);
        };
        const isVietnamese = (text: string) => {
            // Vietnamese specific characters: ă ơ ư đ and tone marks combined
            return /[ăơưđĂƠƯĐ]/.test(text) ||
                (/[àáảãạầấẩẫậằắẳẵặèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/.test(text) && !isPinyin(text));
        };

        // Detect language type
        const detectLanguage = (text: string): 'chinese' | 'pinyin' | 'vietnamese' | 'unknown' => {
            if (isChinese(text)) return 'chinese';
            if (isPinyin(text)) return 'pinyin';
            if (isVietnamese(text)) return 'vietnamese';
            return 'unknown';
        };

        for (const block of blocks) {
            const lines = block.split('\n');
            if (lines.length >= 2) {
                const timeLineIndex = lines.findIndex(l => l.includes('-->'));
                if (timeLineIndex >= 0) {
                    const timeLine = lines[timeLineIndex];
                    const timeMatch = timeLine.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:,\d+)?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:,\d+)?)/);

                    if (timeMatch) {
                        const parseTimeStr = (timeStr: string): string => {
                            const cleaned = timeStr.replace(',', '.').split('.')[0];
                            const parts = cleaned.split(':');
                            if (parts.length === 3) {
                                const hours = parseInt(parts[0]);
                                const mins = parseInt(parts[1]) + (hours * 60);
                                return `${mins.toString().padStart(2, '0')}:${parts[2]}`;
                            }
                            return cleaned;
                        };

                        const startTime = parseTimeStr(timeMatch[1]);
                        const endTime = parseTimeStr(timeMatch[2]);
                        const textLines = lines.slice(timeLineIndex + 1).filter(l => l.trim());

                        let hanzi = '';
                        let pinyin = '';
                        let meaningVi = '';

                        if (textLines.length === 1) {
                            // Single line - check for pipe separator or assign based on language
                            const parts = textLines[0].split('|').map(p => p.trim());
                            if (parts.length >= 3) {
                                hanzi = parts[0];
                                pinyin = parts[1];
                                meaningVi = parts[2];
                            } else if (parts.length === 2) {
                                hanzi = parts[0];
                                meaningVi = parts[1];
                            } else {
                                // Single text - detect language
                                const lang = detectLanguage(textLines[0]);
                                if (lang === 'chinese') hanzi = textLines[0].trim();
                                else if (lang === 'pinyin') pinyin = textLines[0].trim();
                                else if (lang === 'vietnamese') meaningVi = textLines[0].trim();
                                else hanzi = textLines[0].trim(); // Default to hanzi
                            }
                        } else {
                            // Multiple lines - detect each line's language
                            for (const line of textLines) {
                                const trimmed = line.trim();
                                const lang = detectLanguage(trimmed);

                                if (lang === 'chinese' && !hanzi) {
                                    hanzi = trimmed;
                                } else if (lang === 'pinyin' && !pinyin) {
                                    pinyin = trimmed;
                                } else if (lang === 'vietnamese' && !meaningVi) {
                                    meaningVi = trimmed;
                                } else if (!hanzi) {
                                    // First unknown line goes to hanzi
                                    hanzi = trimmed;
                                } else if (!meaningVi) {
                                    // Second unknown goes to vietnamese
                                    meaningVi = trimmed;
                                } else if (!pinyin) {
                                    // Third unknown goes to pinyin
                                    pinyin = trimmed;
                                }
                            }
                        }

                        if (hanzi || pinyin || meaningVi) {
                            parsed.push({
                                id: generateId(),
                                startTime,
                                endTime,
                                hanzi,
                                pinyin,
                                meaningVi,
                            });
                        }
                    }
                }
            }
        }

        if (parsed.length > 0) {
            setSubtitleLines(parsed);
        }
    };

    const handleSaveSubtitles = async () => {
        if (!showSubtitlesModal) return;

        setSavingSubtitles(true);
        try {
            // Convert to SRT-like format for the API
            const srtContent = subtitleLines
                .filter(line => line.hanzi.trim())
                .map((line, index) => {
                    const startSeconds = parseTimeToSeconds(line.startTime);
                    const endSeconds = parseTimeToSeconds(line.endTime);
                    return `${index + 1}\n${formatSecondsToTime(startSeconds)},000 --> ${formatSecondsToTime(endSeconds)},000\n${line.hanzi}${line.pinyin ? ` | ${line.pinyin}` : ''}${line.meaningVi ? ` | ${line.meaningVi}` : ''}`;
                })
                .join('\n\n');

            await videoApi.uploadSubtitles(showSubtitlesModal, srtContent, 'subtitles.srt');

            setShowSubtitlesModal(null);
            fetchVideos(pagination.page);
        } catch (err) {
            console.error('Failed to save subtitles:', err);
            setError('Không thể lưu phụ đề');
        } finally {
            setSavingSubtitles(false);
        }
    };

    // Show loading while checking auth
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const columns = [
        {
            key: 'thumbnailUrl',
            header: 'Thumbnail',
            width: '80px',
            render: (video: Video) => (
                <div className="relative group block overflow-hidden rounded-lg">
                    <img
                        src={video.thumbnailUrl || 'https://via.placeholder.com/80x45?text=No+Image'}
                        alt={video.title}
                        className="w-20 h-12 object-cover transition-transform group-hover:scale-110"
                    />
                </div>
            ),
        },
        {
            key: 'title',
            header: 'Tiêu đề',
            sortable: true,
            render: (video: Video) => (
                <div>
                    <p className="font-medium text-text-base">{video.title}</p>
                    <p className="text-xs text-text-secondary line-clamp-1">{video.description}</p>
                </div>
            ),
        },
        {
            key: 'hskLevel',
            header: 'HSK',
            width: '75px',
            render: (video: Video) => (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-primary/20 text-primary whitespace-nowrap">
                    HSK {video.hskLevel}
                </span>
            ),
        },
        {
            key: 'durationSeconds',
            header: 'Thời lượng',
            width: '80px',
            render: (video: Video) => (
                <span className="text-text-secondary">{formatSecondsToTime(video.durationSeconds)}</span>
            ),
        },
        {
            key: 'viewCount',
            header: 'Lượt xem',
            width: '80px',
            render: (video: Video) => (
                <span className="text-text-secondary">{video.viewCount.toLocaleString()}</span>
            ),
        },
        {
            key: '_count.subtitles',
            header: 'Phụ đề',
            width: '70px',
            render: (video: Video) => (
                <span className={video._count?.subtitles ? 'text-primary' : 'text-red-400'}>
                    {video._count?.subtitles || 0}
                </span>
            ),
        },
        {
            key: 'isPublished',
            header: 'Trạng thái',
            width: '110px',
            render: (video: Video) => (
                <span
                    className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${video.isPublished
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                >
                    {video.isPublished ? 'Đã xuất bản' : 'Nháp'}
                </span>
            ),
        },
    ];

    const actions = (video: Video) => (
        <>
            {!video.isPublished && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePublish(video.id);
                    }}
                    className="justify-center flex p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors"
                    title="Xuất bản"
                >
                    <Icon name="publish" className="text-lg" />
                </button>
            )}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    openSubtitlesModal(video.id);
                }}
                className="justify-center flex p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                title="Phụ đề"
            >
                <Icon name="subtitles" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/admin/quizzes?videoId=${video.id}`);
                }}
                className="justify-center flex p-1.5 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors"
                title="Bài tập"
            >
                <Icon name="quiz" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(video);
                }}
                className="justify-center flex p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                title="Sửa"
            >
                <Icon name="edit" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(video.id);
                }}
                className="justify-center flex p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                title="Xóa"
            >
                <Icon name="delete" className="text-lg" />
            </button>
        </>
    );

    return (
        <AdminLayout
            title="Quản lý Video"
            actions={
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
                >
                    <Icon name="add" />
                    Thêm Video
                </button>
            }
        >
            {/* Error Message */}
            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                    <Icon
                        name="search"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                        type="text"
                        placeholder="Tìm kiếm video..."
                        className="w-full pl-12 pr-4 py-3 bg-surface-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                    />
                </div>
                <select className="px-4 py-3 bg-surface-dark border border-border-color rounded-xl text-text-base focus:outline-none focus:border-amber-500 transition-colors">
                    <option value="">Tất cả HSK</option>
                    <option value="1">HSK 1</option>
                    <option value="2">HSK 2</option>
                    <option value="3">HSK 3</option>
                    <option value="4">HSK 4</option>
                    <option value="5">HSK 5</option>
                    <option value="6">HSK 6</option>
                </select>
                <select className="px-4 py-3 bg-surface-dark border border-border-color rounded-xl text-text-base focus:outline-none focus:border-amber-500 transition-colors">
                    <option value="">Tất cả trạng thái</option>
                    <option value="true">Đã xuất bản</option>
                    <option value="false">Nháp</option>
                </select>
            </div>

            {/* Data Table */}
            <DataTable
                data={videos}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => fetchVideos(page)}
                onRowClick={(video: Video) => {
                    setPreviewVideo(video);
                    setShowPreviewModal(true);
                }}
                actions={actions}
                emptyMessage="Chưa có video nào"
            />

            {/* Video Preview Modal */}
            <Modal
                isOpen={showPreviewModal}
                onClose={() => {
                    setShowPreviewModal(false);
                    setPreviewVideo(null);
                    setPopoverWord(null);
                    setSelectedWord(null);
                }}
                title={previewVideo?.title || 'Xem Video'}
                size="2xl"
                compact={true}
            >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[82vh]">
                    {/* Left Column: Video & Active Subtitle (8/12) */}
                    <div className="lg:col-span-8 flex flex-col gap-4 overflow-visible">
                        <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-border-color shrink-0">
                            {previewVideo && (
                                videoApi.isYouTubeUrl(previewVideo.videoUrl) ? (
                                    <YouTubePlayer 
                                        ref={youtubePlayerRef}
                                        videoId={videoApi.getYouTubeId(previewVideo.videoUrl) || ''} 
                                        onTimeUpdate={handlePreviewTimeUpdate}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <video 
                                        ref={nativeVideoRef}
                                        src={previewVideo.videoUrl} 
                                        controls 
                                        className="w-full h-full"
                                        autoPlay
                                        onTimeUpdate={(e) => handlePreviewTimeUpdate(e.currentTarget.currentTime)}
                                    />
                                )
                            )}
                        </div>

                        {/* Interactive Subtitle Box - Current Sentence */}
                        <div className="bg-surface-dark rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1 border border-border-color shadow-lg min-h-[130px] shrink-0">
                            {currentSubtitle ? (
                                <>
                                    {/* Pinyin Tier */}
                                    {currentSubtitle.pinyin && (
                                        <p className="text-text-secondary text-sm font-medium tracking-tight font-pinyin">
                                            {renderGroupedPinyin(currentSubtitle.hanzi || '', currentSubtitle.pinyin, currentSubtitle.tokens)}
                                        </p>
                                    )}

                                     {/* Chinese Hanzi Tier */}
                                    <p className="text-text-base text-2xl font-bold tracking-tight leading-normal flex flex-wrap justify-center font-chinese select-none" lang="zh-CN">
                                        {(currentSubtitle.tokens && currentSubtitle.tokens.length > 0 
                                            ? currentSubtitle.tokens.map(t => ({ segment: t.hanzi }))
                                            : (segmenter ? Array.from(segmenter.segment(currentSubtitle.hanzi || '')) : (currentSubtitle.hanzi || '').split('').map(c => ({ segment: c })))
                                        ).map((seg: { segment: string }, i: number) => {
                                            const word = seg.segment;
                                            if (!word.trim()) {
                                                return <span key={i}>{word}</span>;
                                            }
                                            return (
                                                <span
                                                    key={i}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                                                        setPopoverPosition({ x: rect.left + rect.width / 2, y: rect.top });
                                                        setPopoverWord(word);
                                                        setSelectedWord(word);
                                                    }}
                                                    className={`cursor-pointer transition-all hover:text-primary hover:underline hover:decoration-2 hover:underline-offset-4 ${selectedWord === word
                                                        ? "text-primary underline decoration-2 underline-offset-4"
                                                        : ""
                                                        }`}
                                                >
                                                    {word}
                                                </span>
                                            );
                                        })}
                                    </p>

                                    {/* Vietnamese Tier */}
                                    {currentSubtitle.meaningVi && (
                                        <p className="text-text-secondary text-lg font-medium mt-1">
                                            {currentSubtitle.meaningVi}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-text-secondary py-4 italic">Đang chờ phụ đề...</p>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Full Subtitle List (4/12) */}
                    <div className="lg:col-span-4 flex flex-col bg-background-dark/50 rounded-2xl border border-border-color overflow-hidden">
                        <div className="p-3 border-b border-border-color bg-surface-dark flex items-center gap-2">
                            <Icon name="subtitles" size="sm" className="text-primary" />
                            <h3 className="text-sm font-bold text-text-base uppercase tracking-wider">Danh sách phụ đề</h3>
                        </div>
                        <div 
                            ref={subtitleListRef}
                            className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col gap-1.5"
                        >
                            {previewSubtitles.length > 0 ? (
                                previewSubtitles.map((sub, index) => (
                                    <div
                                        key={index}
                                        ref={el => { subtitleItemRefs.current[index] = el; }}
                                        onClick={() => handleSeekTo(sub.startTime)}
                                        className={`p-3 rounded-xl transition-all cursor-pointer border-l-3 group shrink-0 ${currentSubtitleIndex === index
                                            ? "bg-surface-highlight/40 border-l-primary shadow-sm"
                                            : "hover:bg-surface-highlight/20 border-l-transparent"
                                            }`}
                                    >
                                        <div className="flex justify-between items-center mb-1 text-[10px] font-mono">
                                            <span className={currentSubtitleIndex === index ? 'text-primary font-bold' : 'text-text-secondary/50'}>
                                                {formatSecondsToTime(sub.startTime)}
                                            </span>
                                            {currentSubtitleIndex === index && (
                                                <div className="size-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(76,223,32,0.8)]" />
                                            )}
                                        </div>
                                        <p className={`font-chinese leading-relaxed ${currentSubtitleIndex === index
                                            ? 'text-text-base text-base font-bold'
                                            : 'text-text-secondary group-hover:text-text-base text-sm'
                                            }`} lang="zh-CN">
                                            {sub.hanzi}
                                        </p>
                                        {sub.meaningVi && (
                                            <p className={`text-xs mt-0.5 leading-snug line-clamp-2 ${currentSubtitleIndex === index
                                                ? 'text-white/60'
                                                : 'text-text-secondary/40'
                                                }`}>
                                                {sub.meaningVi}
                                            </p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-text-secondary/40 gap-2">
                                    <Icon name="subtitles_off" size="lg" />
                                    <p className="text-xs italic">Chưa có phụ đề</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dictionary Popover */}
                {popoverWord && (
                    <WordPopover
                        word={popoverWord}
                        position={popoverPosition}
                        sourceVideoId={previewVideo?.id}
                        sourceTimestamp={previewCurrentTime}
                        sourceSentence={currentSubtitle?.hanzi}
                        sourcePinyin={currentSubtitle?.pinyin}
                        sourceSubtitle={currentSubtitle}
                        videoUrl={previewVideo?.videoUrl}
                        onSubtitlesUpdated={() => {
                            if (previewVideo) {
                                videoApi.getSubtitles(previewVideo.id).then(setPreviewSubtitles);
                            }
                        }}
                        onClose={() => {
                            setPopoverWord(null);
                            setSelectedWord(null);
                        }}
                    />
                )}
            </Modal>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingVideo ? 'Chỉnh sửa Video' : 'Thêm Video mới'}
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Đang lưu...' : editingVideo ? 'Cập nhật' : 'Thêm Video'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Tiêu đề <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="Nhập tiêu đề video"
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
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors resize-none"
                            placeholder="Nhập mô tả video"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-text-secondary">
                                Video URL {fetchingYouTube && <span className="text-amber-400 ml-2">⏳ Đang lấy thông tin...</span>}
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="url"
                                    value={formData.videoUrl}
                                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                    placeholder="https://youtube.com/watch?v=... hoặc link video"
                                    className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <Icon
                                    name="link"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary"
                                />
                            </div>
                            {(formData.videoUrl.includes('youtube.com') || formData.videoUrl.includes('youtu.be')) && (
                                <button
                                    type="button"
                                    onClick={() => fetchYouTubeInfo(formData.videoUrl)}
                                    disabled={fetchingYouTube}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Icon name="smart_display" />
                                    Tự động điền
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-text-secondary">
                            {youtubeApiConfigured === false
                                ? '⚠️ YouTube API chưa được cấu hình. Vui lòng nhập thủ công.'
                                : 'Nhập link YouTube và nhấn "Tự động điền" để lấy tiêu đề, thumbnail, thời lượng'}
                        </p>
                    </div>

                    <FileUpload
                        label="Video File (tuỳ chọn)"
                        accept="video/*"
                        value=""
                        onChange={(url) => setFormData({ ...formData, videoUrl: url })}
                        onDurationDetected={(duration) => setFormData(prev => ({ ...prev, durationSeconds: duration }))}
                        placeholder="Hoặc upload file video trực tiếp"
                        hint="Upload file MP4, WebM (tự động lấy thời lượng)"
                        showModeToggle={false}
                        defaultMode="file"
                    />

                    <FileUpload
                        label="Thumbnail"
                        accept="image/*"
                        value={formData.thumbnailUrl}
                        onChange={(url) => setFormData({ ...formData, thumbnailUrl: url })}
                        placeholder="https://example.com/image.jpg"
                        hint="Kích thước khuyến nghị: 1280x720px"
                        showModeToggle={true}
                        maxSizeMB={5}
                    />

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                HSK Level
                            </label>
                            <select
                                value={formData.hskLevel}
                                onChange={(e) => setFormData({ ...formData, hskLevel: Number(e.target.value) })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base focus:outline-none focus:border-amber-500 transition-colors"
                            >
                                {[1, 2, 3, 4, 5, 6].map((level) => (
                                    <option key={level} value={level}>HSK {level}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Chủ đề
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base focus:outline-none focus:border-amber-500 transition-colors"
                            >
                                <option value="">Chọn chủ đề</option>
                                <option value="Hội thoại">Hội thoại</option>
                                <option value="Tin tức">Tin tức</option>
                                <option value="Phim ngắn">Phim ngắn</option>
                                <option value="Âm nhạc">Âm nhạc</option>
                                <option value="Du lịch">Du lịch</option>
                                <option value="Ẩm thực">Ẩm thực</option>
                                <option value="Văn hóa">Văn hóa</option>
                                <option value="Kinh doanh">Kinh doanh</option>
                                <option value="Giáo dục">Giáo dục</option>
                                <option value="Podcast">Podcast</option>
                                <option value="Hài kịch">Hài kịch</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Thời lượng (giây) {(formData.durationSeconds ?? 0) > 0 && <span className="text-green-400 text-xs">✓ Tự động</span>}
                            </label>
                            <input
                                type="number"
                                value={formData.durationSeconds}
                                onChange={(e) => setFormData({ ...formData, durationSeconds: Number(e.target.value) })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                                placeholder="Tự động khi upload file"
                                min="0"
                            />
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
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
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
                    Bạn có chắc chắn muốn xóa video này? Hành động này không thể hoàn tác.
                </p>
            </Modal>

            {/* Subtitles Modal */}
            <Modal
                isOpen={!!showSubtitlesModal}
                onClose={() => setShowSubtitlesModal(null)}
                title="Quản lý Phụ đề"
                size="xl"
                footer={
                    <>
                        <button
                            onClick={() => setShowSubtitlesModal(null)}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSaveSubtitles}
                            disabled={savingSubtitles}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50"
                        >
                            {savingSubtitles ? 'Đang lưu...' : 'Lưu Phụ đề'}
                        </button>
                    </>
                }
            >
                {loadingSubtitles ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        <span className="ml-3 text-text-secondary">Đang tải phụ đề...</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Import from file */}
                        <div className="p-4 bg-background-dark rounded-xl">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Import từ file SRT
                            </label>
                            <input
                                type="file"
                                accept=".srt,.vtt"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            const content = event.target?.result as string;
                                            parseSrtContent(content);
                                        };
                                        reader.readAsText(file);
                                    }
                                }}
                                className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                            />
                            <p className="mt-2 text-xs text-text-secondary">
                                Định dạng hỗ trợ: SRT, VTT. Có thể dùng format: Hanzi | Pinyin | Tiếng Việt
                            </p>
                        </div>

                        {/* Manual editor */}
                        <div className="border-t border-border-color pt-4">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-medium text-text-base">
                                    Phụ đề ({subtitleLines.length} dòng)
                                </p>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="px-2 py-1 bg-surface-dark rounded">Bắt đầu</span>
                                    <span className="px-2 py-1 bg-surface-dark rounded">Kết thúc</span>
                                    <span className="px-2 py-1 bg-surface-dark rounded">Tiếng Trung</span>
                                    <span className="px-2 py-1 bg-surface-dark rounded">Pinyin</span>
                                    <span className="px-2 py-1 bg-surface-dark rounded">Tiếng Việt</span>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                {subtitleLines.map((line, index) => (
                                    <div key={line.id} className="flex items-center gap-2 p-3 bg-background-dark rounded-lg group">
                                        <span className="w-6 text-xs text-text-secondary text-center">{index + 1}</span>
                                        <input
                                            type="text"
                                            value={line.startTime}
                                            onChange={(e) => updateSubtitleLine(line.id, 'startTime', e.target.value)}
                                            placeholder="00:00"
                                            className="w-16 px-2 py-1.5 bg-surface-dark border border-border-color rounded text-sm text-text-base text-center focus:border-primary focus:outline-none"
                                        />
                                        <span className="text-text-secondary">→</span>
                                        <input
                                            type="text"
                                            value={line.endTime}
                                            onChange={(e) => updateSubtitleLine(line.id, 'endTime', e.target.value)}
                                            placeholder="00:05"
                                            className="w-16 px-2 py-1.5 bg-surface-dark border border-border-color rounded text-sm text-text-base text-center focus:border-primary focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={line.hanzi}
                                            onChange={(e) => updateSubtitleLine(line.id, 'hanzi', e.target.value)}
                                            placeholder="你好"
                                            className="flex-1 min-w-[100px] px-2 py-1.5 bg-surface-dark border border-border-color rounded text-sm text-text-base focus:border-primary focus:outline-none font-chinese"
                                        />
                                        <input
                                            type="text"
                                            value={line.pinyin}
                                            onChange={(e) => updateSubtitleLine(line.id, 'pinyin', e.target.value)}
                                            placeholder="nǐ hǎo"
                                            className="flex-1 min-w-[80px] px-2 py-1.5 bg-surface-dark border border-border-color rounded text-sm text-text-base focus:border-primary focus:outline-none font-pinyin"
                                        />
                                        <input
                                            type="text"
                                            value={line.meaningVi}
                                            onChange={(e) => updateSubtitleLine(line.id, 'meaningVi', e.target.value)}
                                            placeholder="Xin chào"
                                            className="flex-1 min-w-[80px] px-2 py-1.5 bg-surface-dark border border-border-color rounded text-sm text-text-base focus:border-primary focus:outline-none"
                                        />
                                        <button
                                            onClick={() => removeSubtitleLine(line.id)}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            disabled={subtitleLines.length <= 1}
                                        >
                                            <Icon name="close" className="text-lg" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={addSubtitleLine}
                                className="mt-3 flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                            >
                                <Icon name="add" /> Thêm dòng phụ đề
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </AdminLayout>
    );
}

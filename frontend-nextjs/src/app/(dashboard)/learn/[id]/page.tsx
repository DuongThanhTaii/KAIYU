"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Icon, Badge, Button, Card, WordPopover } from "@/components/common";
import SpeakerButton from "@/components/common/SpeakerButton";
import NotificationDropdown from "@/components/common/NotificationDropdown";
import { videoApi, type Video, type Subtitle } from "@/services/videoApi";
import { quizzesApi, type VideoQuiz } from "@/services/quizzesApi";
import { userVocabularyApi, type UserVocabulary } from "@/services/userVocabularyApi";
import { videoNotesApi, type VideoNote } from "@/services/videoNotesApi";
import { progressApi } from "@/services/progressApi";
import { watchTimeTracker } from "@/services/watchTimeTracker";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/video/YouTubePlayer";
import ShadowModeOverlay from "@/components/common/ShadowModeOverlay";
import { renderGroupedPinyin } from "@/utils/chinese";

// Helper function to extract YouTube video ID
const getYouTubeId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

// Format seconds to MM:SS
const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

type SidebarTab = 'subtitles' | 'vocabulary' | 'notes';


const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayerPage() {
    const router = useRouter();
    const params = useParams();
    const videoId = params.id as string;
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const [video, setVideo] = useState<Video | null>(null);
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [quiz, setQuiz] = useState<VideoQuiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [savedPosition, setSavedPosition] = useState<number>(0); // Saved watch position in seconds
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [wasPlayingBeforePopover, setWasPlayingBeforePopover] = useState(false);
    const youtubePlayerRef = useRef<YouTubePlayerHandle>(null);
    const nativeVideoRef = useRef<HTMLVideoElement>(null);
    const subtitleListRef = useRef<HTMLDivElement>(null);
    const subtitleItemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);

    // Intl Segmenter for Chinese word segmentation
    const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter 
        ? new (Intl as any).Segmenter('zh-CN', { granularity: 'word' }) 
        : null;

    // Sidebar tab state
    const [activeTab, setActiveTab] = useState<SidebarTab>('subtitles');

    // Vocabulary state
    const [savedVocabulary, setSavedVocabulary] = useState<UserVocabulary[]>([]);
    const [vocabLoading, setVocabLoading] = useState(false);

    // Notes state
    const [notes, setNotes] = useState<VideoNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');

    // Popover state
    const [popoverWord, setPopoverWord] = useState<string | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const [popoverSubtitle, setPopoverSubtitle] = useState<any>(null);

    // Multi-character selection state (Legacy - removed drag dependencies since words are now natively grouped via Segmenter)

    // Playback control state
    const [isLoopMode, setIsLoopMode] = useState(false);
    const [loopedSubtitle, setLoopedSubtitle] = useState<{ startTime: number; endTime: number } | null>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isShadowingMode, setIsShadowingMode] = useState(false);
    const [showShadowPrompt, setShowShadowPrompt] = useState(false);
    const [shadowSubtitleIndex, setShadowSubtitleIndex] = useState<number | null>(null);
    const lastSubtitleEndTimeRef = useRef<number>(0);

    // View counting state - track if view has been recorded this session
    const viewRecordedRef = useRef(false);

    // Record view when user watches 40+ seconds
    useEffect(() => {
        if (currentTime >= 40 && !viewRecordedRef.current && videoId) {
            viewRecordedRef.current = true;
            videoApi.recordView(videoId, currentTime)
                .then(res => {
                    if (res.counted) {
                        console.log('View recorded successfully');
                    }
                })
                .catch(err => console.error('Failed to record view:', err));
        }
    }, [currentTime, videoId]);

    // Handle time update from YouTube player with loop support
    const handleTimeUpdate = useCallback((time: number) => {
        setCurrentTime(time);

        // Loop mode: if we have a looped subtitle and passed its end, seek back
        if (isLoopMode && loopedSubtitle) {
            const endTime = Number(loopedSubtitle.endTime);
            const startTime = Number(loopedSubtitle.startTime);
            // Check if we've passed the end of the looped subtitle
            if (time > endTime + 0.2) {
                console.log('Loop triggered:', { time, endTime, startTime });
                if (youtubePlayerRef.current) {
                    youtubePlayerRef.current.seekTo(startTime);
                } else if (nativeVideoRef.current) {
                    nativeVideoRef.current.currentTime = startTime;
                }
            }
        }

        // Shadow mode: pause when subtitle ends and show practice prompt
        if (isShadowingMode && !showShadowPrompt && subtitles.length > 0) {
            // Find current subtitle
            const currentSubIndex = subtitles.findIndex(sub =>
                time >= Number(sub.startTime) && time <= Number(sub.endTime)
            );

            if (currentSubIndex !== -1) {
                const currentSub = subtitles[currentSubIndex];
                const endTime = Number(currentSub.endTime);

                // Check if we just passed the end of the current subtitle
                if (time > endTime && lastSubtitleEndTimeRef.current !== endTime) {
                    lastSubtitleEndTimeRef.current = endTime;

                    // Pause video and show shadow prompt
                    if (youtubePlayerRef.current) {
                        youtubePlayerRef.current.pause();
                    } else if (nativeVideoRef.current) {
                        nativeVideoRef.current.pause();
                    }

                    setShadowSubtitleIndex(currentSubIndex);
                    setShowShadowPrompt(true);
                }
            }
        }
    }, [isLoopMode, loopedSubtitle, isShadowingMode, showShadowPrompt, subtitles]);

    // Handle seeking to a specific time (for subtitle click)
    const handleSeekTo = useCallback((seconds: number) => {
        setCurrentTime(seconds);
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(seconds);
        } else if (nativeVideoRef.current) {
            nativeVideoRef.current.currentTime = seconds;
        }
    }, []);

    // Playback control for shortcuts and internal logic
    const handlePause = useCallback(() => {
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.pause();
        } else if (nativeVideoRef.current) {
            nativeVideoRef.current.pause();
        }
    }, []);

    const handlePlay = useCallback(() => {
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.play();
        } else if (nativeVideoRef.current) {
            nativeVideoRef.current.play();
        }
    }, []);

    // Keyboard shortcuts for video control
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input or textarea
            const focusedElement = document.activeElement;
            const isTyping = focusedElement instanceof HTMLInputElement || 
                             focusedElement instanceof HTMLTextAreaElement ||
                             (focusedElement as HTMLElement)?.isContentEditable;
            
            if (isTyping) return;

            if (e.key === ' ') {
                e.preventDefault(); // Prevent page scrolling
                if (youtubePlayerRef.current) {
                    if (youtubePlayerRef.current.isPlaying()) {
                        youtubePlayerRef.current.pause();
                    } else {
                        youtubePlayerRef.current.play();
                    }
                } else if (nativeVideoRef.current) {
                    if (nativeVideoRef.current.paused) {
                        nativeVideoRef.current.play();
                    } else {
                        nativeVideoRef.current.pause();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Speed slider popup state
    const [showSpeedPopup, setShowSpeedPopup] = useState(false);
    const speedPopupRef = useRef<HTMLDivElement>(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (speedPopupRef.current && !speedPopupRef.current.contains(e.target as Node)) {
                setShowSpeedPopup(false);
            }
        };
        if (showSpeedPopup) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSpeedPopup]);

    // Set playback speed directly
    const setSpeed = useCallback((newSpeed: number) => {
        setPlaybackSpeed(newSpeed);
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.setPlaybackRate(newSpeed);
        } else if (nativeVideoRef.current) {
            nativeVideoRef.current.playbackRate = newSpeed;
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace("/login");
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchVideo = async () => {
            try {
                const [videoData, subtitleData, quizData, progressData] = await Promise.all([
                    videoApi.getById(videoId),
                    videoApi.getSubtitles(videoId),
                    quizzesApi.getByVideoId(videoId),
                    progressApi.getVideoProgress().catch(() => []),
                ]);
                setVideo(videoData);
                setSubtitles(subtitleData);
                // Only set quiz if it's published
                if (quizData?.isPublished) {
                    setQuiz(quizData);
                }
                // Get saved position for this video
                const thisVideoProgress = progressData.find((p: { videoId: string; lastPositionSeconds: number }) => p.videoId === videoId);
                if (thisVideoProgress && thisVideoProgress.lastPositionSeconds && thisVideoProgress.lastPositionSeconds > 0) {
                    setSavedPosition(thisVideoProgress.lastPositionSeconds);
                }
            } catch (error) {
                console.error("Failed to fetch video:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (isAuthenticated && videoId) {
            fetchVideo();
        }
    }, [isAuthenticated, videoId]);

    // Fetch vocabulary when tab changes to vocabulary
    useEffect(() => {
        const fetchVocabulary = async () => {
            if (activeTab !== 'vocabulary') return;
            setVocabLoading(true);
            try {
                const result = await userVocabularyApi.getAll({ sourceVideoId: videoId, limit: 100 });
                setSavedVocabulary(result.data);
            } catch (error) {
                console.error("Failed to fetch vocabulary:", error);
            } finally {
                setVocabLoading(false);
            }
        };
        fetchVocabulary();
    }, [activeTab, videoId]);

    // Fetch notes when tab changes to notes
    useEffect(() => {
        const fetchNotes = async () => {
            if (activeTab !== 'notes') return;
            setNotesLoading(true);
            try {
                const result = await videoNotesApi.getByVideoId(videoId);
                setNotes(result);
            } catch (error) {
                console.error("Failed to fetch notes:", error);
            } finally {
                setNotesLoading(false);
            }
        };
        fetchNotes();
    }, [activeTab, videoId]);

    // Save video progress periodically
    useEffect(() => {
        if (!video || !videoId) return;

        const saveProgress = async () => {
            const totalDuration = video.durationSeconds || 1;
            const progressPercent = Math.min(100, (currentTime / totalDuration) * 100);

            if (currentTime > 5) { // Only save if watched more than 5 seconds
                try {
                    await progressApi.updateVideoProgress(videoId, {
                        progressPercent: Math.round(progressPercent),
                        lastPositionSeconds: Math.floor(currentTime),
                    });
                } catch (error) {
                    console.error('Failed to save progress:', error);
                }
            }
        };

        // Save every 10 seconds
        const interval = setInterval(saveProgress, 10000);

        // Save on page unload
        const handleBeforeUnload = () => {
            saveProgress();
            watchTimeTracker.stopTracking();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            saveProgress(); // Save when component unmounts
            watchTimeTracker.stopTracking(); // Stop watch time tracking
        };
    }, [video, videoId, currentTime]);

    // Handle adding a new note
    const handleAddNote = async () => {
        if (!newNoteContent.trim()) return;
        try {
            const note = await videoNotesApi.create({
                videoId,
                timestampSec: currentTime,
                content: newNoteContent.trim(),
            });
            setNotes(prev => [...prev, note].sort((a, b) => a.timestampSec - b.timestampSec));
            setNewNoteContent('');
        } catch (error) {
            console.error("Failed to add note:", error);
        }
    };

    // Handle updating a note
    const handleUpdateNote = async (noteId: string) => {
        if (!editingContent.trim()) return;
        try {
            const updated = await videoNotesApi.update(noteId, { content: editingContent.trim() });
            setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
            setEditingNoteId(null);
            setEditingContent('');
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    };

    // Handle deleting a note
    const handleDeleteNote = async (noteId: string) => {
        try {
            await videoNotesApi.delete(noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (error) {
            console.error("Failed to delete note:", error);
        }
    };

    // Handle removing vocabulary
    const handleRemoveVocabulary = async (vocabId: string) => {
        try {
            await userVocabularyApi.remove(vocabId);
            setSavedVocabulary(prev => prev.filter(v => v.id !== vocabId));
        } catch (error) {
            console.error("Failed to remove vocabulary:", error);
        }
    };

    // Find current subtitle for display and auto-scroll
    const currentSubtitle = subtitles.find(
        (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    );
    const currentSubtitleIndex = subtitles.findIndex(
        (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    );

    // Save current sentence to notes
    const saveSentenceToNotes = useCallback(async () => {
        if (!currentSubtitle) return;
        const content = `${currentSubtitle.hanzi}${currentSubtitle.pinyin ? ` (${currentSubtitle.pinyin})` : ''} - ${currentSubtitle.meaningVi || ''}`;
        try {
            await videoNotesApi.create({
                videoId,
                content,
                timestampSec: Math.floor(currentSubtitle.startTime),
            });
            // Refresh notes if on notes tab
            if (activeTab === 'notes') {
                const fetchedNotes = await videoNotesApi.getByVideoId(videoId);
                setNotes(fetchedNotes);
            }
        } catch (error) {
            console.error('Failed to save sentence:', error);
        }
    }, [currentSubtitle, videoId, activeTab]);

    // Auto-scroll to current subtitle
    useEffect(() => {
        if (activeTab === 'subtitles' && currentSubtitleIndex >= 0 && subtitleItemRefs.current[currentSubtitleIndex]) {
            subtitleItemRefs.current[currentSubtitleIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentSubtitleIndex, activeTab]);

    // Refresh vocabulary when popover closes (word might have been saved)
    const handlePopoverClose = () => {
        setPopoverWord(null);
        setSelectedWord(null);
        setPopoverSubtitle(null);
        // Refresh vocabulary list if on vocabulary tab
        if (activeTab === 'vocabulary') {
            userVocabularyApi.getAll({ sourceVideoId: videoId, limit: 100 })
                .then(result => setSavedVocabulary(result.data))
                .catch(console.error);
        }
    };

    // Refresh subtitles after admin saves segment changes
    const refreshSubtitles = useCallback(async () => {
        try {
            const freshSubtitles = await videoApi.getSubtitles(videoId);
            setSubtitles(freshSubtitles);
        } catch (error) {
            console.error('Failed to refresh subtitles:', error);
        }
    }, [videoId]);

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!video) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <Card variant="default" className="text-center p-8 bg-surface-dark">
                    <Icon name="error" className="text-5xl text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-text-base mb-2">Video không tồn tại</h2>
                    <Button variant="primary" onClick={() => router.push("/learn")}>Quay lại thư viện</Button>
                </Card>
            </div>
        );
    }


    return (
        <div className="h-screen flex flex-col bg-background-dark overflow-hidden transition-colors duration-300">
            {/* Header */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-border-color bg-surface-dark px-4 md:px-6 py-2 md:py-3 shrink-0 transition-colors">
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <Link href="/learn" className="flex items-center gap-2 text-text-secondary hover:text-text-base transition-colors p-2 -ml-2">
                        <Icon name="arrow_back" />
                        <span className="hidden sm:inline">Quay lại</span>
                    </Link>
                </div>
                <h1 className="text-text-base font-bold truncate max-w-[40%] sm:max-w-xl text-sm sm:text-base md:text-lg leading-tight tracking-tight px-2">{video.title}</h1>
                <div className="flex items-center gap-3">
                    {/* Streak Display */}
                    <div className="hidden md:flex items-center gap-1 bg-surface-dark px-3 py-1.5 rounded-full border border-border-color shadow-sm">
                        <Icon name="local_fire_department" className="text-orange-500" size="md" />
                        <span className="text-sm font-bold text-text-base">{user?.streak || 0}</span>
                    </div>

                    {/* XP Display */}
                    <div className="hidden md:flex items-center gap-1 bg-surface-dark px-3 py-1.5 rounded-full border border-border-color shadow-sm">
                        <Icon name="sailing" className="text-cyan-400" size="md" />
                        <span className="text-sm font-bold text-text-base">{user?.xp || 0}</span>
                    </div>

                    {/* Notifications */}
                    <NotificationDropdown />

                    {/* User Avatar */}
                    <button
                        onClick={() => router.push('/profile')}
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                    >
                        {user?.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={user?.name || 'User'}
                                className="rounded-full size-8 sm:size-10 ring-2 ring-border-color object-cover"
                            />
                        ) : (
                            <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-full size-8 sm:size-10 ring-2 ring-border-color flex items-center justify-center text-on-primary font-bold text-xs sm:text-base">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                    </button>
                    
                    {quiz && (
                        <Link
                            href={`/learn/${videoId}/quiz`}
                            className="flex items-center gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-primary text-primary hover:bg-primary hover:text-white transition-colors text-xs sm:text-sm font-bold shrink-0"
                        >
                            <Icon name="quiz" size="sm" />
                            <span className="hidden sm:inline">Làm bài tập</span>
                        </Link>
                    )}
                    <Badge variant="primary" className="hidden xs:inline-flex">HSK {video.hskLevel}</Badge>
                </div>
            </header>

            {/* Main Bento Grid Layout */}
            <div className="flex-1 flex overflow-hidden p-2 gap-4">
                {/* Left Column: Video & Interactive Subtitle */}
                <div className="flex-1 lg:flex-[2] flex flex-col gap-4 overflow-hidden pb-0">
                    {/* Video Player - constrained height */}
                    <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-border-color group" style={{ maxHeight: '60vh', aspectRatio: '16/9' }}>
                        {video.videoUrl ? (
                            <>
                                {video.videoUrl.includes('youtube.com') || video.videoUrl.includes('youtu.be') ? (
                                    <YouTubePlayer
                                        ref={youtubePlayerRef}
                                        videoId={getYouTubeId(video.videoUrl) || ''}
                                        onTimeUpdate={handleTimeUpdate}
                                        onStateChange={(state) => {
                                            setIsPlaying(state === 1); // 1 = YT.PlayerState.PLAYING
                                            if (state === 1) {
                                                watchTimeTracker.startTracking(videoId, video.title);
                                            } else if (state === 2) {
                                                watchTimeTracker.pauseTracking();
                                            }
                                        }}
                                        onReady={() => {
                                            if (savedPosition > 0 && youtubePlayerRef.current) {
                                                youtubePlayerRef.current.seekTo(savedPosition);
                                            }
                                            setDuration(video.durationSeconds || 0);
                                        }}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <video
                                        ref={nativeVideoRef}
                                        src={video.videoUrl}
                                        controls
                                        className="w-full h-full object-contain"
                                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                        onPlay={() => {
                                            setIsPlaying(true);
                                            watchTimeTracker.startTracking(videoId, video.title);
                                        }}
                                        onPause={() => {
                                            setIsPlaying(false);
                                            watchTimeTracker.pauseTracking();
                                        }}
                                        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                    />
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-secondary">
                                <Icon name="videocam_off" size="xl" />
                            </div>
                        )}
                    </div>

                    {/* Interactive Subtitle Box - fixed height on md, flexible on mobile */}
                    <div className="bg-surface-dark rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1 border border-border-color shadow-lg shrink-0 overflow-hidden min-h-[120px] md:h-[143px]">
                        {currentSubtitle ? (
                            <>
                                {/* Pinyin Tier */}
                                {currentSubtitle.pinyin && (
                                    <p className="text-text-secondary text-sm md:text-base font-medium tracking-tight font-pinyin">
                                        {renderGroupedPinyin(currentSubtitle.hanzi || '', currentSubtitle.pinyin, currentSubtitle.tokens)}
                                    </p>
                                )}

                                 {/* Chinese Hanzi Tier - Interactive via Tokens or Intl Segmenter */}
                                <p className="text-text-base text-3xl md:text-4xl font-bold tracking-tight leading-normal flex flex-wrap justify-center font-chinese select-none" lang="zh-CN">
                                    {((currentSubtitle.tokens && currentSubtitle.tokens.length > 0
                                        ? currentSubtitle.tokens.map(t => ({ segment: t.hanzi }))
                                        : (segmenter ? Array.from(segmenter.segment(currentSubtitle.hanzi || '')) : (currentSubtitle.hanzi || '').split('').map(c => ({ segment: c })))) as any[]
                                    ).map((seg: { segment: string }, i: number) => {
                                        const word = seg.segment;
                                        // Render pure whitespace/punctuation without interaction
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
                                                    setPopoverSubtitle(currentSubtitle);
                                                    setPopoverWord(word);
                                                    setSelectedWord(word);
                                                    
                                                    // Pause video when clicking a word (only if it's the first word click)
                                                    if (!popoverWord && isPlaying) {
                                                        setWasPlayingBeforePopover(true);
                                                        handlePause();
                                                    }
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
                                    <p className="text-text-base/80 text-base md:text-lg font-medium mt-1">
                                        {currentSubtitle.meaningVi}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-text-secondary py-4">Phụ đề sẽ hiển thị ở đây...</p>
                        )}
                    </div>

                    {/* Quick Actions Toolbar - responsive */}
                    <div className="flex flex-wrap items-center justify-center gap-2 py-2">
                        {/* Primary Actions */}
                        <button
                            onClick={() => {
                                if (!isLoopMode && currentSubtitle) {
                                    // Enable loop: save current subtitle's time range
                                    const loopData = {
                                        startTime: Number(currentSubtitle.startTime),
                                        endTime: Number(currentSubtitle.endTime)
                                    };
                                    console.log('Loop enabled:', loopData);
                                    setLoopedSubtitle(loopData);
                                    setIsLoopMode(true);
                                } else {
                                    // Disable loop
                                    console.log('Loop disabled');
                                    setLoopedSubtitle(null);
                                    setIsLoopMode(false);
                                }
                            }}
                             className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${isLoopMode
                                ? 'bg-primary text-black'
                                : 'bg-surface-highlight hover:bg-surface-highlight/80 text-text-base border border-border-color shadow-sm'
                                }`}
                            title={isLoopMode && loopedSubtitle ? `Đang loop: ${Number(loopedSubtitle.startTime).toFixed(1)}s - ${Number(loopedSubtitle.endTime).toFixed(1)}s` : "Loop câu hiện tại"}
                        >
                            <Icon name="repeat_one" size="sm" />
                            <span className="hidden sm:inline">{isLoopMode ? 'Dừng' : 'Loop'}</span>
                        </button>

                        {/* Speed Control with Popup */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSpeedPopup(!showSpeedPopup)}
                             className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-highlight hover:bg-surface-highlight/80 text-text-base text-xs font-bold border border-border-color shadow-sm transition-all"
                                title="Thay đổi tốc độ"
                            >
                                <Icon name="slow_motion_video" size="sm" />
                                {playbackSpeed}x
                            </button>
                            {/* Speed Popup */}
                            {showSpeedPopup && (
                                <div
                                    ref={speedPopupRef}
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-4 bg-surface-dark border border-border-color rounded-2xl shadow-2xl z-50 min-w-[220px]"
                                >
                                    {/* Header */}
                                    <div className="text-center mb-4">
                                        <div className="text-3xl font-bold text-text-base mb-1">{playbackSpeed.toFixed(1)}x</div>
                                        <div className="text-xs text-text-secondary">Tốc độ phát</div>
                                    </div>

                                    {/* Custom Slider */}
                                    <div className="relative mb-4">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2"
                                            step="0.05"
                                            value={playbackSpeed}
                                            onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-surface-highlight rounded-full appearance-none cursor-pointer 
                                                [&::-webkit-slider-thumb]:appearance-none 
                                                [&::-webkit-slider-thumb]:w-5 
                                                [&::-webkit-slider-thumb]:h-5 
                                                [&::-webkit-slider-thumb]:rounded-full 
                                                [&::-webkit-slider-thumb]:bg-primary 
                                                [&::-webkit-slider-thumb]:shadow-lg 
                                                [&::-webkit-slider-thumb]:shadow-primary/50 
                                                [&::-webkit-slider-thumb]:cursor-pointer 
                                                [&::-webkit-slider-thumb]:transition-transform 
                                                [&::-webkit-slider-thumb]:hover:scale-110
                                                [&::-moz-range-thumb]:w-5 
                                                [&::-moz-range-thumb]:h-5 
                                                [&::-moz-range-thumb]:rounded-full 
                                                [&::-moz-range-thumb]:bg-primary 
                                                [&::-moz-range-thumb]:border-0
                                                [&::-moz-range-thumb]:cursor-pointer"
                                        />
                                        {/* Track labels */}
                                        <div className="flex justify-between text-[10px] text-text-secondary/70 mt-2 px-0.5">
                                            <span>Chậm</span>
                                            <span>Bình thường</span>
                                            <span>Nhanh</span>
                                        </div>
                                    </div>

                                    {/* Preset buttons - 2 rows */}
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                                            <button
                                                key={speed}
                                                onClick={() => { setSpeed(speed); setShowSpeedPopup(false); }}
                                                className={`py-2 text-sm font-medium rounded-lg transition-all ${playbackSpeed === speed
                                                    ? 'bg-primary text-on-primary shadow-md'
                                                    : 'bg-surface-highlight/50 text-text-base hover:bg-surface-highlight'
                                                    }`}
                                            >
                                                {speed}x
                                            </button>
                                        ))}
                                    </div>

                                    {/* Close hint */}
                                    <div className="text-center mt-3 text-[10px] text-text-secondary/50">
                                        Click bên ngoài để đóng
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                const newShadowMode = !isShadowingMode;
                                setIsShadowingMode(newShadowMode);

                                if (newShadowMode && subtitles.length > 0) {
                                    // Find current subtitle based on video time
                                    const currentSubIndex = subtitles.findIndex(sub =>
                                        currentTime >= Number(sub.startTime) && currentTime <= Number(sub.endTime)
                                    );

                                    // If no current subtitle, find the next one
                                    const subIndex = currentSubIndex !== -1
                                        ? currentSubIndex
                                        : subtitles.findIndex(sub => Number(sub.startTime) > currentTime);

                                    if (subIndex !== -1) {
                                        // Pause video and show shadow prompt
                                        if (youtubePlayerRef.current) {
                                            youtubePlayerRef.current.pause();
                                        } else if (nativeVideoRef.current) {
                                            nativeVideoRef.current.pause();
                                        }
                                        setShadowSubtitleIndex(subIndex);
                                        setShowShadowPrompt(true);
                                    }
                                } else {
                                    // Turning off shadow mode
                                    setShowShadowPrompt(false);
                                }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${isShadowingMode
                                ? 'bg-primary text-black'
                                : 'bg-surface-highlight hover:bg-surface-highlight/80 text-text-base border border-border-color shadow-sm'
                                }`}
                            title="Chế độ Shadowing"
                        >
                            <Icon name="record_voice_over" size="sm" />
                            <span className="hidden sm:inline">Shadow</span>
                        </button>

                        {/* Divider - hidden on very small screens */}
                        <div className="hidden sm:block w-px h-6 bg-border-color mx-1" />

                        {/* Secondary Icon Actions */}
                        <button
                            onClick={saveSentenceToNotes}
                            className="flex items-center justify-center size-8 rounded-full bg-surface-highlight hover:bg-surface-highlight/80 text-text-secondary hover:text-text-base transition-all border border-border-color shadow-sm"
                            title="Lưu câu"
                        >
                            <Icon name="bookmark_add" size="sm" />
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('notes');
                                setNewNoteContent(currentSubtitle?.hanzi || '');
                            }}
                            className="flex items-center justify-center size-8 rounded-full bg-surface-highlight hover:bg-surface-highlight/80 text-text-secondary hover:text-text-base transition-all border border-border-color shadow-sm"
                            title="Thêm ghi chú"
                        >
                            <Icon name="edit_note" size="sm" />
                        </button>
                    </div>
                </div>



                <div
                    ref={subtitleListRef}
                    className="hidden lg:flex lg:flex-col w-80 xl:w-96 bg-surface-dark rounded-2xl border border-border-color overflow-hidden shadow-lg"
                >
                    {/* Tabs */}
                    <div className="flex items-center p-2 gap-1 bg-surface-highlight m-2 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('subtitles')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all ${activeTab === 'subtitles'
                                ? 'bg-surface-dark text-primary shadow-sm'
                                : 'text-text-secondary hover:bg-surface-dark/50 hover:text-text-base'
                                }`}
                        >
                            Phụ đề
                        </button>
                        <button
                            onClick={() => setActiveTab('vocabulary')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-center transition-all ${activeTab === 'vocabulary'
                                ? 'bg-surface-dark text-primary shadow-sm'
                                : 'text-text-secondary hover:bg-surface-dark/50 hover:text-text-base'
                                }`}
                        >
                            Từ vựng
                        </button>
                        <button
                            onClick={() => setActiveTab('notes')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-center transition-all ${activeTab === 'notes'
                                ? 'bg-surface-dark text-primary shadow-sm'
                                : 'text-text-secondary hover:bg-surface-dark/50 hover:text-text-base'
                                }`}
                        >
                            Ghi chú
                        </button>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                        {activeTab === 'subtitles' && (
                            <>
                                {subtitles.map((sub, index) => (
                                    <div
                                        key={index}
                                        ref={el => { subtitleItemRefs.current[index] = el; }}
                                        onClick={() => handleSeekTo(sub.startTime)}
                                        className={`w-full text-left p-4 rounded-xl transition-all group cursor-pointer shrink-0 ${currentSubtitleIndex === index
                                            ? "bg-primary/10 border-l-3 border-l-primary pl-3"
                                            : "hover:bg-surface-highlight border-l-3 border-l-transparent"
                                            }`}
                                    >
                                        {/* Header with timestamp and indicator */}
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-mono ${currentSubtitleIndex === index
                                                ? 'text-primary font-bold'
                                                : 'text-text-secondary/60 group-hover:text-text-secondary'
                                                }`}>
                                                {formatTime(sub.startTime)}
                                            </span>
                                            {currentSubtitleIndex === index && (
                                                <Icon name="graphic_eq" size="sm" className="text-primary animate-pulse" />
                                            )}
                                        </div>

                                        {/* Hanzi */}
                                        <p className={`font-chinese ${currentSubtitleIndex === index
                                            ? 'text-text-base text-lg font-bold'
                                            : 'text-text-base text-base font-medium'
                                            }`} lang="zh-CN">
                                            {sub.hanzi || ''}
                                        </p>

                                        {/* Vietnamese meaning */}
                                        {sub.meaningVi && (
                                            <p className={`text-sm mt-1 ${currentSubtitleIndex === index
                                                ? 'text-text-secondary'
                                                : 'text-text-secondary/70'
                                                }`}>
                                                {sub.meaningVi}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Vocabulary Tab */}
                        {activeTab === 'vocabulary' && (
                            <>
                                {vocabLoading ? (
                                    <div className="flex justify-center py-12">
                                        <div className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : savedVocabulary.length === 0 ? (
                                    <div className="text-center py-12 text-text-secondary px-4">
                                        <Icon name="book" className="text-5xl mb-3 opacity-30" />
                                        <p className="text-sm font-medium">Chưa có từ vựng nào</p>
                                        <p className="text-xs mt-2 opacity-70">Click vào từ trong phụ đề để lưu</p>
                                    </div>
                                ) : (
                                    savedVocabulary.map(vocab => (
                                        <div
                                            key={vocab.id}
                                            className="p-4 rounded-xl hover:bg-surface-highlight/30 transition-colors group"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-text-secondary text-sm mb-1 font-pinyin tracking-tight">{vocab.vocabulary.pinyin}</p>
                                                    <p className="text-text-base text-lg font-bold font-chinese" lang="zh-CN">{vocab.vocabulary.hanzi}</p>
                                                    <p className="text-text-secondary/70 text-sm mt-1">
                                                        {vocab.vocabulary.meaningVi || vocab.vocabulary.meaningEn}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <SpeakerButton
                                                        text={vocab.vocabulary.hanzi}
                                                        size="sm"
                                                    />
                                                    <button
                                                        onClick={() => handleRemoveVocabulary(vocab.id)}
                                                        className="size-8 rounded-full bg-surface-highlight hover:bg-red-500/20 flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Icon name="delete" size="sm" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {/* Notes Tab */}
                        {activeTab === 'notes' && (
                            <>
                                {/* Add Note Input */}
                                <div className="p-4 rounded-xl bg-surface-dark mx-0 mb-2 border border-border-color">
                                    <div className="flex items-center gap-2 text-xs text-text-secondary/60 mb-2">
                                        <Icon name="schedule" size="sm" />
                                        <span className="font-mono">{formatTime(currentTime)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newNoteContent}
                                            onChange={(e) => setNewNoteContent(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                                            placeholder="Add a note..."
                                            className="flex-1 bg-background-dark border border-border-color/30 rounded-xl px-4 py-2.5 text-sm text-text-base placeholder-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
                                        />
                                        <button
                                            onClick={handleAddNote}
                                            disabled={!newNoteContent.trim()}
                                            className="px-4 py-2 bg-primary text-black font-bold rounded-xl hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Icon name="add" size="sm" />
                                        </button>
                                    </div>
                                </div>

                                {/* Notes List */}
                                {notesLoading ? (
                                    <div className="flex justify-center py-12">
                                        <div className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : notes.length === 0 ? (
                                    <div className="text-center py-12 text-text-secondary px-4">
                                        <Icon name="edit_note" className="text-5xl mb-3 opacity-30" />
                                        <p className="text-sm font-medium">Chưa có ghi chú nào</p>
                                        <p className="text-xs mt-2 opacity-70">Thêm ghi chú để nhớ những điểm quan trọng</p>
                                    </div>
                                ) : (
                                    notes.map(note => (
                                        <div
                                            key={note.id}
                                            className="p-4 rounded-xl hover:bg-surface-highlight/30 transition-colors group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <button
                                                    onClick={() => handleSeekTo(note.timestampSec)}
                                                    className="text-xs font-mono text-primary hover:underline"
                                                >
                                                    {formatTime(note.timestampSec)}
                                                </button>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingNoteId(note.id);
                                                            setEditingContent(note.content);
                                                        }}
                                                        className="size-7 rounded-full bg-surface-highlight hover:bg-surface-highlight/80 flex items-center justify-center text-text-secondary hover:text-text-base transition-colors border border-border-color shadow-sm"
                                                    >
                                                        <Icon name="edit" size="sm" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteNote(note.id)}
                                                        className="size-7 rounded-full bg-surface-highlight hover:bg-red-500/20 flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors border border-border-color shadow-sm"
                                                    >
                                                        <Icon name="delete" size="sm" />
                                                    </button>
                                                </div>
                                            </div>
                                            {editingNoteId === note.id ? (
                                                <div className="mt-2 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editingContent}
                                                        onChange={(e) => setEditingContent(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateNote(note.id)}
                                                        className="flex-1 bg-background-dark border border-border-color/30 rounded-lg px-3 py-2 text-sm text-text-base focus:outline-none focus:border-primary"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateNote(note.id)}
                                                        className="size-8 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-black transition-colors flex items-center justify-center"
                                                    >
                                                        <Icon name="check" size="sm" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingNoteId(null)}
                                                        className="size-8 rounded-lg bg-surface-dark text-text-secondary hover:text-text-base transition-colors flex items-center justify-center border border-border-color"
                                                    >
                                                        <Icon name="close" size="sm" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-text-base/90">{note.content}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Word Dictionary Popover */}
            {
                popoverWord && (
                    <WordPopover
                        word={popoverWord}
                        position={popoverPosition}
                        onClose={() => {
                            handlePopoverClose();
                            // Resume if it was playing before
                            if (wasPlayingBeforePopover) {
                                handlePlay();
                                setWasPlayingBeforePopover(false);
                            }
                        }}
                        sourceVideoId={videoId}
                        // Context for SRS flashcard enhancement
                        sourceTimestamp={currentSubtitle ? Number(currentSubtitle.startTime) : undefined}
                        sourceSentence={popoverSubtitle?.hanzi || currentSubtitle?.hanzi}
                        sourcePinyin={popoverSubtitle?.pinyin || currentSubtitle?.pinyin}
                        sourceSubtitle={popoverSubtitle || currentSubtitle}
                        // Video URL for thumbnail capture
                        videoUrl={video?.videoUrl}
                        // Segmentation: auto-reload subtitles + token meanings
                        onSubtitlesUpdated={refreshSubtitles}
                        currentSubtitleTokens={currentSubtitle?.tokens}
                    />
                )
            }

            {/* Shadow Mode Overlay */}
            {showShadowPrompt && shadowSubtitleIndex !== null && subtitles[shadowSubtitleIndex] && (
                <ShadowModeOverlay
                    isActive={showShadowPrompt}
                    currentText={subtitles[shadowSubtitleIndex].hanzi}
                    currentPinyin={subtitles[shadowSubtitleIndex].pinyin}
                    meaningVi={subtitles[shadowSubtitleIndex].meaningVi}
                    onContinue={() => {
                        setShowShadowPrompt(false);
                        // Move to next subtitle and resume
                        if (shadowSubtitleIndex < subtitles.length - 1) {
                            const nextSub = subtitles[shadowSubtitleIndex + 1];
                            youtubePlayerRef.current?.seekTo(Number(nextSub.startTime));
                            youtubePlayerRef.current?.play();
                        }
                    }}
                    onClose={() => {
                        setShowShadowPrompt(false);
                        setIsShadowingMode(false);
                    }}
                />
            )}
        </div >
    );
}


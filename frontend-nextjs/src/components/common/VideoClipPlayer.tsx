"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

interface VideoClipPlayerProps {
    /** YouTube video URL */
    videoUrl: string;
    /** Start time in seconds */
    startTime: number;
    /** Duration in seconds (default 5s) */
    duration?: number;
    /** Optional className */
    className?: string;
    /** Whether to show controls */
    showControls?: boolean;
}

/**
 * VideoClipPlayer - Plays a short clip from YouTube video
 * Used in flashcard review to provide context for saved vocabulary
 */
export default function VideoClipPlayer({
    videoUrl,
    startTime,
    duration = 5,
    className = "",
    showControls = true,
}: VideoClipPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Extract YouTube video ID
    const getYouTubeId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    };

    const videoId = getYouTubeId(videoUrl);
    const endTime = Math.floor(startTime + duration);
    const startTimeInt = Math.floor(startTime);

    // Build YouTube embed URL with autoplay and time parameters
    const embedUrl = videoId
        ? `https://www.youtube.com/embed/${videoId}?start=${startTimeInt}&end=${endTime}&autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&enablejsapi=1`
        : null;

    const handlePlay = () => {
        setIsLoading(true);
        setIsPlaying(true);
    };

    const handleClose = () => {
        setIsPlaying(false);
        setIsLoading(false);
    };

    // Auto-stop after duration
    useEffect(() => {
        if (isPlaying) {
            const timer = setTimeout(() => {
                setIsPlaying(false);
                setIsLoading(false);
            }, duration * 1000 + 500); // Add buffer for loading

            return () => clearTimeout(timer);
        }
    }, [isPlaying, duration]);

    if (!videoId) {
        return (
            <div className={`rounded-xl bg-black/20 flex items-center justify-center ${className}`}>
                <span className="text-text-secondary text-sm">Video không khả dụng</span>
            </div>
        );
    }

    // Thumbnail preview (before playing)
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return (
        <div className={`relative rounded-xl overflow-hidden bg-black ${className}`}>
            {!isPlaying ? (
                // Thumbnail with play button
                <div className="relative aspect-video">
                    <img
                        src={thumbnailUrl}
                        alt="Video context"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback to hqdefault if maxres not available
                            e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                        }}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Play button */}
                    {showControls && (
                        <button
                            onClick={handlePlay}
                            className="absolute inset-0 flex items-center justify-center group"
                        >
                            <div className="size-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-primary transition-all">
                                <Icon name="play_arrow" className="text-white text-3xl ml-1" />
                            </div>
                        </button>
                    )}

                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium rounded-[20px]">
                        {duration}s
                    </div>

                    {/* Timestamp badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-primary/80 text-white text-xs font-medium flex items-center gap-1 rounded-[20px]">
                        <Icon name="schedule" size="sm" />
                        {formatTime(startTimeInt)}
                    </div>
                </div>
            ) : (
                // YouTube player
                <div className="relative aspect-video">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                            <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    <iframe
                        ref={iframeRef}
                        src={embedUrl!}
                        title="Video context"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        onLoad={() => setIsLoading(false)}
                    />

                    {/* Close button */}
                    {showControls && (
                        <button
                            onClick={handleClose}
                            className="absolute top-2 right-2 size-8 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors z-20"
                        >
                            <Icon name="close" className="text-white" size="sm" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Helper: Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

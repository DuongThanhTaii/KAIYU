'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../common';

interface VideoControlsOverlayProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onToggleFullscreen?: () => void;
    className?: string;
    isYouTube?: boolean;
}

/**
 * Custom Video Controls Overlay
 * Features YouTube-like hover-to-show behavior, especially when paused.
 */
export default function VideoControlsOverlay({
    isPlaying,
    currentTime,
    duration,
    onPlayPause,
    onSeek,
    onToggleFullscreen,
    className = '',
    isYouTube = false,
}: VideoControlsOverlayProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Visibility logic: 
    // - Always show if paused AND hovered (as per user request)
    // - Show on hover when playing, but hide after delay
    useEffect(() => {
        if (!isPlaying) {
            // When paused, follows hover state immediately
            setIsVisible(isHovered);
        } else {
            // When playing
            if (isHovered) {
                setIsVisible(true);
                // Clear any existing timeout
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                // Set timeout to hide after 2.5s if mouse stays still (YouTube behavior)
                hideTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                }, 2500);
            } else {
                setIsVisible(false);
            }
        }

        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [isHovered, isPlaying]);

    // Format seconds to MM:SS
    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        onSeek(newTime);
    };

    return (
        <div 
            className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseMove={() => {
                if (isPlaying) {
                    setIsVisible(true);
                    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), 2500);
                }
            }}
        >
            {/* Top Gradient Overlay */}
            <div className="h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

            {/* Center Play/Pause Button */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlayPause();
                    }}
                    className="size-20 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center group pointer-events-auto transform transition-all hover:scale-110 active:scale-95 shadow-2xl"
                >
                    <Icon 
                        name={isPlaying ? "pause" : "play_arrow"} 
                        className="text-white text-5xl drop-shadow-lg ml-1" 
                    />
                </button>
            </div>

            {/* Bottom Controls Bar */}
            <div className="w-full px-4 pb-4 pt-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                {/* Progress Bar */}
                <div className="relative w-full group mb-3">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.1"
                        value={currentTime}
                        onChange={handleProgressChange}
                        className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer transition-all hover:h-2 group-hover:h-2
                            accent-primary
                            [&::-webkit-slider-thumb]:appearance-none 
                            [&::-webkit-slider-thumb]:w-4 
                            [&::-webkit-slider-thumb]:h-4 
                            [&::-webkit-slider-thumb]:rounded-full 
                            [&::-webkit-slider-thumb]:bg-primary 
                            [&::-webkit-slider-thumb]:shadow-lg 
                            [&::-webkit-slider-thumb]:scale-0
                            group-hover:[&::-webkit-slider-thumb]:scale-100
                            [&::-webkit-slider-thumb]:transition-transform
                            [&::-moz-range-thumb]:w-4 
                            [&::-moz-range-thumb]:h-4 
                            [&::-moz-range-thumb]:rounded-full 
                            [&::-moz-range-thumb]:bg-primary
                            [&::-moz-range-thumb]:border-0
                            [&::-moz-range-thumb]:scale-0
                            group-hover:[&::-moz-range-thumb]:scale-100"
                    />
                    {/* Progress Fill (Visual Only) */}
                    <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-primary rounded-full pointer-events-none group-hover:h-2 transition-all"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onPlayPause}
                            className="text-white hover:text-primary transition-colors transform active:scale-90"
                        >
                            <Icon name={isPlaying ? "pause" : "play_arrow"} size="md" />
                        </button>

                        <div className="flex items-center gap-2 text-white/90 text-sm font-medium font-mono">
                            <span>{formatTime(currentTime)}</span>
                            <span className="text-white/40">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {onToggleFullscreen && (
                            <button
                                onClick={onToggleFullscreen}
                                className="text-white hover:text-primary transition-colors transform active:scale-90"
                            >
                                <Icon name="fullscreen" size="md" />
                            </button>
                        )}
                        {isYouTube && (
                             <div className="opacity-60 hover:opacity-100 transition-opacity">
                                <Icon name="smart_display" size="sm" className="text-white" />
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

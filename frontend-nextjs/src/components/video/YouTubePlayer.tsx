'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';

// YouTube Player type definitions
interface YTPlayer {
    destroy: () => void;
    getCurrentTime: () => number;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    getPlayerState: () => number;
    setPlaybackRate: (rate: number) => void;
    getPlaybackRate: () => number;
}

interface YTPlayerConstructor {
    new(
        element: HTMLDivElement | string,
        options: {
            videoId: string;
            width?: string | number;
            height?: string | number;
            playerVars?: Record<string, number | string>;
            events?: {
                onReady?: () => void;
                onStateChange?: (event: { data: number }) => void;
                onError?: (event: { data: number }) => void;
            };
        }
    ): YTPlayer;
}

interface YTNamespace {
    Player: YTPlayerConstructor;
    PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
    };
}

// Extend Window interface for YouTube IFrame API
declare global {
    interface Window {
        YT?: YTNamespace;
        onYouTubeIframeAPIReady?: () => void;
    }
}

export interface YouTubePlayerHandle {
    seekTo: (seconds: number) => void;
    setPlaybackRate: (rate: number) => void;
    getPlaybackRate: () => number;
    play: () => void;
    pause: () => void;
    isPlaying: () => boolean;
}

interface YouTubePlayerProps {
    videoId: string;
    onTimeUpdate?: (time: number) => void;
    onReady?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onStateChange?: (state: number) => void;
    className?: string;
}

// Generate unique ID for each player instance
let playerIdCounter = 0;
let youtubeApiReadyPromise: Promise<void> | null = null;

const getYouTubeApiReady = (): Promise<void> => {
    if (window.YT && window.YT.Player) {
        return Promise.resolve();
    }

    if (youtubeApiReadyPromise) {
        return youtubeApiReadyPromise;
    }

    youtubeApiReadyPromise = new Promise<void>((resolve, reject) => {
        let settled = false;

        const finalize = () => {
            if (settled) return;
            settled = true;
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            resolve();
        };

        const fail = () => {
            if (settled) return;
            settled = true;
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            youtubeApiReadyPromise = null;
            reject(new Error('YouTube IFrame API load timeout'));
        };

        const pollInterval = setInterval(() => {
            if (window.YT && window.YT.Player) {
                finalize();
            }
        }, 100);

        const timeoutId = setTimeout(fail, 15000);

        const previousReadyHandler = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previousReadyHandler === 'function') {
                previousReadyHandler();
            }
            finalize();
        };

        const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
        if (!existingScript) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }
    });

    return youtubeApiReadyPromise;
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(({
    videoId,
    onTimeUpdate,
    onReady,
    onPlay,
    onPause,
    onStateChange,
    className = '',
}, ref) => {
    const [playerId] = useState(() => `youtube-player-${++playerIdCounter}`);
    const [isAPIReady, setIsAPIReady] = useState(false);
    const playerRef = useRef<YTPlayer | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onReadyRef = useRef(onReady);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onStateChangeRef = useRef(onStateChange);

    // Update refs when callbacks change
    useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
        onReadyRef.current = onReady;
        onPlayRef.current = onPlay;
        onPauseRef.current = onPause;
        onStateChangeRef.current = onStateChange;
    }, [onTimeUpdate, onReady, onPlay, onPause, onStateChange]);

    // Expose seekTo and playback rate methods to parent
    useImperativeHandle(ref, () => ({
        seekTo: (seconds: number) => {
            if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                playerRef.current.seekTo(seconds, true);
            }
        },
        setPlaybackRate: (rate: number) => {
            if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
                playerRef.current.setPlaybackRate(rate);
            }
        },
        getPlaybackRate: () => {
            if (playerRef.current && typeof playerRef.current.getPlaybackRate === 'function') {
                return playerRef.current.getPlaybackRate();
            }
            return 1;
        },
        play: () => {
            if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                playerRef.current.playVideo();
            }
        },
        pause: () => {
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
                playerRef.current.pauseVideo();
            }
        },
        isPlaying: () => {
            if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                return playerRef.current.getPlayerState() === 1; // YT.PlayerState.PLAYING
            }
            return false;
        },
    }), []);

    // Load API on mount
    useEffect(() => {
        let isMounted = true;

        getYouTubeApiReady()
            .then(() => {
                if (isMounted) {
                    setIsAPIReady(true);
                }
            })
            .catch((error) => {
                console.error('Failed to load YouTube API:', error);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Initialize player when API is ready
    useEffect(() => {
        if (!isAPIReady || !window.YT || !videoId) return;

        const playerElement = document.getElementById(playerId);
        if (!playerElement) return;

        // Destroy existing player
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                console.error('Error destroying player:', e);
            }
            playerRef.current = null;
        }

        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Create new player
        try {
            playerRef.current = new window.YT.Player(playerId, {
                videoId: videoId,
                width: '100%',
                height: '100%',
                playerVars: {
                    autoplay: 0,
                    modestbranding: 1,
                    rel: 0,
                    enablejsapi: 1,
                    origin: window.location.origin,
                    controls: 1,
                    disablekb: 0,
                },
                events: {
                    onReady: () => {
                        if (onReadyRef.current) onReadyRef.current();

                        // Start time tracking interval
                        intervalRef.current = setInterval(() => {
                            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                                try {
                                    const time = playerRef.current.getCurrentTime();
                                    if (onTimeUpdateRef.current) {
                                        onTimeUpdateRef.current(time);
                                    }
                                } catch (e) {
                                    // Player might not be ready
                                }
                            }
                        }, 100);
                    },
                    onStateChange: (event: { data: number }) => {
                        // Notify parent of state change
                        if (onStateChangeRef.current) {
                            onStateChangeRef.current(event.data);
                        }

                        // When video is playing, ensure interval is running
                        if (window.YT && event.data === window.YT.PlayerState.PLAYING) {
                            if (onPlayRef.current) onPlayRef.current();
                            if (!intervalRef.current) {
                                intervalRef.current = setInterval(() => {
                                    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                                        try {
                                            const time = playerRef.current.getCurrentTime();
                                            if (onTimeUpdateRef.current) {
                                                onTimeUpdateRef.current(time);
                                            }
                                        } catch (e) {
                                            // Player might not be ready
                                        }
                                    }
                                }, 100);
                            }
                        }
                        // When video is paused or ended
                        if (window.YT && (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED)) {
                            if (onPauseRef.current) onPauseRef.current();
                        }
                    },
                    onError: (event: { data: number }) => {
                        console.error('YouTube player error:', event.data);
                    },
                },
            });
        } catch (e) {
            console.error('Error creating YouTube player:', e);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    // Ignore cleanup errors
                }
                playerRef.current = null;
            }
        };
    }, [isAPIReady, videoId, playerId]);

    return (
        <div className={`w-full h-full ${className}`}>
            <div id={playerId} className="w-full h-full" />
        </div>
    );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;

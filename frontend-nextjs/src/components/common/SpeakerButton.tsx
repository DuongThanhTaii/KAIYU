'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Icon from './Icon';
import { speakChinese, isTTSSupported, stopSpeaking, initializeTTS } from '@/services/ttsService';

interface SpeakerButtonProps {
    text: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showSpeed?: boolean; // Show speed indicator after speaking
}

const SpeakerButton: React.FC<SpeakerButtonProps> = ({
    text,
    className = '',
    size = 'md',
    showSpeed = false,
}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [lastSpeed, setLastSpeed] = useState<number | null>(null);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        // Initialize TTS and check support
        initializeTTS().then(hasVoice => {
            setIsSupported(isTTSSupported() && hasVoice);
        });
    }, []);

    const handleSpeak = useCallback(async () => {
        if (!text || isSpeaking) return;

        setIsSpeaking(true);
        try {
            const speed = await speakChinese(text);
            setLastSpeed(speed);
        } catch (err) {
            console.error('TTS failed:', err);
        } finally {
            setIsSpeaking(false);
        }
    }, [text, isSpeaking]);

    const handleStop = useCallback(() => {
        stopSpeaking();
        setIsSpeaking(false);
    }, []);

    if (!isSupported) {
        return null; // Hide button if TTS not supported
    }

    const sizeClasses = {
        sm: 'size-8 text-sm p-1.5',
        md: 'size-10 text-base p-2',
        lg: 'size-12 text-lg p-2.5',
    };

    const iconSizes = {
        sm: 'sm' as const,
        md: 'md' as const,
        lg: 'lg' as const,
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                isSpeaking ? handleStop() : handleSpeak();
            }}
            className={`
                inline-flex items-center justify-center rounded-full transition-all shrink-0
                ${isSpeaking
                    ? 'bg-primary/20 text-primary animate-pulse'
                    : 'text-text-secondary hover:text-primary hover:bg-surface-highlight/30'
                }
                ${sizeClasses[size]}
                ${className}
            `}
            title={isSpeaking ? 'Dừng phát' : `Phát âm: ${text}`}
            aria-label={isSpeaking ? 'Stop speaking' : `Speak: ${text}`}
        >
            <Icon
                name={isSpeaking ? 'stop' : 'volume_up'}
                size={iconSizes[size]}
            />
            {showSpeed && lastSpeed !== null && !isSpeaking && (
                <span className="text-xs opacity-70">{lastSpeed}x</span>
            )}
        </button>
    );
};

export default SpeakerButton;

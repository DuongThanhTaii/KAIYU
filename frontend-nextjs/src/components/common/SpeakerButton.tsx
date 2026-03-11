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
        sm: 'size-6 text-sm',
        md: 'size-8 text-base',
        lg: 'size-10 text-lg',
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
                inline-flex items-center justify-center gap-1
                ${isSpeaking
                    ? 'bg-primary/20 text-primary animate-pulse'
                    : 'bg-surface-highlight/50 text-text-secondary hover:text-primary hover:bg-primary/10'
                }
                ${sizeClasses[size]} p-5 hover:bg-primary/20 hover:text-primary
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

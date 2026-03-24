'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from './Icon';
import {
    AudioRecorder,
    isRecordingSupported,
    requestMicrophonePermission,
    transcribeAudio,
    assessPronunciation,
    isWhisperConfigured,
    type AssessmentResult
} from '@/services/speechAssessmentService';

interface ShadowModeOverlayProps {
    isActive: boolean;
    currentText: string;      // Chinese text to practice
    currentPinyin?: string;   // Pinyin for reference
    meaningVi?: string;       // Vietnamese meaning
    onContinue: () => void;   // Called when user wants to continue to next subtitle
    onClose: () => void;      // Close shadow mode
}

const ShadowModeOverlay: React.FC<ShadowModeOverlayProps> = ({
    isActive,
    currentText,
    currentPinyin,
    meaningVi,
    onContinue,
    onClose,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recorder] = useState(() => new AudioRecorder());
    const [result, setResult] = useState<AssessmentResult | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [countdown, setCountdown] = useState<number | null>(null);

    // Check support on mount
    useEffect(() => {
        setIsSupported(isRecordingSupported());
    }, []);

    // Request permission when overlay becomes active
    useEffect(() => {
        if (isActive && hasPermission === null) {
            requestMicrophonePermission().then(setHasPermission);
        }
    }, [isActive, hasPermission]);

    // Reset result when text changes
    useEffect(() => {
        setResult(null);
    }, [currentText]);

    const handleStartRecording = useCallback(async () => {
        if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            setHasPermission(granted);
            if (!granted) return;
        }

        // Countdown before recording
        setCountdown(3);
        for (let i = 3; i > 0; i--) {
            setCountdown(i);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setCountdown(null);

        setResult(null);
        setIsRecording(true);
        await recorder.start();
    }, [hasPermission, recorder]);

    const handleStopRecording = useCallback(async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
            const audioBlob = await recorder.stop();

            // Transcribe using Whisper (if configured) or Web Speech API (fallback)
            const { text, method } = await transcribeAudio(audioBlob, 'zh');

            // Assess pronunciation by comparing with reference
            const assessment = assessPronunciation(text, currentText, method);
            setResult(assessment);
        } catch (error) {
            console.error('Speech assessment failed:', error);
            setResult({
                overall: 0,
                pronunciation: 0,
                fluency: 0,
                integrity: 0,
                rhythm: 0,
                transcription: '(Không nhận diện được)',
                words: [],
                method: 'fallback',
            });
        } finally {
            setIsProcessing(false);
        }
    }, [recorder, currentText]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreEmoji = (score: number) => {
        if (score >= 90) return '🌟';
        if (score >= 80) return '✨';
        if (score >= 60) return '👍';
        if (score >= 40) return '💪';
        return '';
    };

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
            <div className="bg-surface-dark rounded-3xl max-w-2xl w-full border border-border-color shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 sm:p-8 overflow-y-auto flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="size-10 sm:size-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <Icon name="record_voice_over" className="text-xl sm:text-2xl text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white">Chế độ Shadowing</h2>
                                <p className="text-text-secondary text-xs sm:text-sm">Lặp lại theo câu sau</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-10 rounded-full bg-surface-highlight hover:bg-red-500/20 flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors shrink-0"
                            title="Đóng"
                        >
                            <Icon name="close" size="md" />
                        </button>
                    </div>

                    {/* Current sentence to practice */}
                    <div className="text-center py-8 px-4 bg-background-dark rounded-2xl mb-6">
                        {currentPinyin && (
                            <p className="text-primary text-lg mb-2 font-pinyin tracking-tight">{currentPinyin}</p>
                        )}
                        <p className="text-white text-4xl font-bold font-chinese mb-3 tracking-tight" lang="zh-CN">
                            {currentText}
                        </p>
                        {meaningVi && (
                            <p className="text-text-secondary text-sm italic">"{meaningVi}"</p>
                        )}
                    </div>

                    {/* Recording controls */}
                    <div className="flex flex-col items-center gap-4 mb-6">
                        {countdown !== null ? (
                            <div className="text-6xl font-bold text-primary animate-pulse">
                                {countdown}
                            </div>
                        ) : isRecording ? (
                            <button
                                onClick={handleStopRecording}
                                className="size-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-all animate-pulse"
                            >
                                <Icon name="stop" className="text-3xl" />
                            </button>
                        ) : (
                            <button
                                onClick={handleStartRecording}
                                disabled={!isSupported}
                                className="size-20 rounded-full bg-primary hover:bg-primary-hover flex items-center justify-center text-black shadow-lg transition-all disabled:opacity-50"
                            >
                                <Icon name="mic" className="text-3xl" />
                            </button>
                        )}

                        <p className="text-text-secondary text-sm">
                            {countdown !== null
                                ? 'Chuẩn bị...'
                                : isRecording
                                    ? '🔴 Đang ghi âm... Nhấn để dừng'
                                    : !isSupported
                                        ? 'Trình duyệt không hỗ trợ ghi âm'
                                        : 'Nhấn mic để bắt đầu nói'}
                        </p>
                    </div>

                    {/* Assessment result */}
                    {result && (
                        <div className="bg-surface-highlight/50 rounded-2xl p-6 mb-6">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <span className="text-4xl">{getScoreEmoji(result.overall)}</span>
                                <span className={`text-5xl font-bold ${getScoreColor(result.overall)}`}>
                                    {result.overall}
                                </span>
                                <span className="text-text-secondary text-xl">/100</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Phát âm:</span>
                                    <span className={getScoreColor(result.pronunciation)}>{result.pronunciation}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Lưu loát:</span>
                                    <span className={getScoreColor(result.fluency)}>{result.fluency}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Hoàn chỉnh:</span>
                                    <span className={getScoreColor(result.integrity)}>{result.integrity}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Nhịp điệu:</span>
                                    <span className={getScoreColor(result.rhythm)}>{result.rhythm}%</span>
                                </div>
                            </div>

                            {result.transcription && (
                                <div className="mt-4 pt-4 border-t border-border-color">
                                    <p className="text-text-secondary text-xs mb-1">Bạn đã nói:</p>
                                    <p className="text-white font-chinese" lang="zh-CN">{result.transcription}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setResult(null);
                            }}
                            className="flex-1 py-3 px-4 rounded-xl border border-border-color text-text-secondary hover:text-white hover:border-primary transition-colors flex items-center justify-center"
                        >
                            <Icon name="refresh" size="sm" className="mr-2" />
                            Thử lại
                        </button>
                        <button
                            onClick={onContinue}
                            className="flex-1 py-3 px-4 rounded-xl bg-primary text-black font-bold hover:bg-primary-hover transition-colors flex items-center justify-center"
                        >
                            Tiếp tục
                            <Icon name="arrow_forward" size="sm" className="ml-2" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShadowModeOverlay;

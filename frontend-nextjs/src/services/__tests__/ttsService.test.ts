import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ttsService, stopSpeaking, isTTSSupported, initializeTTS } from '../ttsService';

describe('TTS Service', () => {
    let originalSpeechSynthesis: any;

    beforeEach(() => {
        originalSpeechSynthesis = window.speechSynthesis;
    });

    afterEach(() => {
        // Restore original
        Object.defineProperty(window, 'speechSynthesis', {
            value: originalSpeechSynthesis,
            writable: true,
            configurable: true,
        });
    });

    describe('isTTSSupported', () => {
        it('should return true when speechSynthesis is available', () => {
            Object.defineProperty(window, 'speechSynthesis', {
                value: { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn().mockReturnValue([]) },
                writable: true,
                configurable: true,
            });
            expect(isTTSSupported()).toBe(true);
        });
    });

    describe('stopSpeaking', () => {
        it('should call speechSynthesis.cancel when available', () => {
            const mockCancel = vi.fn();
            Object.defineProperty(window, 'speechSynthesis', {
                value: { cancel: mockCancel, getVoices: vi.fn().mockReturnValue([]) },
                writable: true,
                configurable: true,
            });

            stopSpeaking();

            expect(mockCancel).toHaveBeenCalled();
        });
    });

    describe('ttsService object', () => {
        it('should export all functions', () => {
            expect(ttsService.isTTSSupported).toBeDefined();
            expect(ttsService.speakChinese).toBeDefined();
            expect(ttsService.stopSpeaking).toBeDefined();
            expect(ttsService.initializeTTS).toBeDefined();
        });
    });

    describe('initializeTTS', () => {
        it('should return a promise', () => {
            Object.defineProperty(window, 'speechSynthesis', {
                value: {
                    getVoices: vi.fn().mockReturnValue([{ lang: 'zh-CN' }]),
                    onvoiceschanged: undefined,
                },
                writable: true,
                configurable: true,
            });

            const result = initializeTTS();
            expect(result).toBeInstanceOf(Promise);
        });
    });
});

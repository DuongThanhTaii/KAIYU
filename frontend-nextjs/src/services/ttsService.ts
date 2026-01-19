// Text-to-Speech service for Chinese pronunciation using Web Speech API

// Track current speed state (toggles between 1.0 and 0.8)
let currentSpeedIndex = 0;
const speeds = [1.0, 0.8];

// Check if TTS is supported
export const isTTSSupported = (): boolean => {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Get Chinese voice
const getChineseVoice = (): SpeechSynthesisVoice | null => {
    if (!isTTSSupported()) return null;

    const voices = window.speechSynthesis.getVoices();

    // Try to find Chinese Mandarin voices (prioritized)
    const preferredVoices = [
        'zh-CN',           // Simplified Chinese
        'zh-TW',           // Traditional Chinese
        'cmn-Hans-CN',     // Mandarin Simplified
        'cmn-Hant-TW',     // Mandarin Traditional
        'zh',              // Generic Chinese
    ];

    for (const lang of preferredVoices) {
        const voice = voices.find(v => v.lang.startsWith(lang) || v.lang === lang);
        if (voice) return voice;
    }

    // Fallback to any Chinese voice
    return voices.find(v => v.lang.includes('zh') || v.lang.includes('cmn')) || null;
};

/**
 * Speak Chinese text with toggle speed
 * First click = 1.0x, second click = 0.8x, then repeats
 * @returns The speed used for this utterance
 */
export const speakChinese = (text: string, forceRate?: number): Promise<number> => {
    return new Promise((resolve, reject) => {
        if (!isTTSSupported()) {
            reject(new Error('TTS not supported'));
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Set Chinese voice
        const chineseVoice = getChineseVoice();
        if (chineseVoice) {
            utterance.voice = chineseVoice;
        }

        // Use forced rate or toggle rate
        const rate = forceRate ?? speeds[currentSpeedIndex];

        // Toggle speed for next click (only if not forced)
        if (forceRate === undefined) {
            currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
        }

        // Configure utterance
        utterance.lang = 'zh-CN';
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => resolve(rate);
        utterance.onerror = (event) => {
            // 'interrupted' or 'canceled' happens when we allow a new speech to overtake the current one
            // This is expected behavior when clicking fast
            if (event.error === 'interrupted' || event.error === 'canceled') {
                resolve(rate); // Resolve instead of reject to avoid noisy console errors
                return;
            }

            console.error('TTS error event:', {
                error: event.error,
                elapsedTime: event.elapsedTime
            });
            reject(new Error(`TTS failed: ${event.error}`));
        };

        window.speechSynthesis.speak(utterance);
    });
};

// Stop speaking
export const stopSpeaking = (): void => {
    if (isTTSSupported()) {
        window.speechSynthesis.cancel();
    }
};

// Get current speed that will be used next
export const getCurrentSpeed = (): number => {
    return speeds[currentSpeedIndex];
};

// Reset speed to default (1.0x)
export const resetSpeed = (): void => {
    currentSpeedIndex = 0;
};

// Initialize voices (needs to be called after page load)
export const initializeTTS = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!isTTSSupported()) {
            resolve(false);
            return;
        }

        // Some browsers need a small delay to load voices
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            const hasChineseVoice = voices.some(v =>
                v.lang.includes('zh') || v.lang.includes('cmn')
            );
            resolve(hasChineseVoice);
        };

        // Chrome loads voices asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        // Try immediately (Firefox, Safari)
        setTimeout(loadVoices, 100);
    });
};

// Export as default object for convenience
export const ttsService = {
    isTTSSupported,
    speakChinese,
    stopSpeaking,
    getCurrentSpeed,
    resetSpeed,
    initializeTTS,
};

export default ttsService;

// Speech Assessment Service for pronunciation practice
// Supports: Whisper API (self-hosted) → Web Speech API (fallback)

export interface AssessmentResult {
    overall: number;        // 0-100 overall score
    pronunciation: number;  // 0-100 pronunciation accuracy
    fluency: number;        // 0-100 fluency score
    integrity: number;      // 0-100 completeness score
    rhythm: number;         // 0-100 rhythm/tone score
    transcription: string;  // What the user actually said
    words: WordAssessment[];
    method: 'whisper' | 'webspeech' | 'fallback';
}

export interface WordAssessment {
    word: string;
    score: number;
    isCorrect: boolean;
}

// Configuration - set NEXT_PUBLIC_WHISPER_API_URL in .env.local when you have a server
// Example: NEXT_PUBLIC_WHISPER_API_URL=http://localhost:9000
const getWhisperApiUrl = () => {
    if (typeof window !== 'undefined') {
        return process.env.NEXT_PUBLIC_WHISPER_API_URL || '';
    }
    return '';
};

// Check if MediaRecorder is supported
export const isRecordingSupported = (): boolean => {
    return typeof window !== 'undefined' &&
        'MediaRecorder' in window &&
        navigator.mediaDevices?.getUserMedia !== undefined;
};

// Check if Web Speech API is supported
export const isWebSpeechSupported = (): boolean => {
    return typeof window !== 'undefined' &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
};

// Request microphone permission
export const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
};

// Audio recorder class for capturing user speech
export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;

    async start(): Promise<void> {
        this.audioChunks = [];

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            }
        });

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.start(100); // Collect data every 100ms
    }

    stop(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve(new Blob());
                return;
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
            this.stream?.getTracks().forEach(track => track.stop());
        });
    }

    isRecording(): boolean {
        return this.mediaRecorder?.state === 'recording';
    }
}

/**
 * Transcribe audio using Whisper API (if available) or Web Speech API (fallback)
 */
export const transcribeAudio = async (
    audioBlob: Blob,
    language: string = 'zh'
): Promise<{ text: string; method: 'whisper' | 'webspeech' | 'fallback' }> => {
    const whisperUrl = getWhisperApiUrl();

    // Try Whisper API first if configured
    if (whisperUrl) {
        try {
            console.log('[STT] Trying Whisper API...');
            const result = await transcribeWithWhisper(audioBlob, language, whisperUrl);
            console.log('[STT] Whisper success:', result);
            return { text: result, method: 'whisper' };
        } catch (error) {
            console.warn('[STT] Whisper API failed, falling back to Web Speech API:', error);
        }
    }

    // Fallback to Web Speech API
    if (isWebSpeechSupported()) {
        try {
            console.log('[STT] Using Web Speech API...');
            const result = await transcribeWithWebSpeech(language);
            console.log('[STT] Web Speech result:', result);
            return { text: result, method: 'webspeech' };
        } catch (error) {
            console.warn('[STT] Web Speech API failed:', error);
        }
    }

    console.warn('[STT] No speech recognition available');
    return { text: '', method: 'fallback' };
};

/**
 * Transcribe using self-hosted Whisper API
 */
const transcribeWithWhisper = async (
    audioBlob: Blob,
    language: string,
    apiUrl: string
): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);

    const response = await fetch(`${apiUrl}/transcribe`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
};

/**
 * Transcribe using Web Speech API (browser built-in)
 */
const transcribeWithWebSpeech = (language: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

        if (!SpeechRecognition) {
            reject(new Error('Web Speech API not supported'));
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = language === 'zh' ? 'zh-CN' : language;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let hasResult = false;

        recognition.onresult = (event: any) => {
            hasResult = true;
            const transcript = event.results[0]?.[0]?.transcript || '';
            resolve(transcript);
        };

        recognition.onerror = (event: any) => {
            if (!hasResult) {
                reject(new Error(`Speech recognition error: ${event.error}`));
            }
        };

        recognition.onend = () => {
            if (!hasResult) {
                resolve('');
            }
        };

        recognition.start();

        // Auto-stop after 10 seconds
        setTimeout(() => {
            try { recognition.stop(); } catch { }
        }, 10000);
    });
};

/**
 * Assess pronunciation by comparing spoken text to reference
 */
export const assessPronunciation = (
    spokenText: string,
    referenceText: string,
    method: 'whisper' | 'webspeech' | 'fallback' = 'webspeech'
): AssessmentResult => {
    const spoken = spokenText.replace(/\s/g, '').trim();
    const reference = referenceText.replace(/\s/g, '').trim();

    if (!spoken) {
        return {
            overall: 0,
            pronunciation: 0,
            fluency: 0,
            integrity: 0,
            rhythm: 0,
            transcription: spokenText || '(Không nhận diện được)',
            words: [],
            method,
        };
    }

    let matchCount = 0;
    const words: WordAssessment[] = [];

    // Character-by-character comparison for Chinese
    for (let i = 0; i < reference.length; i++) {
        const refChar = reference[i];
        const spokenChar = spoken[i] || '';
        const isCorrect = refChar === spokenChar;

        if (isCorrect) matchCount++;

        words.push({
            word: refChar,
            score: isCorrect ? 100 : 0,
            isCorrect,
        });
    }

    // Calculate scores
    const accuracy = reference.length > 0
        ? Math.round((matchCount / reference.length) * 100)
        : 0;

    const completeness = reference.length > 0
        ? Math.round((Math.min(spoken.length, reference.length) / reference.length) * 100)
        : 0;

    // Bonus points if length matches
    const lengthBonus = spoken.length === reference.length ? 10 : 0;

    const overall = Math.min(100, Math.round((accuracy * 0.7 + completeness * 0.3) + lengthBonus));

    return {
        overall,
        pronunciation: accuracy,
        fluency: Math.min(100, accuracy + 10), // Slight bonus
        integrity: completeness,
        rhythm: accuracy, // Same as pronunciation for now
        transcription: spokenText,
        words,
        method,
    };
};

// Check if Whisper is configured
export const isWhisperConfigured = (): boolean => {
    return !!getWhisperApiUrl();
};

// Export default service object
export const speechAssessmentService = {
    isRecordingSupported,
    isWebSpeechSupported,
    requestMicrophonePermission,
    AudioRecorder,
    transcribeAudio,
    assessPronunciation,
    isWhisperConfigured,
};

export default speechAssessmentService;

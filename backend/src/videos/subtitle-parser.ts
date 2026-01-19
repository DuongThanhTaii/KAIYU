/**
 * SRT/VTT Subtitle Parser
 * Parses subtitle files and extracts timing + text data
 */

export interface ParsedSubtitle {
    sequenceOrder: number;
    startTime: number;  // in seconds
    endTime: number;    // in seconds
    hanzi: string;
    pinyin?: string;
    meaningVi?: string;
    meaningEn?: string;
}

export interface ParsedToken {
    position: number;
    hanzi: string;
    pinyin?: string;
    meaning?: string;
}

/**
 * Parse SRT timestamp to seconds
 * Format: HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS,mmm or MM:SS.mmm
 */
function parseSrtTimestamp(timestamp: string): number {
    const trimmed = timestamp.trim();

    // Try HH:MM:SS,mmm or HH:MM:SS.mmm format
    const fullRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
    const fullMatch = trimmed.match(fullRegex);

    if (fullMatch) {
        const hours = parseInt(fullMatch[1], 10);
        const minutes = parseInt(fullMatch[2], 10);
        const seconds = parseInt(fullMatch[3], 10);
        const milliseconds = parseInt(fullMatch[4], 10);
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }

    // Try MM:SS,mmm or MM:SS.mmm format (from frontend)
    const shortRegex = /(\d{1,2}):(\d{2})[,.](\d{3})/;
    const shortMatch = trimmed.match(shortRegex);

    if (shortMatch) {
        const minutes = parseInt(shortMatch[1], 10);
        const seconds = parseInt(shortMatch[2], 10);
        const milliseconds = parseInt(shortMatch[3], 10);
        return minutes * 60 + seconds + milliseconds / 1000;
    }

    // Try MM:SS format (no milliseconds)
    const simpleRegex = /(\d{1,2}):(\d{2})$/;
    const simpleMatch = trimmed.match(simpleRegex);

    if (simpleMatch) {
        const minutes = parseInt(simpleMatch[1], 10);
        const seconds = parseInt(simpleMatch[2], 10);
        return minutes * 60 + seconds;
    }

    throw new Error(`Invalid timestamp format: ${timestamp}`);
}

/**
 * Parse VTT timestamp to seconds
 * Format: MM:SS.mmm or HH:MM:SS.mmm
 */
function parseVttTimestamp(timestamp: string): number {
    const parts = timestamp.trim().split(':');

    if (parts.length === 2) {
        // MM:SS.mmm
        const minutes = parseInt(parts[0], 10);
        const [seconds, ms] = parts[1].split('.');
        return minutes * 60 + parseInt(seconds, 10) + (parseInt(ms || '0', 10) / 1000);
    } else if (parts.length === 3) {
        // HH:MM:SS.mmm
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const [seconds, ms] = parts[2].split('.');
        return hours * 3600 + minutes * 60 + parseInt(seconds, 10) + (parseInt(ms || '0', 10) / 1000);
    }

    throw new Error(`Invalid VTT timestamp: ${timestamp}`);
}

/**
 * Check if text contains Vietnamese-specific characters
 * Vietnamese has unique diacritics not found in Pinyin
 */
function isVietnamese(text: string): boolean {
    // Vietnamese-specific characters with unique diacritics
    const vietnamesePattern = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
    return vietnamesePattern.test(text);
}

/**
 * Check if text looks like Pinyin (romanized Chinese with tone marks or numbers)
 */
function isPinyin(text: string): boolean {
    // Pinyin tone marks
    const pinyinTonePattern = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
    // Or pinyin with tone numbers (ni3 hao3)
    const pinyinNumberPattern = /[a-z]+[1-4]/i;
    // Contains mostly latin alphabet
    const isLatin = /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s,.\-'!?]+$/;

    return (pinyinTonePattern.test(text) || pinyinNumberPattern.test(text)) && isLatin.test(text);
}

/**
 * Parse SRT file content with auto-detection
 * 
 * SRT Format (3 lines - full):
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * 你好，欢迎学习中文           (Chinese)
 * Nǐ hǎo, huānyíng xuéxí       (Pinyin)
 * Xin chào, chào mừng bạn      (Vietnamese)
 * 
 * SRT Format (2 lines - Chinese + Vietnamese only):
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * 你好，欢迎学习中文           (Chinese)
 * Xin chào, chào mừng bạn      (Vietnamese)
 */
export function parseSrt(content: string): ParsedSubtitle[] {
    const subtitles: ParsedSubtitle[] = [];
    // Normalize line endings to \n and split by empty lines (one or more)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalizedContent.trim().split(/\n\n+/);

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;

        // First line: sequence number
        const sequenceOrder = parseInt(lines[0].trim(), 10);
        if (isNaN(sequenceOrder)) continue;

        // Second line: timestamps
        const timeMatch = lines[1].match(/(.+?)\s*-->\s*(.+)/);
        if (!timeMatch) continue;

        const startTime = parseSrtTimestamp(timeMatch[1]);
        const endTime = parseSrtTimestamp(timeMatch[2]);

        // Remaining lines: content
        // Check if single line with pipe separator (from frontend)
        if (lines.length === 3 && lines[2].includes('|')) {
            const parts = lines[2].split('|').map(p => p.trim());
            const hanzi = parts[0] || '';
            const pinyin = parts[1] || undefined;
            const meaningVi = parts[2] || undefined;

            if (hanzi) {
                subtitles.push({
                    sequenceOrder,
                    startTime,
                    endTime,
                    hanzi,
                    pinyin,
                    meaningVi,
                });
            }
            continue;
        }

        // Line 3 (index 2) is always Chinese (hanzi)
        const hanzi = lines[2]?.trim() || '';

        let pinyin: string | undefined;
        let meaningVi: string | undefined;

        if (lines.length === 4) {
            // Only 2 text lines: Chinese + one other
            const secondLine = lines[3]?.trim();
            if (secondLine) {
                if (isVietnamese(secondLine)) {
                    // It's Vietnamese, no pinyin
                    meaningVi = secondLine;
                } else if (isPinyin(secondLine)) {
                    // It's Pinyin, no Vietnamese
                    pinyin = secondLine;
                } else {
                    // Default: assume it's Vietnamese if not clearly pinyin
                    meaningVi = secondLine;
                }
            }
        } else if (lines.length >= 5) {
            // 3 text lines: Chinese + Pinyin + Vietnamese
            const line3 = lines[3]?.trim();
            const line4 = lines[4]?.trim();

            // Auto-detect the order
            if (isVietnamese(line3)) {
                // Line 3 is Vietnamese, line 4 might be pinyin or additional info
                meaningVi = line3;
                pinyin = isPinyin(line4 || '') ? line4 : undefined;
            } else {
                // Standard order: Pinyin then Vietnamese
                pinyin = line3;
                meaningVi = line4;
            }
        }

        if (hanzi) {
            subtitles.push({
                sequenceOrder,
                startTime,
                endTime,
                hanzi,
                pinyin,
                meaningVi,
            });
        }
    }

    return subtitles;
}

/**
 * Parse VTT file content
 * 
 * VTT Format:
 * WEBVTT
 * 
 * 00:00:01.000 --> 00:00:04.000
 * 你好，欢迎学习中文
 */
export function parseVtt(content: string): ParsedSubtitle[] {
    const subtitles: ParsedSubtitle[] = [];
    const lines = content.trim().split('\n');

    // Skip WEBVTT header
    let i = 0;
    while (i < lines.length && !lines[i].includes('-->')) {
        i++;
    }

    let sequenceOrder = 1;

    while (i < lines.length) {
        const timeLine = lines[i];
        if (!timeLine.includes('-->')) {
            i++;
            continue;
        }

        const timeMatch = timeLine.match(/(.+?)\s*-->\s*(.+)/);
        if (!timeMatch) {
            i++;
            continue;
        }

        const startTime = parseVttTimestamp(timeMatch[1].split(' ')[0]);
        const endTime = parseVttTimestamp(timeMatch[2].split(' ')[0]);

        i++;
        let hanzi = '';
        let pinyin: string | undefined;
        let meaningVi: string | undefined;
        let lineCount = 0;

        while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
            const line = lines[i].trim();
            if (lineCount === 0) hanzi = line;
            else if (lineCount === 1) pinyin = line;
            else if (lineCount === 2) meaningVi = line;
            lineCount++;
            i++;
        }

        if (hanzi) {
            subtitles.push({
                sequenceOrder: sequenceOrder++,
                startTime,
                endTime,
                hanzi,
                pinyin,
                meaningVi,
            });
        }
    }

    return subtitles;
}

/**
 * Detect file format and parse accordingly
 */
export function parseSubtitleFile(content: string, filename: string): ParsedSubtitle[] {
    const ext = filename.toLowerCase().split('.').pop();

    if (ext === 'vtt' || content.trim().startsWith('WEBVTT')) {
        return parseVtt(content);
    }

    return parseSrt(content);
}

/**
 * Simple Chinese tokenizer
 * Splits Chinese text into individual characters/words
 * For production, use a proper NLP library like jieba
 */
export function tokenizeChinese(text: string): ParsedToken[] {
    const tokens: ParsedToken[] = [];

    // Simple character-level tokenization
    // In production, use jieba or similar for word segmentation
    const chineseRegex = /[\u4e00-\u9fff]+/g;
    const matches = text.match(chineseRegex);

    if (!matches) return tokens;

    let position = 0;
    for (const match of matches) {
        // Split into individual characters for now
        // Can be enhanced with jieba for proper word segmentation
        for (const char of match) {
            tokens.push({
                position: position++,
                hanzi: char,
            });
        }
    }

    return tokens;
}

export const subtitleParser = {
    parseSrt,
    parseVtt,
    parseSubtitleFile,
    tokenizeChinese,
};

export default subtitleParser;

/**
 * SRT/VTT Subtitle Parser
 * Parses subtitle files and extracts timing + text data
 */

export interface ParsedSubtitle {
  sequenceOrder: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
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
    return (
      minutes * 60 + parseInt(seconds, 10) + parseInt(ms || '0', 10) / 1000
    );
  } else if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const [seconds, ms] = parts[2].split('.');
    return (
      hours * 3600 +
      minutes * 60 +
      parseInt(seconds, 10) +
      parseInt(ms || '0', 10) / 1000
    );
  }

  throw new Error(`Invalid VTT timestamp: ${timestamp}`);
}

/**
 * Check if text looks like Pinyin (romanized Chinese with tone marks or numbers)
 */
function isPinyin(text: string): boolean {
  if (!text) return false;

  // Pinyin tone marks (standard tones 1-4)
  // āáǎà ēéěè īíǐì ōóǒò ūúǔù ǖǘǚǜ
  const pinyinTonePattern = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
  // Or pinyin with tone numbers (ni3 hao3)
  const pinyinNumberPattern = /[a-z]+[1-5]/i;

  // Check if it's primarily Latin-based with tone marks OR tone numbers
  const hasPinyinMarks =
    pinyinTonePattern.test(text) || pinyinNumberPattern.test(text);

  // Strict Latin check including punctuation and common pinyin characters
  // Vietnamese HAS MANY characters NOT in this set (hook tones, dot tones, tilde, unique letters)
  const mostlyLatin =
    /^[a-zA-Z0-9āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s,.\-'!?\"\[\]()|]+$/i.test(text);

  // Heuristic: Pinyin rarely has many words without any marks if it's a long sentence
  // Vietnamese often has words like "cung", "la", "va", "cho" without marks

  return hasPinyinMarks && mostlyLatin;
}

/**
 * Check if text contains uniquely Vietnamese characters
 */
function isVietnamese(text: string): boolean {
  if (!text) return false;
  // Uniquely Vietnamese characters (not shared with Pinyin)
  const uniqueVNPattern =
    /[ảãạăằắẳẵặâầấẩẫậẻẽẹêềếểễệỉĩịỏõọôồốổỗộơờớởỡợủũụưừứửữựỳýỷỹỵđ]/i;
  return uniqueVNPattern.test(text);
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
    // Order is usually: Chinese (Hanzi), Pinyin, Vietnamese (Translation)
    // But some files might skip Pinyin or have multi-line translations

    const contentLines = lines
      .slice(2)
      .map((l) => l.trim())
      .filter((l) => l !== '');
    if (contentLines.length === 0) continue;

    let hanzi = contentLines[0];
    let pinyin: string | undefined;
    const meanings: string[] = [];

    // Check if the first line is the combined format: Hanzi | Pinyin | Translation
    if (hanzi.includes('|')) {
      const parts = hanzi.split('|').map((p) => p.trim());
      hanzi = parts[0];
      if (parts.length > 1) pinyin = parts[1];
      if (parts.length > 2) meanings.push(parts[2]);
      // Any additional lines are also meanings
      meanings.push(...contentLines.slice(1));
    } else {
      // Standard format: Line 1 Hanzi, Line 2 Pinyin (optional), Line 3+ Translation
      if (contentLines.length > 1) {
        const secondLine = contentLines[1];
        if (isPinyin(secondLine) && !isVietnamese(secondLine)) {
          pinyin = secondLine;
          meanings.push(...contentLines.slice(2));
        } else {
          meanings.push(...contentLines.slice(1));
        }
      }
    }

    const meaningVi = meanings.length > 0 ? meanings.join(' ') : undefined;

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
export function parseSubtitleFile(
  content: string,
  filename: string,
): ParsedSubtitle[] {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'vtt' || content.trim().startsWith('WEBVTT')) {
    return parseVtt(content);
  }

  return parseSrt(content);
}

/**
 * Count syllables in a pinyin word
 * Rule: A contiguous block of vowels (possibly with tone marks) = 1 syllable
 */
export function countSyllables(pinyinWord: string): number {
  if (!pinyinWord) return 0;

  // Normalize: remove tone numbers and handle punctuation
  // Also treat 'v' as 'ü' (common in pinyin input)
  const cleanWord = pinyinWord
    .replace(/[0-9]/g, '')
    .replace(/[.,!?;:()\[\]{}'"]/g, '');

  // Vowels including tone-marked ones and 'v'/'V'
  // āáǎà ēéěè īíǐì ōóǒò ūúǔù ǖǘǚǜ
  const vowelPattern = /[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/gi;

  // Handle apostrophes as syllable separators (e.g., xi'an)
  // Actually, splitting by apostrophe First might be better
  const parts = cleanWord.split("'");
  let total = 0;
  for (const part of parts) {
    const matches = part.match(vowelPattern);
    total += matches ? matches.length : 0;
  }

  return total;
}

/**
 * Segment Chinese text based on Pinyin spacing
 * Each pinyin word separated by space corresponds to N hanzi characters
 * where N is the number of syllables in that pinyin word.
 */
export function segmentHanziWithPinyin(
  hanzi: string,
  pinyin: string,
): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  if (!hanzi || !pinyin) return tokens;

  const normalizePinyinWord = (text: string): string =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9vü]/g, '');

  // Split pinyin by spaces (one or more)
  const pinyinWords = pinyin.trim().split(/\s+/);
  const hanziChars = hanzi.trim().split('');

  let hanziIndex = 0;
  let position = 0;

  for (const pWord of pinyinWords) {
    if (hanziIndex >= hanziChars.length) break;

    const syllableCount = countSyllables(pWord);

    // Skip leading non-Chinese characters in Hanzi for this pinyin word
    // Unless this pinyin word itself is punctuation/non-Chinese
    if (syllableCount > 0) {
      while (
        hanziIndex < hanziChars.length &&
        !/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(
          hanziChars[hanziIndex],
        )
      ) {
        const char = hanziChars[hanziIndex];
        if (char.trim() || char === ' ') {
          tokens.push({
            position: position++,
            hanzi: char,
          });
        }
        hanziIndex++;
      }
    }

    // If it's not a pinyin word (e.g. punctuation or English)
    if (syllableCount === 0) {
      // Find an exact match in Hanzi if possible, or just take current char if not Chinese
      if (
        hanziChars[hanziIndex] &&
        !/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(
          hanziChars[hanziIndex],
        )
      ) {
        tokens.push({
          position: position++,
          hanzi: hanziChars[hanziIndex],
          pinyin: pWord,
        });
        hanziIndex++;
      } else if (pWord.match(/[.,!?;:()\[\]'"]/)) {
        // If it's punctuation in pinyin but currently at Chinese char in Hanzi,
        // just add the punctuation as its own token without consuming Hanzi
        tokens.push({
          position: position++,
          hanzi: pWord,
          pinyin: pWord,
        });
      }
      continue;
    }

    // Take N characters from Hanzi where N is syllableCount
    let tokenHanzi = '';
    let charsTaken = 0;

    while (charsTaken < syllableCount && hanziIndex < hanziChars.length) {
      const char = hanziChars[hanziIndex];

      // If we hit non-Chinese char while still needing more hanzi for this pinyin word,
      // we treat the non-Chinese char as a separate token and CONTINUE looking for hanzi
      if (!/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char)) {
        if (char.trim()) {
          tokens.push({
            position: position++,
            hanzi: char,
          });
        }
        hanziIndex++;
        continue;
      }

      tokenHanzi += char;
      charsTaken++;
      hanziIndex++;
    }

    // Handle erhua words: zhèr => 这儿, nàr => 那儿, etc.
    const normalizedPinyin = normalizePinyinWord(pWord);
    const isErhuaWord =
      normalizedPinyin.length > 1 &&
      normalizedPinyin.endsWith('r') &&
      normalizedPinyin !== 'er';

    if (
      isErhuaWord &&
      hanziIndex < hanziChars.length &&
      hanziChars[hanziIndex] === '儿'
    ) {
      tokenHanzi += '儿';
      hanziIndex++;
    }

    if (tokenHanzi) {
      tokens.push({
        position: position++,
        hanzi: tokenHanzi,
        pinyin: pWord,
      });
    }
  }

  // Capture remaining Hanzi characters if any
  while (hanziIndex < hanziChars.length) {
    const char = hanziChars[hanziIndex];
    if (char.trim() || char === ' ') {
      tokens.push({
        position: position++,
        hanzi: char,
      });
    }
    hanziIndex++;
  }

  return tokens;
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
  countSyllables,
  segmentHanziWithPinyin,
};

export default subtitleParser;

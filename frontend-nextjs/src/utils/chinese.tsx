import { POS_COLORS } from "@/constants/vocabulary";
import React from "react";

/**
 * Initialize native Chinese word segmenter
 */
export const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("zh-CN", { granularity: "word" })
    : null;

const CHINESE_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

export interface InteractiveHanziSegment {
  segment: string;
  pinyin?: string;
}

const normalizePinyinWord = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9vü]/g, "");
};

const countSyllables = (pinyinWord: string): number => {
  if (!pinyinWord) return 0;

  const cleanWord = pinyinWord
    .replace(/[0-9]/g, "")
    .replace(/[.,!?;:()\[\]{}"']/g, "");
  const vowelPattern = /[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/gi;

  const parts = cleanWord.split("'");
  let total = 0;
  for (const part of parts) {
    const matches = part.match(vowelPattern);
    total += matches ? matches.length : 0;
  }

  return total;
};

const splitPinyinWords = (pinyin: string): string[] =>
  pinyin
    .replace(/([,.;!?，。！？、])/g, " $1 ")
    .split(/\s+/)
    .filter((s) => s.trim() !== "");

const looksLikeSuspiciousErhuaShift = (tokens: any[]): boolean => {
  return tokens.some((token) => {
    if (!token || token.hanzi !== "儿" || !token.pinyin) return false;
    const normalized = normalizePinyinWord(String(token.pinyin));
    return normalized !== "er" && normalized !== "r";
  });
};

const deriveSegmentsFromPinyin = (
  hanzi: string,
  pinyin: string,
): InteractiveHanziSegment[] => {
  const segments: InteractiveHanziSegment[] = [];
  if (!hanzi) return segments;

  const pinyinWords = splitPinyinWords(pinyin || "");
  const hanziChars = Array.from(hanzi.trim());
  let hanziIndex = 0;

  for (const pWord of pinyinWords) {
    if (hanziIndex >= hanziChars.length) break;

    const syllableCount = countSyllables(pWord);

    if (syllableCount > 0) {
      while (
        hanziIndex < hanziChars.length &&
        !CHINESE_CHAR_RE.test(hanziChars[hanziIndex])
      ) {
        const char = hanziChars[hanziIndex];
        if (char.trim() || char === " ") {
          segments.push({ segment: char });
        }
        hanziIndex++;
      }
    }

    if (syllableCount === 0) {
      if (
        hanziChars[hanziIndex] &&
        !CHINESE_CHAR_RE.test(hanziChars[hanziIndex])
      ) {
        segments.push({ segment: hanziChars[hanziIndex], pinyin: pWord });
        hanziIndex++;
      } else {
        segments.push({ segment: pWord, pinyin: pWord });
      }
      continue;
    }

    let tokenHanzi = "";
    let charsTaken = 0;

    while (charsTaken < syllableCount && hanziIndex < hanziChars.length) {
      const char = hanziChars[hanziIndex];
      if (!CHINESE_CHAR_RE.test(char)) {
        if (char.trim()) {
          segments.push({ segment: char });
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
      normalizedPinyin.endsWith("r") &&
      normalizedPinyin !== "er";

    if (
      isErhuaWord &&
      hanziIndex < hanziChars.length &&
      hanziChars[hanziIndex] === "儿"
    ) {
      tokenHanzi += "儿";
      hanziIndex++;
    }

    if (tokenHanzi) {
      segments.push({ segment: tokenHanzi, pinyin: pWord });
    }
  }

  while (hanziIndex < hanziChars.length) {
    const char = hanziChars[hanziIndex];
    if (char.trim() || char === " ") {
      segments.push({ segment: char });
    }
    hanziIndex++;
  }

  return segments;
};

export const getInteractiveHanziSegments = (
  hanzi: string,
  pinyin?: string,
  tokens?: any[],
): InteractiveHanziSegment[] => {
  if (tokens && tokens.length > 0 && !looksLikeSuspiciousErhuaShift(tokens)) {
    return tokens.map((t) => ({
      segment: t?.hanzi || "",
      pinyin: t?.pinyin || t?.pinyinDisplay || undefined,
    }));
  }

  if (pinyin) {
    return deriveSegmentsFromPinyin(hanzi || "", pinyin);
  }

  if (segmenter && hanzi) {
    return Array.from(segmenter.segment(hanzi)).map((seg) => ({
      segment: seg.segment,
    }));
  }

  return (hanzi || "").split("").map((segment) => ({ segment }));
};

/**
 * Helper to group Pinyin syllables to match Hanzi word segmentation
 * Syllables of a single word will be joined without spaces.
 * Spaces will be kept between distinct words/segments.
 */
export const renderGroupedPinyin = (
  hanzi: string,
  pinyin: string,
  tokens?: any[],
) => {
  if (!pinyin) return pinyin;

  const groupedPinyin = getInteractiveHanziSegments(hanzi, pinyin, tokens)
    .map((seg) => seg.pinyin || seg.segment)
    .filter((part) => part && part.trim().length > 0);

  // Join with space and then clean up spaces before punctuation
  return groupedPinyin
    .join(" ")
    .replace(/\s+([,.;!?，。！？])/g, "$1") // No space before punctuation
    .replace(/([,.;!?，。！？])\s*(?=[,.;!?，。！？])/g, "$1") // No space between consecutive punctuation
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Helper for case-insensitive POS_COLORS lookup
 */
export const getPosColor = (pos: string) => {
  if (!pos) return "text-text-secondary";
  // Find key case-insensitively
  const key = Object.keys(POS_COLORS).find(
    (k) => k.toLowerCase() === pos.toLowerCase(),
  );
  return key ? POS_COLORS[key] : "text-text-secondary";
};

/**
 * Format a Vietnamese meaning line by removing numbering, colorizing POS, and splitting by semicolons
 */
export const renderFormattedMeaning = (text: string) => {
  if (!text) return null;

  // 1. Strip leading number (e.g., "1. ", " 2. ")
  const cleanText = text.replace(/^\s*\d+\.\s*/, "").trim();

  // Helper to render split items
  const renderSplitLines = (content: string) => {
    const parts = content
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length <= 1) return content;

    return (
      <span className="inline-flex flex-col gap-1 align-top text-white">
        {parts.map((part, i) => (
          <span key={i} className="inline-flex items-start">
            <span className="text-white">{part}</span>
          </span>
        ))}
      </span>
    );
  };

  // 2. Look for part of speech at the beginning before a colon
  const match = cleanText.match(/^([^:]+):/);
  if (match) {
    const pos = match[1].trim();
    const meaning = cleanText.substring(match[0].length).trim();
    const colorClass = getPosColor(pos);

    return (
      <span className="inline-flex items-start gap-2">
        <span
          className={`${colorClass} font-bold whitespace-nowrap inline-block min-w-[5.75rem]`}
        >
          {pos}:
        </span>
        <span className="inline-block align-top text-white">
          {renderSplitLines(meaning)}
        </span>
      </span>
    );
  }

  return <span className="text-white">{renderSplitLines(cleanText)}</span>;
};

/**
 * Highlight a specific word/phrase within a sentence
 */
export const highlightWord = (
  text: string,
  target: string,
  className: string = "text-primary font-bold",
) => {
  if (!text || !target) return text;

  // Use regex for case-insensitive matching if it's Pinyin (alphabetic)
  // For Hanzi, exact match is usually better
  const isPinyin = /^[a-zA-Záéíóúüāēīōūǖǎěǐǒǔǚàèìòùǜ\s,.;!?，。！？]+$/.test(
    target,
  );

  // Escape target for regex
  const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedTarget})`, isPinyin ? "gi" : "g");

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === target.toLowerCase() ? (
          <span key={i} className={className}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
};

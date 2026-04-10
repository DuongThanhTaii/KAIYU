import { Injectable, Logger } from '@nestjs/common';

// Internal interface for cc-cedict raw data
interface RawDictionaryEntry {
  traditional: string;
  simplified: string;
  pinyin: string;
  pinyinTones: string;
  definitions: string[];
  partOfSpeech?: string;
}

// Exported interface for API response
export interface DictionaryEntry {
  pinyin: string;
  pinyinDisplay: string;
  definitions: string[];
  definitionsVi?: string[];
  meaningEn: string;
  meaningVi?: string;
  partOfSpeech?: string;
}

export interface LookupResult {
  hanzi: string;
  pinyin: string;
  pinyinDisplay: string;
  definitions: string[];
  definitionsVi?: string[];
  meaningEn: string;
  meaningVi?: string;
  partOfSpeech?: string;
  examples?: string[];
  traditional?: string;
  simplified?: string;
  found: boolean;
  // NEW: All entries with different pronunciations
  allEntries?: DictionaryEntry[];
}

@Injectable()
export class DictionaryService {
  private dictionary: any = null;
  private isLoaded = false;
  private isLoading = false;
  private readonly logger = new Logger(DictionaryService.name);

  constructor() {
    // Lazy loading - don't load dictionary at startup to save memory
    // Dictionary will be loaded on first API call
    this.logger.log('DictionaryService initialized (lazy loading mode)');
  }

  /**
   * Load CC-CEDICT dictionary data (lazy loading)
   */
  private async loadDictionary(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;

    this.isLoading = true;
    try {
      this.logger.log('Loading CC-CEDICT dictionary...');
      // Use Function constructor to create a true ESM import
      // This bypasses TypeScript's CommonJS transpilation of dynamic imports
      const importModule = new Function(
        'specifier',
        'return import(specifier)',
      );
      const cccedict = await importModule('cc-cedict');
      this.dictionary = cccedict.default || cccedict;
      this.isLoaded = true;
      this.logger.log('CC-CEDICT dictionary loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load CC-CEDICT dictionary', error as Error);
      this.isLoaded = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Convert pinyin with tone numbers to pinyin with tone marks
   */
  private convertPinyinToDisplay(pinyin: string): string {
    const toneMarks: Record<string, string[]> = {
      a: ['ā', 'á', 'ǎ', 'à', 'a'],
      e: ['ē', 'é', 'ě', 'è', 'e'],
      i: ['ī', 'í', 'ǐ', 'ì', 'i'],
      o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
      u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
      ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
    };

    // Split into syllables
    const syllables = pinyin.toLowerCase().split(' ');

    return syllables
      .map((syllable) => {
        const toneMatch = syllable.match(/(\d)$/);
        if (!toneMatch) return syllable;

        const tone = parseInt(toneMatch[1]) - 1;
        const base = syllable.replace(/\d$/, '');

        // Find vowel to add tone mark (priority: a, e, ou special case, last vowel)
        let result = base;
        for (const vowel of ['a', 'e', 'ou']) {
          if (base.includes(vowel)) {
            if (vowel === 'ou') {
              result = base.replace('o', toneMarks['o'][tone] || 'o');
            } else {
              result = base.replace(vowel, toneMarks[vowel][tone] || vowel);
            }
            break;
          }
        }

        // Handle ü (often written as v or u: in pinyin)
        result = result.replace('v', 'ü').replace('u:', 'ü');

        return result;
      })
      .join(' ');
  }

  /**
   * Extract part of speech from definitions
   */
  private extractPartOfSpeech(definitions: string[]): string | undefined {
    const posPatterns: Record<string, RegExp> = {
      noun: /^n\.|noun|classifier|measure word/i,
      verb: /^v\.|verb|to\s+\w+/i,
      adjective: /^adj\.|adjective/i,
      adverb: /^adv\.|adverb/i,
      pronoun: /^pron\.|pronoun/i,
      preposition: /^prep\.|preposition/i,
      conjunction: /^conj\.|conjunction/i,
      particle: /particle|modal/i,
      interjection: /interjection|exclamation/i,
    };

    for (const def of definitions) {
      for (const [pos, pattern] of Object.entries(posPatterns)) {
        if (pattern.test(def)) {
          return pos;
        }
      }
    }
    return undefined;
  }

  /**
   * Lookup a single Chinese word/character
   * @param hanzi The Chinese character/word to lookup
   * @param contextPinyin Optional pinyin from video context to prioritize matching entries
   */
  async lookup(hanzi: string, contextPinyin?: string): Promise<LookupResult> {
    if (!this.isLoaded || !this.dictionary) {
      await this.loadDictionary();
    }

    const result: LookupResult = {
      hanzi,
      pinyin: '',
      pinyinDisplay: '',
      definitions: [],
      meaningEn: '',
      found: false,
    };

    try {
      // cc-cedict returns an object: { pinyin: definitions[] } or empty object
      // Use asObject: false to get array format for easier handling
      const entries =
        this.dictionary?.getBySimplified?.(hanzi, null, { asObject: false }) ||
        this.dictionary?.getByTraditional?.(hanzi, null, { asObject: false });

      this.logger.debug(
        `Dictionary lookup for "${hanzi}" returned ${Array.isArray(entries) ? entries.length : 0} entries`,
      );

      if (entries && Array.isArray(entries) && entries.length > 0) {
        // Filter out variant entries for cleaner results
        const mainEntries = entries.filter(
          (e: any) => !e.is_variant && e.simplified === hanzi,
        );
        let entriesToUse = mainEntries.length > 0 ? mainEntries : entries;

        // Sort by context match if contextPinyin provided
        if (contextPinyin) {
          const contextLower = contextPinyin.toLowerCase().replace(/\d/g, ''); // Remove tone numbers
          entriesToUse = entriesToUse.sort((a: any, b: any) => {
            const aPinyin = (a.pinyin || '').toLowerCase().replace(/\d/g, '');
            const bPinyin = (b.pinyin || '').toLowerCase().replace(/\d/g, '');
            const aMatch =
              aPinyin === contextLower || aPinyin.includes(contextLower);
            const bMatch =
              bPinyin === contextLower || bPinyin.includes(contextLower);
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return 0;
          });
        }

        // Use first entry as primary (now context-sorted if provided)
        const entry = entriesToUse[0];
        result.pinyin = entry.pinyin || '';
        result.pinyinDisplay = this.convertPinyinToDisplay(entry.pinyin || '');
        result.definitions = entry.english || [];
        result.meaningEn = result.definitions.slice(0, 3).join('; ');
        result.traditional = entry.traditional;
        result.simplified = entry.simplified;
        result.partOfSpeech = this.extractPartOfSpeech(result.definitions);
        result.found = true;

        // Collect ALL entries with different pronunciations
        const allEntriesMap = new Map<string, DictionaryEntry>();
        for (const e of entriesToUse) {
          const pinyinKey = e.pinyin?.toLowerCase() || '';
          if (!allEntriesMap.has(pinyinKey)) {
            allEntriesMap.set(pinyinKey, {
              pinyin: e.pinyin || '',
              pinyinDisplay: this.convertPinyinToDisplay(e.pinyin || ''),
              definitions: e.english || [],
              meaningEn: (e.english || []).slice(0, 3).join('; '),
              partOfSpeech: this.extractPartOfSpeech(e.english || []),
            });
          }
        }
        result.allEntries = Array.from(allEntriesMap.values());

        // Translate primary entry + all entries IN PARALLEL (fast!)
        const translatePromises: Promise<void>[] = [];

        // Primary entry translation
        translatePromises.push(
          Promise.all([
            this.translateToVietnamese(hanzi),
            this.translateDefinitionsToVietnamese(
              result.definitions.slice(0, 3),
            ),
          ]).then(([meaningVi, definitionsVi]) => {
            result.meaningVi = meaningVi;
            result.definitionsVi = definitionsVi;
            // Also set for first allEntry
            if (result.allEntries && result.allEntries.length > 0) {
              result.allEntries[0].meaningVi = meaningVi;
              result.allEntries[0].definitionsVi = definitionsVi;
            }
          }),
        );

        // Translate other entries (only first 2 definitions each, parallel)
        if (result.allEntries.length > 1) {
          for (let i = 1; i < Math.min(result.allEntries.length, 4); i++) {
            const entryItem = result.allEntries[i];
            translatePromises.push(
              this.translateDefinitionsToVietnamese(
                entryItem.definitions.slice(0, 2),
              ).then((defsVi) => {
                entryItem.definitionsVi = defsVi;
                entryItem.meaningVi = defsVi?.[0] || entryItem.meaningEn;
              }),
            );
          }
        }

        // Wait for all translations (parallel = fast)
        await Promise.all(translatePromises);
      } else if (
        entries &&
        typeof entries === 'object' &&
        Object.keys(entries).length > 0
      ) {
        // Object format: { pinyin: [entry1, entry2, ...] }
        const pinyinKeys = Object.keys(entries);
        if (pinyinKeys.length > 0) {
          const firstPinyin = pinyinKeys[0];
          const firstEntry = entries[firstPinyin]?.[0];
          result.pinyin = firstPinyin;
          result.pinyinDisplay = this.convertPinyinToDisplay(firstPinyin);
          result.definitions = firstEntry?.english || [];
          result.meaningEn = result.definitions.slice(0, 3).join('; ');
          result.partOfSpeech = this.extractPartOfSpeech(result.definitions);
          result.found = true;
        }
      }

      // If not found, try character by character
      if (!result.found) {
        const chars = hanzi.split('');
        const charResults: string[] = [];
        const charPinyin: string[] = [];

        for (const char of chars) {
          const charEntries = this.dictionary?.getBySimplified?.(char, null, {
            asObject: false,
          });
          this.logger.debug(
            `Char lookup for "${char}" returned ${Array.isArray(charEntries) ? charEntries.length : 0} entries`,
          );

          if (
            charEntries &&
            Array.isArray(charEntries) &&
            charEntries.length > 0
          ) {
            charPinyin.push(charEntries[0].pinyin || '');
            charResults.push(charEntries[0].english?.[0] || '');
          } else if (
            charEntries &&
            typeof charEntries === 'object' &&
            Object.keys(charEntries).length > 0
          ) {
            const pinyinKey = Object.keys(charEntries)[0];
            const firstEntry = charEntries[pinyinKey]?.[0];
            charPinyin.push(pinyinKey);
            charResults.push(firstEntry?.english?.[0] || '');
          }
        }

        if (charResults.length > 0 && charResults.some((r) => r !== '')) {
          result.pinyin = charPinyin.join(' ');
          result.pinyinDisplay = this.convertPinyinToDisplay(
            charPinyin.join(' '),
          );
          result.definitions = charResults.filter((r) => r !== '');
          result.meaningEn = result.definitions.join('; ');
          result.found = true;
        }
      }
    } catch (error) {
      this.logger.error('Dictionary lookup error', error as Error);
    }

    return result;
  }

  /**
   * Search for words by pinyin or partial match
   */
  async search(query: string, limit = 20): Promise<LookupResult[]> {
    if (!this.isLoaded || !this.dictionary) {
      await this.loadDictionary();
    }

    const results: LookupResult[] = [];

    try {
      // Try by pinyin
      const entries = this.dictionary?.getByPinyin?.(query) || [];

      for (const entry of entries.slice(0, limit)) {
        results.push({
          hanzi: entry.simplified || entry.traditional,
          pinyin: entry.pinyin || '',
          pinyinDisplay: this.convertPinyinToDisplay(entry.pinyin || ''),
          definitions: entry.english || entry.definitions || [],
          meaningEn: (entry.english || entry.definitions || [])
            .slice(0, 3)
            .join('; '),
          traditional: entry.traditional,
          simplified: entry.simplified,
          partOfSpeech: this.extractPartOfSpeech(
            entry.english || entry.definitions || [],
          ),
          found: true,
        });
      }
    } catch (error) {
      this.logger.error('Dictionary search error', error as Error);
    }

    return results;
  }

  /**
   * Get example sentences for a word from Tatoeba API
   * Returns sentences in Chinese with English/Vietnamese translations
   */
  async getExamples(
    hanzi: string,
  ): Promise<{ chinese: string; pinyin?: string; translation: string }[]> {
    const examples: {
      chinese: string;
      pinyin?: string;
      translation: string;
    }[] = [];

    try {
      // Tatoeba API - search for Chinese sentences containing the word
      const url = `https://api.tatoeba.org/unstable/sentences?lang=cmn&query=${encodeURIComponent(hanzi)}&trans=vie,eng&limit=5`;

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Tatoeba API error: ${response.status}`);
        return examples;
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        for (const sentence of data.data.slice(0, 3)) {
          const example: {
            chinese: string;
            pinyin?: string;
            translation: string;
          } = {
            chinese: sentence.text || '',
            translation: '',
          };

          // Get translation (prefer Vietnamese, fallback to English)
          if (sentence.translations && Array.isArray(sentence.translations)) {
            for (const transGroup of sentence.translations) {
              if (Array.isArray(transGroup)) {
                // Try Vietnamese first
                const vieTrans = transGroup.find((t: any) => t.lang === 'vie');
                if (vieTrans) {
                  example.translation = vieTrans.text;
                  break;
                }
                // Fallback to English
                const engTrans = transGroup.find((t: any) => t.lang === 'eng');
                if (engTrans) {
                  example.translation = engTrans.text;
                }
              }
            }
          }

          if (example.chinese && example.translation) {
            examples.push(example);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to fetch examples from Tatoeba',
        error as Error,
      );
    }

    return examples;
  }

  /**
   * Translate Chinese text to Vietnamese using Google Translate API
   */
  private async translateToVietnamese(
    text: string,
  ): Promise<string | undefined> {
    try {
      // Using Google Translate free API
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Google Translate API error: ${response.status}`);
        return undefined;
      }

      const data = await response.json();

      // Response format: [[["translation", "original", ...], ...], ...]
      if (data && data[0] && Array.isArray(data[0])) {
        const translations = data[0]
          .filter((item: any) => item && item[0])
          .map((item: any) => item[0])
          .join('');
        return translations || undefined;
      }

      return undefined;
    } catch (error) {
      this.logger.error('Failed to translate to Vietnamese', error as Error);
      return undefined;
    }
  }

  /**
   * Translate an array of English definitions to Vietnamese
   */
  private async translateDefinitionsToVietnamese(
    definitions: string[],
  ): Promise<string[]> {
    if (!definitions || definitions.length === 0) return [];

    try {
      const translatedDefs: string[] = [];

      // Clean and filter definitions - take only the most meaningful ones
      const cleanedDefs = definitions
        .slice(0, 3) // Limit to 3 definitions
        .map((def) => this.cleanDefinition(def))
        .filter((def) => def.length > 2 && def.length < 100); // Filter out very short or very long

      for (const def of cleanedDefs) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(def)}`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        if (data && data[0] && Array.isArray(data[0])) {
          const translation = data[0]
            .filter((item: any) => item && item[0])
            .map((item: any) => item[0])
            .join('');
          if (translation && translation.length > 1) {
            translatedDefs.push(translation);
          }
        }
      }

      return translatedDefs;
    } catch (error) {
      console.error('Failed to translate definitions:', error);
      return [];
    }
  }

  /**
   * Clean up a definition for better translation
   */
  private cleanDefinition(def: string): string {
    return (
      def
        // Remove linguistic notation
        .replace(/\([^)]*\)/g, '') // Remove parenthetical notes
        .replace(/\[[^\]]*\]/g, '') // Remove bracketed notes
        .replace(/~/g, '') // Remove tilde
        .replace(/;.*$/, '') // Keep only first meaning before semicolon
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
    );
  }

  /**
   * Check if dictionary is loaded
   */
  isDictionaryLoaded(): boolean {
    return this.isLoaded;
  }
}

import { GlossaryItem, ReferenceItem } from '../types';

/**
 * Normalizes text for matching across CJK (Chinese/Japanese/Korean) and Latin scripts.
 * Strips punctuation and converts Latin to lower case.
 */
const cleanKeywordCache = new Map<string, string>();

export function cleanSearchKeyword(term: string): string {
  const cached = cleanKeywordCache.get(term);
  if (cached !== undefined) return cached;

  const cleaned = term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf\uac00-\ud7af]/gu, '')
    .trim();

  if (cleanKeywordCache.size < 2000) {
    cleanKeywordCache.set(term, cleaned);
  }
  return cleaned;
}

/**
 * Extracts sub-terms from a glossary term string.
 * Retained for backwards compatibility.
 */
export function getKeywordsFromTerm(termStr: string): string[] {
  const parts = termStr.split(/[\/\(\)\|\,\;\:\-]/);
  const keywords: string[] = [];

  for (const part of parts) {
    const cleaned = cleanSearchKeyword(part);
    if (cleaned.length > 0) {
      keywords.push(cleaned);
    }
  }

  // Also include the whole cleaned term if it was split
  const fullCleaned = cleanSearchKeyword(termStr);
  if (fullCleaned.length > 0 && !keywords.includes(fullCleaned)) {
    keywords.push(fullCleaned);
  }

  return keywords;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KATAKANA_CHAR_REGEX = /[\u30A0-\u30FF\u30FC\u30FB]/;
const KANJI_CHAR_REGEX = /[\u4E00-\u9FA5\u3400-\u4DBF\u3005]/;
const PURE_KATAKANA_REGEX = /^[\u30A0-\u30FF\u30FC\u30FB]+$/;
const PURE_CJK_REGEX = /^[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf\uac00-\ud7af\u3005]+$/;
/**
 * Returns candidate sub-keywords for matching a glossary/reference term against chapter text.
 * 1. Original term (trimmed) as the FIRST entry (whole-term match is preferred).
 * 2. For terms containing a language alternation separator (/ ( |), additionally returns each side trimmed.
 * 3. Does NOT split on space for Latin portions (prevents noisy sub-words from over-matching).
 */
const keywordsCache = new Map<string, string[]>();

export function getKeywordsForMatching(termStr: string): string[] {
  if (!termStr || !termStr.trim()) return [];

  const cached = keywordsCache.get(termStr);
  if (cached) return cached;

  const candidates: string[] = [];
  const rawTrimmed = termStr.trim();
  if (rawTrimmed.length > 0) {
    candidates.push(rawTrimmed);
  }

  // Check for language alternation separators
  if (/[\/\(\|]/.test(termStr)) {
    const parts = termStr.split(/[\/\(\|]/);
    for (const part of parts) {
      const cleanedPart = part.replace(/\)/g, '').trim();
      if (cleanedPart.length > 0 && !candidates.includes(cleanedPart)) {
        candidates.push(cleanedPart);
      }
    }
  }

  if (keywordsCache.size < 2000) {
    keywordsCache.set(termStr, candidates);
  }

  return candidates;
}

/**
 * Checks if a candidate keyword/term matches within lowerText.
 * - For pure CJK candidates: uses substring includes without word boundary.
 * - For Latin / mixed / Unicode terms: uses Unicode-aware word boundary lookarounds.
 * - Accepts length >= 1 for CJK, length >= 2 for Latin, and length === 1 for Latin Unicode letters.
 */
const WORD_CHAR_UNICODE_REGEX = /[\p{L}\p{N}]/u;
const UNICODE_LETTER_REGEX = /\p{L}/u;

function isWordCharCode(code: number): boolean {
  if (code === 0) return false;
  if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return true;
  if (code < 128) return false;
  // Fast path common CJK unified ideographs, Extension A, Kana, and Hangul
  if (
    (code >= 0x4e00 && code <= 0x9fa5) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x3400 && code <= 0x4dbf)
  ) {
    return true;
  }
  return WORD_CHAR_UNICODE_REGEX.test(String.fromCharCode(code));
}

function isWordChar(char: string): boolean {
  if (!char) return false;
  return isWordCharCode(char.charCodeAt(0));
}

export interface MatchSpan {
  start: number;
  end: number;
}

interface ParsedCandidate {
  raw: string;
  lower: string;
  isPureCJK: boolean;
  isPureKatakana: boolean;
  isSingleKanji: boolean;
  canMatchLatin: boolean;
  len: number;
}

const parsedCandidatesCache = new Map<string, ParsedCandidate[]>();

function getParsedCandidates(termStr: string): ParsedCandidate[] {
  if (!termStr || !termStr.trim()) return [];

  const cached = parsedCandidatesCache.get(termStr);
  if (cached) return cached;

  const rawCandidates = getKeywordsForMatching(termStr);
  const parsed: ParsedCandidate[] = rawCandidates.map((cand) => {
    const lower = cand.toLowerCase();
    const isPureCJK = PURE_CJK_REGEX.test(cand);
    const isPureKatakana = PURE_KATAKANA_REGEX.test(cand);
    const isSingleKanji = cand.length === 1 && KANJI_CHAR_REGEX.test(cand);
    const len = lower.length;
    const canMatchLatin = !isPureCJK && (len >= 2 || (len === 1 && UNICODE_LETTER_REGEX.test(lower)));
    return {
      raw: cand,
      lower,
      isPureCJK,
      isPureKatakana,
      isSingleKanji,
      canMatchLatin,
      len,
    };
  });

  if (parsedCandidatesCache.size < 2000) {
    parsedCandidatesCache.set(termStr, parsed);
  }
  return parsed;
}

export function findCandidateSpans(cand: ParsedCandidate, text: string, lowerText: string): MatchSpan[] {
  const spans: MatchSpan[] = [];
  const candLen = cand.len;
  const textLen = text.length;
  const isJapaneseText = /[\u3040-\u309F]/.test(text);

  let pos = lowerText.indexOf(cand.lower);
  while (pos !== -1) {
    const end = pos + candLen;
    const prevChar = pos > 0 ? text[pos - 1] : '';
    const nextChar = end < textLen ? text[end] : '';

    let valid = true;

    // 1. Katakana Word Boundary:
    // Pure Katakana loanword/name must not be embedded in a longer Katakana word
    // e.g. "ダン" or "ジョン" inside "ダンジョン", "リン" inside "プリン"
    if (cand.isPureKatakana) {
      if (KATAKANA_CHAR_REGEX.test(prevChar) || KATAKANA_CHAR_REGEX.test(nextChar)) {
        valid = false;
      }
    }
    // 2. Single Kanji Standalone Rule:
    // In Japanese text (indicated by Hiragana), single Kanji cannot be embedded inside another Kanji compound (like 面 in 面々 or 真面目)
    // and cannot form a verb conjugation (like 面する, 面した)
    else if (cand.isSingleKanji) {
      if (isJapaneseText) {
        if (KANJI_CHAR_REGEX.test(prevChar) || KANJI_CHAR_REGEX.test(nextChar)) {
          valid = false;
        }
      }
      if (valid && (nextChar === 'す' || nextChar === 'し' || nextChar === 'さ')) {
        const nextTwo = text.slice(end, end + 2);
        if (/^(する|した|して|され|す$)/.test(nextTwo)) {
          valid = false;
        }
      }
    }
    // 3. Latin / Mixed / Unicode Word Boundary:
    else if (cand.canMatchLatin) {
      const prevCode = pos > 0 ? lowerText.charCodeAt(pos - 1) : 0;
      const nextCode = end < textLen ? lowerText.charCodeAt(end) : 0;
      if (isWordCharCode(prevCode) || isWordCharCode(nextCode)) {
        valid = false;
      }
    }

    // 4. Mixed Script / Okurigana verb stem rule (e.g. 突き in 突き立てる)
    if (valid && cand.raw.endsWith('き') && KANJI_CHAR_REGEX.test(nextChar)) {
      valid = false;
    }

    if (valid) {
      spans.push({ start: pos, end });
    }

    pos = lowerText.indexOf(cand.lower, pos + 1);
  }

  return spans;
}

export function isCandidateMatching(candidate: string, text: string): boolean {
  if (!candidate || !text) return false;
  const parsed = getParsedCandidates(candidate);
  if (parsed.length === 0) return false;
  const lowerText = text.toLowerCase();
  for (let i = 0; i < parsed.length; i++) {
    const spans = findCandidateSpans(parsed[i], text, lowerText);
    if (spans.length > 0) return true;
  }
  return false;
}

/**
 * Filter glossaries to only include items whose original term (or part of it)
 * appears in the original chapter text.
 *
 * Applies:
 * 1. Strict script-aware word boundaries (CJK, Katakana, Latin).
 * 2. Subsumption deduplication: shorter terms completely subsumed by longer
 *    entities with no independent occurrences are filtered out.
 */
export function filterRelevantGlossaries(
  text: string,
  glossaries: GlossaryItem[]
): GlossaryItem[] {
  if (!text || !text.trim() || !glossaries || glossaries.length === 0) {
    return [];
  }

  const lowerText = text.toLowerCase();

  // 0. Deduplicate input glossaries by normalized original term (istilah_asli)
  // If the same original term appears multiple times with different translations,
  // strictly preserve the one that was saved earlier (lower index in stored array).
  const seenOriginalKeys = new Set<string>();
  const deduplicatedGlossaries: GlossaryItem[] = [];

  for (let g = 0; g < glossaries.length; g++) {
    const item = glossaries[g];
    const key = (item.istilah_asli || '').trim().toLowerCase();
    if (!key) continue;
    if (!seenOriginalKeys.has(key)) {
      seenOriginalKeys.add(key);
      deduplicatedGlossaries.push(item);
    }
  }

  // 1. Collect all match spans for each deduplicated glossary item
  interface MatchedGlossaryEntry {
    item: GlossaryItem;
    maxTermLen: number;
    spans: MatchSpan[];
  }

  const matchedEntries: MatchedGlossaryEntry[] = [];

  for (let g = 0; g < deduplicatedGlossaries.length; g++) {
    const item = deduplicatedGlossaries[g];
    const candidates = getParsedCandidates(item.istilah_asli);
    const itemSpans: MatchSpan[] = [];
    let maxTermLen = 0;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const spans = findCandidateSpans(cand, text, lowerText);
      if (spans.length > 0) {
        itemSpans.push(...spans);
        if (cand.len > maxTermLen) maxTermLen = cand.len;
      }
    }

    if (itemSpans.length > 0) {
      matchedEntries.push({ item, maxTermLen, spans: itemSpans });
    }
  }

  // 2. Sort matched entries by candidate length descending (longest match first)
  matchedEntries.sort((a, b) => b.maxTermLen - a.maxTermLen);

  // 3. Subsumption Deduplication & Unique Injected Term Enforcement:
  // An item is only injected if it has at least 1 independent occurrence
  // that is NOT wholly contained within an already-accepted longer entity match,
  // and its original term has not already been injected.
  const acceptedSpans: MatchSpan[] = [];
  const seenInjectedKeys = new Set<string>();
  const result: GlossaryItem[] = [];

  for (let i = 0; i < matchedEntries.length; i++) {
    const entry = matchedEntries[i];
    const termKey = (entry.item.istilah_asli || '').trim().toLowerCase();
    if (seenInjectedKeys.has(termKey)) continue;

    let hasIndependentOccurrence = false;

    for (let s = 0; s < entry.spans.length; s++) {
      const span = entry.spans[s];
      const isSubsumed = acceptedSpans.some(
        (longer) => span.start >= longer.start && span.end <= longer.end
      );
      if (!isSubsumed) {
        hasIndependentOccurrence = true;
        break;
      }
    }

    if (hasIndependentOccurrence) {
      seenInjectedKeys.add(termKey);
      result.push(entry.item);
      acceptedSpans.push(...entry.spans);
    }
  }

  return result;
}

/**
 * Filter references to only include items relevant to the text.
 * Always keeps 'Gaya Bahasa' and 'Sinopsis' items, while filtering
 * 'Karakter', 'Tempat', 'Lore', and 'Item' based on name/description matches.
 */
export function filterRelevantReferences(
  text: string,
  references: ReferenceItem[]
): ReferenceItem[] {
  if (!text || !text.trim() || !references || references.length === 0) {
    return [];
  }

  const lowerText = text.toLowerCase();
  const matchedEntries: { item: ReferenceItem; maxTermLen: number; spans: MatchSpan[] }[] = [];
  const alwaysIncluded: ReferenceItem[] = [];

  for (let r = 0; r < references.length; r++) {
    const item = references[r];
    // Always include global style or general synopsis rules
    if (
      item.kategori === 'Gaya Bahasa' ||
      item.nama_item.toLowerCase().includes('gaya') ||
      item.nama_item.toLowerCase().includes('sinopsis') ||
      item.nama_item.toLowerCase().includes('tone')
    ) {
      alwaysIncluded.push(item);
      continue;
    }

    const candidates = getParsedCandidates(item.nama_item);
    const itemSpans: MatchSpan[] = [];
    let maxTermLen = 0;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const spans = findCandidateSpans(cand, text, lowerText);
      if (spans.length > 0) {
        itemSpans.push(...spans);
        if (cand.len > maxTermLen) maxTermLen = cand.len;
      }
    }

    if (itemSpans.length > 0) {
      matchedEntries.push({ item, maxTermLen, spans: itemSpans });
    }
  }

  matchedEntries.sort((a, b) => b.maxTermLen - a.maxTermLen);

  const acceptedSpans: MatchSpan[] = [];
  const filteredReferences: ReferenceItem[] = [];

  for (let i = 0; i < matchedEntries.length; i++) {
    const entry = matchedEntries[i];
    let hasIndependentOccurrence = false;

    for (let s = 0; s < entry.spans.length; s++) {
      const span = entry.spans[s];
      const isSubsumed = acceptedSpans.some(
        (longer) => span.start >= longer.start && span.end <= longer.end
      );
      if (!isSubsumed) {
        hasIndependentOccurrence = true;
        break;
      }
    }

    if (hasIndependentOccurrence) {
      filteredReferences.push(entry.item);
      acceptedSpans.push(...entry.spans);
    }
  }

  return [...alwaysIncluded, ...filteredReferences];
}

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

const PURE_CJK_REGEX = /^[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf\uac00-\ud7af]+$/;

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

interface ParsedCandidate {
  raw: string;
  lower: string;
  isPureCJK: boolean;
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
    const len = lower.length;
    const canMatchLatin = !isPureCJK && (len >= 2 || (len === 1 && UNICODE_LETTER_REGEX.test(lower)));
    return {
      raw: cand,
      lower,
      isPureCJK,
      canMatchLatin,
      len,
    };
  });

  if (parsedCandidatesCache.size < 2000) {
    parsedCandidatesCache.set(termStr, parsed);
  }
  return parsed;
}

function isParsedCandidateMatching(cand: ParsedCandidate, lowerText: string): boolean {
  const firstPos = lowerText.indexOf(cand.lower);
  if (firstPos === -1) return false;

  // Pure CJK (or Hangul/Kana): substring match is sufficient and correct
  if (cand.isPureCJK) {
    return true;
  }

  // Latin / Mixed / Unicode terms: check Unicode-aware word boundary without compiling regex
  if (cand.canMatchLatin) {
    const textLen = lowerText.length;
    let pos = firstPos;
    while (pos !== -1) {
      const prevCode = pos > 0 ? lowerText.charCodeAt(pos - 1) : 0;
      if (!isWordCharCode(prevCode)) {
        const nextCode = pos + cand.len < textLen ? lowerText.charCodeAt(pos + cand.len) : 0;
        if (!isWordCharCode(nextCode)) {
          return true;
        }
      }
      pos = lowerText.indexOf(cand.lower, pos + 1);
    }
  }

  return false;
}

function isCandidateMatching(candidate: string, lowerText: string): boolean {
  if (!candidate || !lowerText) return false;
  const parsed = getParsedCandidates(candidate);
  if (parsed.length > 0) {
    return isParsedCandidateMatching(parsed[0], lowerText);
  }
  return false;
}

/**
 * Filter glossaries to only include items whose original term (or part of it)
 * appears in the original chapter text.
 */
export function filterRelevantGlossaries(
  text: string,
  glossaries: GlossaryItem[]
): GlossaryItem[] {
  if (!text || !text.trim() || !glossaries || glossaries.length === 0) {
    return [];
  }

  const lowerText = text.toLowerCase();
  const matched: GlossaryItem[] = [];

  for (let g = 0; g < glossaries.length; g++) {
    const item = glossaries[g];
    const candidates = getParsedCandidates(item.istilah_asli);
    for (let i = 0; i < candidates.length; i++) {
      if (isParsedCandidateMatching(candidates[i], lowerText)) {
        matched.push(item);
        break;
      }
    }
  }

  return matched;
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

  const matched: ReferenceItem[] = [];

  for (let r = 0; r < references.length; r++) {
    const item = references[r];
    // Always include global style or general synopsis rules
    if (
      item.kategori === 'Gaya Bahasa' ||
      item.nama_item.toLowerCase().includes('gaya') ||
      item.nama_item.toLowerCase().includes('sinopsis') ||
      item.nama_item.toLowerCase().includes('tone')
    ) {
      matched.push(item);
      continue;
    }

    // Check item name using candidates matching
    const candidates = getParsedCandidates(item.nama_item);
    for (let i = 0; i < candidates.length; i++) {
      if (isParsedCandidateMatching(candidates[i], lowerText)) {
        matched.push(item);
        break;
      }
    }
  }

  return matched;
}

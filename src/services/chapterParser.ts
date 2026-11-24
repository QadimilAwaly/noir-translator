/**
 * Parse chapter number from filename with strict rules.
 * Returns null if filename doesn't carry a recognizable chapter number.
 * Accepts:
 *   Chapter_00.md, Chapter_0.md, 0.md (Chapter 0 / prologue)
 *   Chapter_01.md, Chapter-1.md, Chapter 12.md, chap_5.md, Bab_03.md
 *   Chapter_1.5.md, Chapter_01.5.md, Bab_0.5.md, 1.5.md (decimal extra chapters)
 *   01.md, 1.txt (entire filename is digits + extension)
 * Rejects (returns null):
 *   Chapter_Epilogue_2024.md (year digits not preceded by chapter prefix)
 *   Notes_v3.md (no chapter prefix; the 3 is not the chapter)
 *   Appendix_Backup_20231225.txt (date-like number, no chapter prefix)
 */
const EXT_REGEX = /\.(md|txt)$/i;
const NUMBER_PATTERN = '\\d{1,5}(?:\\.\\d{1,4})?';
const PREFIX_REGEX = new RegExp(`(?:^|[_\-\\s])(?:Chapter|chap|Bab|bab|Episode|Ep|Ch)[_\\-\\s]*(${NUMBER_PATTERN})(?:[_\-\\s].*)?$`, 'i');
const NUMBER_ONLY_REGEX = new RegExp(`^${NUMBER_PATTERN}$`);
const TRAILING_NUMBER_REGEX = new RegExp(`(?:^|[_\-\\s])(${NUMBER_PATTERN})$`);
const extractChapterCache = new Map<string, number | null>();

export function extractChapterNumber(filename: string): number | null {
  if (!filename) return null;
  const cached = extractChapterCache.get(filename);
  if (cached !== undefined) return cached;

  // Strip extension
  const base = filename.replace(EXT_REGEX, '');

  let result: number | null = null;

  // Strategy 1: explicit chapter prefix (Chapter|chap|Bab|bab|Episode|Ep|Ch) followed by number
  const prefixMatch = base.match(PREFIX_REGEX);
  if (prefixMatch) {
    const n = parseFloat(prefixMatch[1]);
    if (!isNaN(n) && n >= 0 && n <= 99999) result = n;
  } else if (NUMBER_ONLY_REGEX.test(base)) {
    // Strategy 2: filename is entirely number (e.g. 0.md, 01.md, 1.5.txt)
    const n = parseFloat(base);
    if (!isNaN(n) && n >= 0 && n <= 99999) result = n;
  } else {
    // Strategy 3: trailing number preceded by delimiter (e.g. "Title_1.txt", "Title_0.md", "Novel-12.txt")
    const trailingMatch = base.match(TRAILING_NUMBER_REGEX);
    if (trailingMatch) {
      // Reject version tags (e.g. v3, ver1)
      if (!/[vV](?:er)?\d+$/.test(base)) {
        const n = parseFloat(trailingMatch[1]);
        // Reject 4-digit years (1950-2099) and >= 8-digit timestamps (e.g. 20231225)
        const isYear = n >= 1950 && n <= 2099 && String(n).length === 4;
        const isTimestamp = String(n).length >= 8;
        if (!isYear && !isTimestamp && !isNaN(n) && n >= 0 && n <= 99999) {
          result = n;
        }
      }
    }
  }

  if (extractChapterCache.size < 2000) {
    extractChapterCache.set(filename, result);
  }
  return result;
}

/**
 * Format chapter number for consistent and sortable file naming.
 * - 0 -> '00' (Chapter_00.md)
 * - 1 -> '01' (Chapter_01.md)
 * - 0.5 -> '00.5' (Chapter_00.5.md)
 * - 1.5 -> '01.5' (Chapter_01.5.md)
 * - 12 -> '12' (Chapter_12.md)
 * - 12.1 -> '12.1' (Chapter_12.1.md)
 */
export function formatChapterFilenameNumber(num: number): string {
  const n = isNaN(num) ? 0 : num;
  const isDecimal = !Number.isInteger(n);
  if (isDecimal) {
    const intPart = Math.floor(n);
    const decPart = String(n).slice(String(intPart).length);
    const paddedInt = intPart < 10 ? '0' + intPart : String(intPart);
    return paddedInt + decPart;
  }
  return n < 10 ? '0' + n : String(n);
}

/**
 * Robust numeric comparator for sorting chapters.
 * Correctly orders 0 before 1, and decimal extra chapters (e.g. 1, 1.5, 2).
 */
export function compareChapterNumbers(a: number | string | undefined, b: number | string | undefined): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  const numA = typeof a === 'number' ? a : parseFloat(String(a ?? 0));
  const numB = typeof b === 'number' ? b : parseFloat(String(b ?? 0));
  const validA = isNaN(numA) ? 0 : numA;
  const validB = isNaN(numB) ? 0 : numB;
  return validA - validB;
}

/**
 * Extracts generated chapter title from translated text and sanitizes any stray or hallucinated tags
 * such as [JUDUL_BAB: ...], [JUDUL_NOVEL]...[/JUDUL_NOVEL], or BBCode/XML tags.
 */
export function extractAndSanitizeChapterTitle(rawText: string): { cleanedText: string; suggestedTitle?: string } {
  let text = (rawText || '').trim();
  let suggestedTitle: string | undefined;

  // 1. Standard format: [JUDUL_BAB: ...] or [CHAPTER_TITLE: ...]
  const standardMatch = text.match(/^\s*\[(?:JUDUL_BAB|CHAPTER_TITLE|TITLE):\s*([^\]\n]+)\]\s*\n?/i);
  if (standardMatch) {
    suggestedTitle = standardMatch[1].trim();
    text = text.slice(standardMatch[0].length).trim();
  }

  // 2. BBCode format: [JUDUL_BAB]...[/JUDUL_BAB]
  if (!suggestedTitle) {
    const bbcodeMatch = text.match(/^\s*\[(?:JUDUL_BAB|CHAPTER_TITLE|TITLE)\]([\s\S]*?)\[\/(?:JUDUL_BAB|CHAPTER_TITLE|TITLE)\]\s*\n?/i);
    if (bbcodeMatch) {
      suggestedTitle = bbcodeMatch[1].trim();
      text = text.slice(bbcodeMatch[0].length).trim();
    }
  }

  // 3. Hallucinated format: [JUDUL_NOVEL]Novel Title[/JUDUL_NOVEL] - Chapter X / Title
  if (!suggestedTitle) {
    const novelTagMatch = text.match(/^\s*\[JUDUL_NOVEL\][\s\S]*?\[\/JUDUL_NOVEL\](?:\s*[-–—:]\s*([^\n]+))?\s*\n?/i);
    if (novelTagMatch) {
      if (novelTagMatch[1] && novelTagMatch[1].trim()) {
        suggestedTitle = novelTagMatch[1].trim();
      }
      text = text.slice(novelTagMatch[0].length).trim();
    }
  }

  // 4. Catch-all: strip any remaining stray meta tags at the start of the text
  text = text.replace(/^\s*\[\/?(?:JUDUL_NOVEL|JUDUL_BAB|CHAPTER_TITLE|TITLE)[^\]]*\]\s*\n?/gi, '').trim();

  return { cleanedText: text, suggestedTitle };
}

export const UNTRANSLATED_PLACEHOLDER = '*(Belum diterjemahkan)*';

export function sanitizeTranslatedText(raw: string | undefined | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed === UNTRANSLATED_PLACEHOLDER) {
    return '';
  }
  return trimmed;
}

export function resolveChapterStatus(
  currentStatus: string | undefined,
  translatedText: string | undefined | null
): 'Belum' | 'Sedang' | 'Selesai' {
  const clean = sanitizeTranslatedText(translatedText);
  if (clean.length > 0) {
    return currentStatus === 'Sedang' ? 'Sedang' : 'Selesai';
  }
  return currentStatus === 'Sedang' ? 'Sedang' : 'Belum';
}

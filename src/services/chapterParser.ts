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
const PREFIX_REGEX = new RegExp(`(?:^|[_\-\\s])(?:Chapter|chap|Bab|bab)[_\\-\\s]*(${NUMBER_PATTERN})(?:[_\-\\s].*)?$`, 'i');
const NUMBER_ONLY_REGEX = new RegExp(`^${NUMBER_PATTERN}$`);
const extractChapterCache = new Map<string, number | null>();

export function extractChapterNumber(filename: string): number | null {
  if (!filename) return null;
  const cached = extractChapterCache.get(filename);
  if (cached !== undefined) return cached;

  // Strip extension
  const base = filename.replace(EXT_REGEX, '');

  let result: number | null = null;

  // Strategy 1: explicit chapter prefix (Chapter|chap|Bab|bab) followed by number
  const prefixMatch = base.match(PREFIX_REGEX);
  if (prefixMatch) {
    const n = parseFloat(prefixMatch[1]);
    if (!isNaN(n) && n >= 0 && n <= 99999) result = n;
  } else if (NUMBER_ONLY_REGEX.test(base)) {
    // Strategy 2: filename is entirely number (e.g. 0.md, 01.md, 1.5.txt)
    const n = parseFloat(base);
    if (!isNaN(n) && n >= 0 && n <= 99999) result = n;
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

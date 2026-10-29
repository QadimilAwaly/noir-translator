import { TranslateRequest, ExtractGlossaryRequest, ExtractedTerm, Chapter } from '../types';

let memoryApiToken: string | null = null;

export function setApiToken(token: string | null): void {
  memoryApiToken = token;
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return memoryApiToken ? { ...extra, 'x-api-token': memoryApiToken } : extra;
}

export async function translateChapterApi(reqData: TranslateRequest): Promise<{ translatedText: string; suggestedTitle?: string; promptStats?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(reqData),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Gagal menerjemahkan chapter.' }));
      throw new Error(err.error || 'Terjadi kesalahan saat translasi.');
    }

    return response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Koneksi translasi timeout (3 menit). Silakan periksa koneksi Tailscale/jaringan dan coba lagi.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractGlossaryApi(reqData: ExtractGlossaryRequest): Promise<{ terms: ExtractedTerm[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch('/api/extract-glossary', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(reqData),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Gagal mengekstrak glosarium.' }));
      throw new Error(err.error || 'Terjadi kesalahan saat ekstraksi glosarium.');
    }

    return response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Koneksi ekstraksi glosarium timeout (60 detik). Silakan coba lagi.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSingleChapterApi(
  novelId: string,
  chapterIdOrNum: string | number
): Promise<Chapter | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const params = new URLSearchParams();
      params.set('novel_id', novelId);
      if (typeof chapterIdOrNum === 'number' || /^\d+(\.\d+)?$/.test(String(chapterIdOrNum))) {
        params.set('chapter_number', String(chapterIdOrNum));
      } else {
        params.set('chapter_id', String(chapterIdOrNum));
      }

      const response = await fetch(`/api/chapter?${params.toString()}`, {
        headers: authHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) return null;
      const json = await response.json();
      return json.status === 'success' && json.chapter ? (json.chapter as Chapter) : null;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn('Failed fetching single chapter:', err);
    return null;
  }
}

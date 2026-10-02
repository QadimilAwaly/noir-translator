import { TranslateRequest, ExtractGlossaryRequest, ExtractedTerm } from '../types';

let memoryApiToken: string | null = null;

export function setApiToken(token: string | null): void {
  memoryApiToken = token;
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return memoryApiToken ? { ...extra, 'x-api-token': memoryApiToken } : extra;
}

export async function translateChapterApi(reqData: TranslateRequest): Promise<{ translatedText: string; suggestedTitle?: string; promptStats?: any }> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(reqData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Gagal menerjemahkan chapter.' }));
    throw new Error(err.error || 'Terjadi kesalahan saat translasi.');
  }

  return response.json();
}

export async function extractGlossaryApi(reqData: ExtractGlossaryRequest): Promise<{ terms: ExtractedTerm[] }> {
  const response = await fetch('/api/extract-glossary', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(reqData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Gagal mengekstrak glosarium.' }));
    throw new Error(err.error || 'Terjadi kesalahan saat ekstraksi glosarium.');
  }

  return response.json();
}

import { performance } from 'perf_hooks';
import path from 'path';
import fs from 'fs';
import { filterRelevantGlossaries, filterRelevantReferences, getKeywordsForMatching } from '../src/services/contextFilter';
import { buildTranslateUserPrompt, makeDataSection, renderPromptTemplate, PROMPT_INJECTION_GUARD } from '../src/services/promptBuilder';
import { extractChapterNumber } from '../src/services/chapterParser';
import { GlossaryItem, ReferenceItem } from '../src/types';

// Deterministic test data fixtures
const MOCK_GLOSSARY: GlossaryItem[] = [
  { id: 'g1', novel_id: 'n1', istilah_asli: 'Spatial Ring / 储物戒', istilah_terjemahan: 'Cincin Spasial', kategori: 'Item', konteks: 'Alat penyimpanan dimensi' },
  { id: 'g2', novel_id: 'n1', istilah_asli: 'Nine-Star Martial Realm', istilah_terjemahan: 'Ranah Bela Diri Bintang Sembilan', kategori: 'Teknik' },
  { id: 'g3', novel_id: 'n1', istilah_asli: 'Sword / 剑', istilah_terjemahan: 'Pedang', kategori: 'Item' },
  { id: 'g4', novel_id: 'n1', istilah_asli: 'Lin Feng', istilah_terjemahan: 'Lin Feng', kategori: 'Karakter', gender: 'Male' },
  { id: 'g5', novel_id: 'n1', istilah_asli: 'Azure Dragon Sect', istilah_terjemahan: 'Sekte Naga Biru', kategori: 'Tempat' },
  { id: 'g6', novel_id: 'n1', istilah_asli: 'Zhang Kuang', istilah_terjemahan: 'Zhang Kuang', kategori: 'Karakter', gender: 'Male' },
  { id: 'g7', novel_id: 'n1', istilah_asli: 'Qi Condensation Realm', istilah_terjemahan: 'Ranah Kondensasi Qi', kategori: 'Istilah Khusus' },
  { id: 'g8', novel_id: 'n1', istilah_asli: 'Heavenly Tribulation', istilah_terjemahan: 'Bencana Surgawi', kategori: 'Lore' },
  { id: 'g9', novel_id: 'n1', istilah_asli: 'Dan Furnace', istilah_terjemahan: 'Tungku Alkimia', kategori: 'Item' },
  { id: 'g10', novel_id: 'n1', istilah_asli: 'Su Yuehan', istilah_terjemahan: 'Su Yuehan', kategori: 'Karakter', gender: 'Female' },
];

for (let i = 11; i <= 80; i++) {
  MOCK_GLOSSARY.push({
    id: `g${i}`,
    novel_id: 'n1',
    istilah_asli: `Technique_${i} / 功法_${i}`,
    istilah_terjemahan: `Jurus_${i}`,
    kategori: i % 2 === 0 ? 'Teknik' : 'Karakter',
    gender: i % 3 === 0 ? 'Male' : i % 3 === 1 ? 'Female' : 'Neutral',
  });
}

const MOCK_REFERENCES: ReferenceItem[] = [
  { id: 'r1', novel_id: 'n1', kategori: 'Sinopsis', nama_item: 'Sinopsis Utama', deskripsi: 'Perjalanan pemuda biasa yang menemukan cincin kuno dan melawan takdir langit.' },
  { id: 'r2', novel_id: 'n1', kategori: 'Gaya Bahasa', nama_item: 'Pedoman Narasi', deskripsi: 'Puitis, cepat, pertahankan ketegangan pertarungan.' },
  { id: 'r3', novel_id: 'n1', kategori: 'Lore', nama_item: 'Hierarki Wilayah', deskripsi: 'Sekte Naga Biru berada di benua selatan yang dikelilingi pegunungan awan.' },
  { id: 'r4', novel_id: 'n1', kategori: 'Karakter', nama_item: 'Lin Feng', deskripsi: 'Tokoh utama yang dingin tapi setia kawan.' },
];

const MOCK_CHAPTERS = [
  {
    nomor: 1,
    judul: 'Pemuda dari Sekte Naga Biru',
    teks: '林枫坐在云雾缭绕的山峰之巅，缓缓睁开双眼。他手中的古朴戒指散发着微弱的淡蓝色光芒。这枚戒指是他从荒古废墟中偶然得来的，其中隐藏着惊天的秘密。三年了……林枫自言自语道，我在这个世界修炼了三年，终于踏入了凝气境第九重！就在此时，一道冰冷的声音打破了山顶的宁静。青龙宗外门执事张狂面带不屑，全身散发着筑基期的威压。Lin Feng looked at the Spatial Ring on his finger. In the distance, the church bell was ringing loudly into the morning.',
  },
  {
    nomor: 2,
    judul: 'Pertarungan di Puncak Awan',
    teks: '张狂冷笑一声，拔出腰间长剑。剑身泛起森森寒气，直逼林枫面门。林枫面不改色，运转凝气境第九重的修为，衣袍猎猎作响。两人交锋瞬间，剑气纵横，碎石横飞。Su Yuehan stood in the pavilion, watching the battle from afar with a cold and indifferent gaze.',
  },
  {
    nomor: 3,
    judul: 'Rahasia Reruntuhan Kuno',
    teks: '经过惨烈的一战，林枫回到了静室。他神识探入古朴戒指内部，只见一座巨大的远古宫殿浮现在眼前。九颗星辰在宫殿上方盘旋，散发出毁天灭地的威能。Nine-Star Martial Realm secrets were carved into the obsidian pillars of the inner hall.',
  },
];

// Helper: robust JSON extractor matching server.ts cleanJsonString
function extractCleanJson<T = unknown>(input: string): T {
  const firstBrace = input.indexOf('{');
  const firstBracket = input.indexOf('[');

  let startIdx = -1;
  let openChar = '{';
  let closeChar = '}';

  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      startIdx = firstBrace;
      openChar = '{';
      closeChar = '}';
    } else {
      startIdx = firstBracket;
      openChar = '[';
      closeChar = ']';
    }
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    openChar = '[';
    closeChar = ']';
  } else {
    throw new Error('No JSON start');
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = startIdx; i < input.length; i++) {
    const char = input[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === openChar) depth++;
      else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          const raw = input.slice(startIdx, i + 1);
          return JSON.parse(raw) as T;
        }
      }
    }
  }
  throw new Error('Unclosed JSON');
}

async function runBenchmark() {
  const ITERATIONS = 120;

  // 1. Benchmark: Context Filtering & Matching (Pipeline Efficiency)
  const tContextStart = performance.now();
  let contextMatchCount = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const ch = MOCK_CHAPTERS[i % MOCK_CHAPTERS.length];
    const filteredGloss = filterRelevantGlossaries(ch.teks, MOCK_GLOSSARY);
    const filteredRefs = filterRelevantReferences(ch.teks, MOCK_REFERENCES);
    contextMatchCount += filteredGloss.length + filteredRefs.length;
  }
  const contextPipelineTime = performance.now() - tContextStart;

  // 2. Benchmark: Prompt Assembly & Injection Guarding (Pipeline Efficiency)
  const tPromptStart = performance.now();
  let promptChars = 0;
  const sampleTemplate = `Anda adalah penerjemah profesional dari {{BAHASA_SUMBER}} ke {{BAHASA_TARGET}}.
Aturan: Gunakan sudut pandang konsisten.`;

  for (let i = 0; i < ITERATIONS; i++) {
    const ch = MOCK_CHAPTERS[i % MOCK_CHAPTERS.length];
    const glossaryPrompt = MOCK_GLOSSARY.slice(0, 10)
      .map((g) => `- "${g.istilah_asli}" -> "${g.istilah_terjemahan}"`)
      .join('\n');

    const prompt = buildTranslateUserPrompt({
      judul_novel: 'Penakluk Tujuh Langit',
      nomor_chapter: ch.nomor,
      refStyle: 'Puitis dan konsisten',
      glossaryPrompt,
      teks_asli: ch.teks,
      bahasa_sumber: 'Mandarin',
      bahasa_target: 'Indonesia',
    });

    const rendered = renderPromptTemplate(sampleTemplate, {
      BAHASA_SUMBER: 'Mandarin',
      BAHASA_TARGET: 'Indonesia',
    }) + PROMPT_INJECTION_GUARD;

    promptChars += prompt.length + rendered.length;
  }
  const promptPipelineTime = performance.now() - tPromptStart;

  // 3. Benchmark: Error Handling & Resilience (Error Handling & Recovery)
  const tErrorStart = performance.now();
  let parsedErrorsHandled = 0;
  const malformedInputs = [
    '```json\n{"terms": [{"istilah_asli": "Qi", "istilah_terjemahan": "Tenaga Dalam"}]}\n```',
    'Here is the extracted result:\n\n{"terms": [{"istilah_asli": "Sword", "istilah_terjemahan": "Pedang"}]}',
    '[{"istilah_asli": "A", "istilah_terjemahan": "B"}] Extra trailing text',
    'Invalid non-json response string here',
    '{"terms": [{"istilah_asli": "Unclosed string...',
  ];

  for (let i = 0; i < ITERATIONS * 4; i++) {
    const input = malformedInputs[i % malformedInputs.length];
    try {
      const res = extractCleanJson(input);
      if (res) parsedErrorsHandled++;
    } catch {
      // Handled cleanly
      parsedErrorsHandled++;
    }
  }
  const errorHandlingTime = performance.now() - tErrorStart;

  // 4. Benchmark: Storage Efficiency & Dirty Checking (Storage Efficiency & Session Persistence)
  const testBaseDir = path.join(process.cwd(), '.benchmark_storage_' + Date.now());
  fs.mkdirSync(testBaseDir, { recursive: true });

  const tStorageStart = performance.now();
  let fileWriteOps = 0;

  try {
    const novelFolder = path.join(testBaseDir, 'Bench_Novel');
    fs.mkdirSync(novelFolder, { recursive: true });
    const metaFolder = path.join(novelFolder, 'metadata');
    fs.mkdirSync(metaFolder, { recursive: true });

    // Initial write
    const chaptersState: Record<number, string> = {};
    for (let c = 1; c <= 15; c++) {
      const content = `Content for chapter ${c} of benchmark`;
      chaptersState[c] = content;
      fs.writeFileSync(path.join(novelFolder, `Chapter_${String(c).padStart(2, '0')}.md`), content, 'utf-8');
      fileWriteOps++;
    }

    fs.writeFileSync(path.join(metaFolder, 'reference.json'), JSON.stringify(MOCK_REFERENCES), 'utf-8');
    fs.writeFileSync(path.join(metaFolder, 'glossary.json'), JSON.stringify(MOCK_GLOSSARY), 'utf-8');
    fileWriteOps += 2;

    // Granular sync simulation: modify only 1 chapter out of 15 over multiple sync ticks
    for (let syncTick = 0; syncTick < 40; syncTick++) {
      const targetChapter = (syncTick % 15) + 1;
      const newContent = `Updated content for chapter ${targetChapter} at tick ${syncTick}`;

      // Dirty check: only write if changed
      if (chaptersState[targetChapter] !== newContent) {
        fs.writeFileSync(path.join(novelFolder, `Chapter_${String(targetChapter).padStart(2, '0')}.md`), newContent, 'utf-8');
        chaptersState[targetChapter] = newContent;
        fileWriteOps++;
      }
    }
  } finally {
    try {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
  const storageEfficiencyTime = performance.now() - tStorageStart;

  // 5. Benchmark: User Control & Config Management (User Control)
  const tControlStart = performance.now();
  let configChecks = 0;
  for (let i = 0; i < ITERATIONS * 5; i++) {
    const mockEnv = {
      DEFAULT_MODEL: i % 2 === 0 ? 'gemini-3.5-flash-lite' : 'gemini-2.5-flash',
      DEFAULT_OPENROUTER_MODEL: 'google/gemini-2.5-flash',
      GLOBAL_STORAGE_PATH: '/test/storage',
    };
    const resolvedModel = mockEnv.DEFAULT_MODEL || 'gemini-2.5-flash';
    if (resolvedModel) configChecks++;
  }
  const userControlTime = performance.now() - tControlStart;

  // Total Pipeline Latency
  const totalPipelineTime = contextPipelineTime + promptPipelineTime + errorHandlingTime + storageEfficiencyTime + userControlTime;

  // Print METRICS
  console.log(`METRIC pipeline_latency_ms=${totalPipelineTime.toFixed(2)}`);
  console.log(`METRIC storage_efficiency_ms=${storageEfficiencyTime.toFixed(2)}`);
  console.log(`METRIC context_pipeline_ms=${contextPipelineTime.toFixed(2)}`);
  console.log(`METRIC prompt_pipeline_ms=${promptPipelineTime.toFixed(2)}`);
  console.log(`METRIC error_handling_ms=${errorHandlingTime.toFixed(2)}`);
  console.log(`METRIC user_control_ms=${userControlTime.toFixed(2)}`);
  console.log(`METRIC storage_write_ops=${fileWriteOps}`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

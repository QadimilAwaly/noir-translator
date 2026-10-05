/**
 * Test Suite: Glossary Filtering & Context Matching
 * ===================================================
 * Verifies BUG-02 (over-matching prevention via word-boundary and no space splitting)
 * and BUG-03 (single-character CJK preservation in dual-language entries).
 *
 * Runs via: bun test test/glossary-filter.test.ts
 */

import { test, describe } from 'bun:test';
import assert from 'assert';
import { filterRelevantGlossaries, getKeywordsForMatching, cleanSearchKeyword } from '../src/services/contextFilter';
import { validateGlossaryCandidate, cleanSurroundingBrackets, partitionGlossaryByQuality } from '../src/services/glossaryFilter';
import { GlossaryItem } from '../src/types';

function createMockGlossary(terms: string[]): GlossaryItem[] {
  return terms.map((term, i) => ({
    id: `gloss-${i + 1}`,
    novel_id: 'novel-test',
    istilah_asli: term,
    istilah_terjemahan: `Translation_${i + 1}`,
    kategori: 'Istilah Khusus',
  }));
}

describe('getKeywordsForMatching helper', () => {
  test('should return whole term as first candidate', () => {
    const candidates = getKeywordsForMatching('Spatial Ring / 储物戒');
    assert.equal(candidates[0], 'Spatial Ring / 储物戒');
  });

  test('should split language alternation separators (/, (, |) but NOT space for Latin', () => {
    const candidates = getKeywordsForMatching('Spatial Ring / 储物戒');
    assert.deepEqual(candidates, ['Spatial Ring / 储物戒', 'Spatial Ring', '储物戒']);
  });

  test('should not split on spaces for Latin compound terms without alternation', () => {
    const candidates = getKeywordsForMatching('Nine-Star Martial Realm');
    assert.deepEqual(candidates, ['Nine-Star Martial Realm']);
  });

  test('should handle parenthetical dual terms', () => {
    const candidates = getKeywordsForMatching('Sword (剑)');
    assert.deepEqual(candidates, ['Sword (剑)', 'Sword', '剑']);
  });
});

describe('filterRelevantGlossaries (BUG-02 & BUG-03 Fix Verification)', () => {
  test('BUG-03: Single-character CJK inside dual term ("Sword / 剑") matches chapter containing only 剑', () => {
    const glossaries = createMockGlossary(['Sword / 剑']);
    const chapterText = '他拔出腰间的宝剑，手握剑柄，用剑斩向敌人。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Sword / 剑');
  });

  test('BUG-02: Sub-word inside longer word ("Spatial Ring" vs "ringing") does NOT match', () => {
    const glossaries = createMockGlossary(['Spatial Ring']);
    const chapterText = 'In the distance, the church bell was ringing loudly into the morning.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0, 'Should not match "ringing" when searching for "Spatial Ring"');
  });

  test('Whole-term Latin match ("Spatial Ring") matches properly', () => {
    const glossaries = createMockGlossary(['Spatial Ring']);
    const chapterText = 'He activated his Spatial Ring and stored the pills.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Spatial Ring');
  });

  test('BUG-02: Isolated generic number in compound term ("Nine-Star Martial Realm" vs "nine days") does NOT match', () => {
    const glossaries = createMockGlossary(['Nine-Star Martial Realm']);
    const chapterText = 'Nine days passed in the blink of an eye during his solitary meditation.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0, 'Should not match "nine days" for "Nine-Star Martial Realm"');
  });

  test('Dual-term CJK match ("Nine-Star Martial Realm / 九星武界") matches CJK chapter text', () => {
    const glossaries = createMockGlossary(['Nine-Star Martial Realm / 九星武界']);
    const chapterText = '传闻中，九星武界位于天元大陆的极东之地。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Nine-Star Martial Realm / 九星武界');
  });

  test('BUG-02: Sub-title match ("Elder Liu / 刘长老" vs generic "长老") does NOT match when name is absent', () => {
    const glossaries = createMockGlossary(['Elder Liu / 刘长老']);
    const chapterText = '大殿之中，几位宗门长老请留步，商议明日的大比。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0, 'Should not match generic "长老" when the entry is specifically "Elder Liu / 刘长老"');
  });

  test('BUG-02: Latin partial word boundary ("Lin Feng" vs "linoleum") does NOT match', () => {
    const glossaries = createMockGlossary(['Lin Feng']);
    const chapterText = 'She walked across the shiny linoleum floor in the hallway.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0, 'Should not match "linoleum" when searching for "Lin Feng"');
  });

  test('Regression: Latin whole term ("Lin Feng") matches chapter text', () => {
    const glossaries = createMockGlossary(['Lin Feng']);
    const chapterText = 'Lin Feng walked forward with a calm smile.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Lin Feng');
  });

  test('Regression: Pure CJK term ("储物戒") matches chapter text', () => {
    const glossaries = createMockGlossary(['储物戒']);
    const chapterText = '那枚古朴的储物戒突然发出一道幽光。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, '储物戒');
  });

  test('Mixed parenthetical dual term ("Sword (剑)") matches chapter text containing 剑', () => {
    const glossaries = createMockGlossary(['Sword (剑)']);
    const chapterText = '战士们纷纷拔出手中利剑，使用剑攻击前方的妖兽。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Sword (剑)');
  });

  test('Edge cases: Empty text and empty glossaries return empty array', () => {
    const glossaries = createMockGlossary(['Spatial Ring']);
    assert.deepEqual(filterRelevantGlossaries('', glossaries), []);
    assert.deepEqual(filterRelevantGlossaries('   ', glossaries), []);
    assert.deepEqual(filterRelevantGlossaries('Some chapter text', []), []);
  });
});

describe('cleanSearchKeyword (Step 5 Unicode Widening)', () => {
  test('Preserves accented Latin characters (French, Spanish, German, Portuguese)', () => {
    assert.equal(cleanSearchKeyword('François'), 'françois');
    assert.equal(cleanSearchKeyword('Héloïse'), 'héloïse');
    assert.equal(cleanSearchKeyword('Café'), 'café');
    assert.equal(cleanSearchKeyword('García Señor'), 'garcíaseñor');
    assert.equal(cleanSearchKeyword('König & Straße'), 'königstraße');
  });

  test('Preserves Vietnamese characters with complex diacritics', () => {
    assert.equal(cleanSearchKeyword('Đức'), 'đức');
    assert.equal(cleanSearchKeyword('Hương'), 'hương');
    assert.equal(cleanSearchKeyword('Võ Thuật'), 'võthuật');
    assert.equal(cleanSearchKeyword('Nguyễn'), 'nguyễn');
  });

  test('Preserves CJK Extension A characters', () => {
    assert.equal(cleanSearchKeyword('刘䶮'), '刘䶮'); // U+4DAE in CJK Extension A
    assert.equal(cleanSearchKeyword('㐀'), '㐀'); // U+3400 in CJK Extension A
  });

  test('Strips non-alphanumeric punctuation and symbols', () => {
    assert.equal(cleanSearchKeyword('Spatial Ring / 储物戒! [Rare]'), 'spatialring储物戒rare');
  });
});

describe('filterRelevantGlossaries (Step 5 Unicode & Multilingual Integration)', () => {
  test('Accented Latin: Matches exact accented word ("François")', () => {
    const glossaries = createMockGlossary(['François']);
    const chapterText = 'Le jeune chevalier François tira son épée avec bravoure.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'François');
  });

  test('Accented Latin Negative Sibling: Partial sub-word ("François" vs "Franconville") does NOT match', () => {
    const glossaries = createMockGlossary(['François']);
    const chapterText = 'Ils ont voyagé toute la nuit jusqu au village de Franconville.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0, 'Should not match partial word Franconville');
  });

  test('Accented Latin Word-Boundary: Term ending in accent ("Café") matches standalone word', () => {
    const glossaries = createMockGlossary(['Café']);
    const chapterText = 'Ils sont assis au café près de la fontaine.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Café');
  });

  test('Accented Latin Word-Boundary Negative Sibling: ("Café" vs "Nescafé") does NOT match', () => {
    const glossaries = createMockGlossary(['Café']);
    const chapterText = 'Il commanda une tasse de Nescafé instantané.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0, 'Should not match Nescafé due to Unicode boundary lookaround');
  });

  test('Vietnamese: Term ("Đức") matches exact name in chapter', () => {
    const glossaries = createMockGlossary(['Đức']);
    const chapterText = 'Đại hiệp Đức bước vào chánh điện với khí thế uy nghiêm.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Đức');
  });

  test('Vietnamese Negative Sibling: Chapter without term ("Đức") does NOT match', () => {
    const glossaries = createMockGlossary(['Đức']);
    const chapterText = 'Đoàn người tiến về phía trước trong đêm tối mịt mùng.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0);
  });

  test('Vietnamese Dual-term: ("Hương / Scent") matches Vietnamese text containing Hương', () => {
    const glossaries = createMockGlossary(['Hương / Scent']);
    const chapterText = 'Mùi Hương thoang thoảng của hoa sen ngập tràn khắp sân vườn.';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'Hương / Scent');
  });

  test('CJK Extension A: Term with Extension A char ("刘䶮") matches chapter text', () => {
    const glossaries = createMockGlossary(['刘䶮 / Emperor Liu']);
    const chapterText = '南汉开国皇帝刘䶮御驾亲征，平定四方蛮夷。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, '刘䶮 / Emperor Liu');
  });

  test('CJK Extension A Negative Sibling: Chapter without Extension A char does NOT match', () => {
    const glossaries = createMockGlossary(['刘䶮 / Emperor Liu']);
    const chapterText = '大军凯旋而归，城中百姓夹道欢迎刘备将军。';
    const result = filterRelevantGlossaries(chapterText, glossaries);

    assert.equal(result.length, 0);
  });
});

describe('Japanese False-Positive Prevention & Subsumption Deduplication', () => {
  test('Katakana boundary: Embedded names ("ダン", "ジョン") do NOT match inside "ダンジョン"', () => {
    const glossaries = createMockGlossary(['ダン', 'ジョン']);
    const chapterText = 'アベルは、ダンジョン四十層の出来事を思い出したな。';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 0, 'Should not match "ダン" or "ジョン" embedded inside "ダンジョン"');
  });

  test('Katakana boundary: Standalone name ("ダン") DOES match when delimited by punctuation or particles', () => {
    const glossaries = createMockGlossary(['ダン']);
    const chapterText = 'アベルは叫んだ。「ダン、早く逃げろ！」';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'ダン');
  });

  test('Subsumption deduplication: Shorter term ("ウォータージェット") is omitted when only inside "ウォータージェット256"', () => {
    const glossaries = createMockGlossary(['ウォータージェット', 'ウォータージェット256']);
    const chapterText = 'リョウは声を発した。「＜ウォータージェット256＞」瞬時に敵が倒れた。';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, 'ウォータージェット256');
  });

  test('Subsumption deduplication: Sub-term with independent occurrences ("王都") is retained alongside longer term', () => {
    const glossaries = createMockGlossary(['王都', '第八章　王都騒乱']);
    const chapterText = 'これにて『第八章　王都騒乱』は終了です。王都のルン辺境伯邸はほぼ無事でした。';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 2, 'Both should match because "王都" has an independent occurrence');
  });

  test('Single Kanji compound & verb protection: "面" does NOT match inside "面々", "真面目", or "面する"', () => {
    const glossaries = createMockGlossary(['面']);
    const chapterText = '赤き剣の面々は真面目に取り組んだ。自治庁が面する道路を走った。';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 0, 'Should not match "面" when used in compounds or verb conjugations');
  });

  test('Single Kanji standalone: "門" DOES match when used as standalone noun', () => {
    const glossaries = createMockGlossary(['門']);
    const chapterText = '塀……門があったのであろう場所に到着した。';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 1);
    assert.equal(result[0].istilah_asli, '門');
  });

  test('Mixed script verb stem: "突き" does NOT match inside compound verb "突き立てる"', () => {
    const glossaries = createMockGlossary(['突き']);
    const chapterText = '肩を砕かれて剣を突き立てられているのだから。';
    const result = filterRelevantGlossaries(chapterText, glossaries);
    assert.equal(result.length, 0, 'Should not match "突き" inside compound verb "突き立てる"');
  });
});

describe('Glossary Extraction Noise Filter (Quality Criteria)', () => {
  test('cleanSurroundingBrackets strips Japanese and Latin quote brackets', () => {
    assert.equal(cleanSurroundingBrackets('「ウォータージェット」'), 'ウォータージェット');
    assert.equal(cleanSurroundingBrackets('『赤き剣』'), '赤き剣');
    assert.equal(cleanSurroundingBrackets('【ケネス】'), 'ケネス');
    assert.equal(cleanSurroundingBrackets('“Sword”'), 'Sword');
  });

  test('validateGlossaryCandidate rejects chapter titles and volume markers', () => {
    assert.equal(validateGlossaryCandidate({ istilah_asli: '第八章　王都騒乱', istilah_terjemahan: 'Chapter 8' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '第151話', istilah_terjemahan: 'Episode 151' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: 'Chapter 151', istilah_terjemahan: 'Bab 151' }).valid, false);
  });

  test('validateGlossaryCandidate rejects common generic Japanese dictionary items', () => {
    assert.equal(validateGlossaryCandidate({ istilah_asli: 'お湯', istilah_terjemahan: 'Hot water' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '水道', istilah_terjemahan: 'Tap Water' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '台車', istilah_terjemahan: 'Cart' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '腰布', istilah_terjemahan: 'loincloth' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '剣技', istilah_terjemahan: 'sword technique' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '王国', istilah_terjemahan: 'Kingdom' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '王都', istilah_terjemahan: 'Royal Capital' }).valid, false);
  });

  test('validateGlossaryCandidate rejects generic single Kanji non-names', () => {
    assert.equal(validateGlossaryCandidate({ istilah_asli: '門', istilah_terjemahan: 'gate', kategori: 'Istilah Khusus' }).valid, false);
    assert.equal(validateGlossaryCandidate({ istilah_asli: '面', istilah_terjemahan: 'men', kategori: 'Jurus/Sekte' }).valid, false);
  });

  test('validateGlossaryCandidate accepts genuine proper nouns and unique lore', () => {
    assert.equal(validateGlossaryCandidate({ istilah_asli: '涼', istilah_terjemahan: 'Ryou', kategori: 'Nama' }).valid, true);
    assert.equal(validateGlossaryCandidate({ istilah_asli: 'アベル', istilah_terjemahan: 'Abel', kategori: 'Nama' }).valid, true);
    assert.equal(validateGlossaryCandidate({ istilah_asli: 'ウォータージェット256', istilah_terjemahan: 'Water Jet 256', kategori: 'Jurus/Sekte' }).valid, true);
    assert.equal(validateGlossaryCandidate({ istilah_asli: 'ロンドの森', istilah_terjemahan: 'Rondo Forest', kategori: 'Tempat' }).valid, true);
    assert.equal(validateGlossaryCandidate({ istilah_asli: 'アークデビル', istilah_terjemahan: 'Archdevil', kategori: 'Istilah Khusus' }).valid, true);
  });

  test('partitionGlossaryByQuality correctly separates clean items from noisy items', () => {
    const mixed = [
      { id: '1', novel_id: 'n1', istilah_asli: 'お湯', istilah_terjemahan: 'Hot water', kategori: 'Item' as const },
      { id: '2', novel_id: 'n1', istilah_asli: 'アベル', istilah_terjemahan: 'Abel', kategori: 'Nama' as const },
      { id: '3', novel_id: 'n1', istilah_asli: '王国', istilah_terjemahan: 'Kingdom', kategori: 'Tempat' as const },
      { id: '4', novel_id: 'n1', istilah_asli: 'ウォータージェット256', istilah_terjemahan: 'Water Jet 256', kategori: 'Jurus/Sekte' as const },
    ];
    const { clean, removed } = partitionGlossaryByQuality(mixed);
    assert.equal(clean.length, 2);
    assert.equal(removed.length, 2);
    assert.equal(clean[0].istilah_asli, 'アベル');
    assert.equal(clean[1].istilah_asli, 'ウォータージェット256');
  });
});


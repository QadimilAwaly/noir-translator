import { GlossaryItem, ExtractedTerm } from '../types';

/**
 * Regex identifying chapter numbers, volume headers, and story section markers.
 */
export const CHAPTER_MARKER_REGEX =
  /^(?:第\s*[0-9一二三四五六七八九十百千]+\s*[章話節部巻卷]|Chapter\s*\d+|Episode\s*\d+|Act\s*\d+|Volume\s*\d+|Vol\.?\s*\d+|Part\s*\d+|Bab\s*\d+|Ep\.?\s*\d+|Prologue|Epilogue|Side\s*Story|Interlude|Afterword|Prolog|Epilog|Catatan\s*Penulis|Daftar\s*Isi|Author'?s?\s*Note)/i;

/**
 * Generic Japanese dictionary words (common nouns, ordinary items, generic roles, everyday actions).
 */
export const GENERIC_COMMON_WORDS_JP = new Set([
  // Locations without proper names
  '王国', '帝国', '公国', '都市', '首都', '王都', '帝都', '村', '町', '森', '山', '川', '海', '湖', '洞窟', '平原', '草原', '砂漠', '島', '街道', '門', '城壁', '広場', '世界', '大陸',
  // Social roles / professions without proper names
  '兵士', '騎士', '商人', '冒険者', '貴族', '平民', '王', '女王', '皇帝', '王子', '王女', '領主', '村長', '店主', '客', '通行人', '農民', '奴隷', '宿屋', 'ギルド', '仲間', '敵', '味方', '隊長', '団長', '部下', '上司',
  // Everyday items & foods
  'お湯', '水道', '台車', '腰布', '竹槍', '魚醤', '鮎', '魚', '肉', '水', 'お茶', '酒', 'パン', '料理', '野菜', '果物', '服', '靴', '帽子', '鞄', '財布', '紙', '本', '机', '椅子', 'ベッド', '窓', '扉', 'ドア', '箸', '皿', 'コップ', '鍋', '包丁', 'お金', '金貨', '銀貨', '銅貨', '薬', '毒',
  // Martial / action / generic state words
  '面', '小手', '胴', '突き', '剣技', '闘技', '武術', '体術', '素振り', '稽古', '修行', '訓練', '気配', '呼吸', '気合い', '歩行', '走行', '跳躍', '防御', '攻撃', '回避', '視線', '足音', 'ため息',
  // Generic weapons & equipment without proper name
  '竹刀', '鍔', '打刀', '太刀', '剣', '刀', '槍', '盾', '鎧', '弓', '矢', '短剣', '短刀', '斧', '杖', '武器', '防具', '弩',
  // Nature & elements
  '火', '水', '風', '土', '光', '闇', '氷', '雷', '木', '石', '鉄', '金', '銀', '銅',
  // RPG / generic fantasy terms without proper name
  '魔法', '魔術', '魔力', 'スキル', 'レベル', 'ステータス', '属性', '魔物', '人間', '悪魔',
]);

/**
 * Generic English translations of common nouns.
 */
export const GENERIC_COMMON_WORDS_EN = new Set([
  'kingdom', 'empire', 'duchy', 'city', 'capital', 'royal capital', 'imperial capital', 'village', 'town', 'forest', 'mountain', 'river', 'sea', 'lake', 'cave', 'gate', 'world', 'continent',
  'soldier', 'knight', 'merchant', 'adventurer', 'noble', 'commoner', 'king', 'queen', 'emperor', 'prince', 'princess', 'lord', 'guild', 'inn', 'enemy', 'ally', 'captain', 'leader',
  'hot water', 'tap water', 'cart', 'loincloth', 'bamboo spear', 'fish sauce', 'sweetfish', 'fish', 'meat', 'water', 'tea', 'bread', 'food', 'clothes', 'shoes', 'bag', 'paper', 'book', 'desk', 'chair', 'bed', 'window', 'door', 'money', 'gold coin', 'silver coin', 'poison',
  'men', 'kote', 'dou', 'tsuki', 'sword technique', 'battle technique', 'presence', 'breathing', 'defense', 'attack', 'dodge', 'footsteps', 'sigh',
  'shinai', 'tsuba', 'uchigatana', 'tachi', 'sword', 'spear', 'shield', 'armor', 'bow', 'arrow', 'dagger', 'axe', 'staff', 'weapon', 'crossbow',
  'magic', 'mana', 'skill', 'level', 'status', 'attribute', 'monster', 'human', 'demon',
]);

/**
 * Generic Indonesian translations of common nouns.
 */
export const GENERIC_COMMON_WORDS_ID = new Set([
  'kerajaan', 'kekaisaran', 'kota', 'ibukota', 'desa', 'hutan', 'gunung', 'sungai', 'laut', 'danau', 'gua', 'gerbang', 'pintu', 'dunia', 'benua',
  'prajurit', 'ksatria', 'pedagang', 'petualang', 'bangsawan', 'rakyat', 'raja', 'ratu', 'kaisar', 'pangeran', 'putri', 'tuan', 'kapten',
  'air panas', 'air keran', 'gerobak', 'ikan', 'daging', 'air', 'teh', 'roti', 'pakaian', 'sepatu', 'tas', 'buku', 'uang', 'koin emas', 'koin perak', 'racun',
  'teknik pedang', 'serangan', 'pertahanan', 'hawa keberadaan', 'senjata', 'pedang', 'tombak', 'perisai', 'baju zirah', 'panah',
  'sihir', 'mana', 'keterampilan', 'level', 'status', 'atribut', 'monster', 'manusia', 'iblis',
]);

/**
 * Cleans surrounding Japanese or Latin quotes/brackets from a term.
 * e.g. 「ウォータージェット256」 -> ウォータージェット256
 */
export function cleanSurroundingBrackets(str: string): string {
  if (!str) return '';
  let s = str.trim();
  const brackets: [string, string][] = [
    ['「', '」'],
    ['『', '』'],
    ['【', '】'],
    ['〈', '〉'],
    ['《', '》'],
    ['＜', '＞'],
    ['“', '”'],
    ['"', '"'],
    ["'", "'"],
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ];

  for (const [open, close] of brackets) {
    if (s.startsWith(open) && s.endsWith(close) && s.length > open.length + close.length) {
      s = s.slice(open.length, -close.length).trim();
    }
  }
  return s;
}

export interface TermValidationResult {
  valid: boolean;
  cleanedTerm: string;
  cleanedTranslation: string;
  reason?: string;
}

/**
 * Rigorously checks if an extracted candidate is a high-value glossary term.
 * Filters out chapter markers, common generic dictionary words, and non-name single characters.
 */
export function validateGlossaryCandidate(term: {
  istilah_asli: string;
  istilah_terjemahan: string;
  kategori?: string;
}): TermValidationResult {
  const orig = cleanSurroundingBrackets(term.istilah_asli || '');
  const trans = cleanSurroundingBrackets(term.istilah_terjemahan || '');
  const kat = term.kategori || 'Istilah Khusus';

  if (!orig || !trans) {
    return { valid: false, cleanedTerm: orig, cleanedTranslation: trans, reason: 'Istilah atau terjemahan kosong' };
  }

  // Reject pure numbers or punctuation
  if (/^[0-9\s.,!?:;\-_/\\()]+$/.test(orig)) {
    return { valid: false, cleanedTerm: orig, cleanedTranslation: trans, reason: 'Hanya angka atau tanda baca' };
  }

  // 1. Chapter and story section markers
  if (CHAPTER_MARKER_REGEX.test(orig) || CHAPTER_MARKER_REGEX.test(trans)) {
    return { valid: false, cleanedTerm: orig, cleanedTranslation: trans, reason: 'Penanda bab atau metadata cerita' };
  }

  // 2. Exact match in generic common words dictionary
  if (GENERIC_COMMON_WORDS_JP.has(orig)) {
    return { valid: false, cleanedTerm: orig, cleanedTranslation: trans, reason: `Kata benda umum kamus Jepang: "${orig}"` };
  }

  const transLower = trans.toLowerCase();
  if (GENERIC_COMMON_WORDS_EN.has(transLower) || GENERIC_COMMON_WORDS_ID.has(transLower)) {
    return { valid: false, cleanedTerm: orig, cleanedTranslation: trans, reason: `Kata benda umum kamus terjemahan: "${trans}"` };
  }

  // 3. Single-character Kanji restriction:
  // Reject single-character Kanji unless it is explicitly a character name with a capitalized translation
  if (orig.length === 1 && /^[\u4e00-\u9fa5]$/.test(orig)) {
    const isCapitalized = /^[A-Z]/.test(trans);
    if (kat !== 'Nama' || !isCapitalized) {
      return { valid: false, cleanedTerm: orig, cleanedTranslation: trans, reason: `Karakter kanji tunggal non-nama: "${orig}"` };
    }
  }

  return { valid: true, cleanedTerm: orig, cleanedTranslation: trans };
}

/**
 * Filter an array of glossary items, partitioning them into clean items and removed noisy items.
 */
export function partitionGlossaryByQuality(items: GlossaryItem[]): {
  clean: GlossaryItem[];
  removed: Array<{ item: GlossaryItem; reason: string }>;
} {
  const clean: GlossaryItem[] = [];
  const removed: Array<{ item: GlossaryItem; reason: string }> = [];

  for (const item of items) {
    const validation = validateGlossaryCandidate(item);
    if (validation.valid) {
      clean.push({
        ...item,
        istilah_asli: validation.cleanedTerm,
        istilah_terjemahan: validation.cleanedTranslation,
      });
    } else {
      removed.push({ item, reason: validation.reason || 'Kriteria kualitas tidak terpenuhi' });
    }
  }

  return { clean, removed };
}

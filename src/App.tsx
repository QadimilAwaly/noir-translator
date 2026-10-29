import React, { useState, useEffect, useRef } from 'react';
import { Novel, Chapter, ReferenceItem, GlossaryItem, ChapterStatus, LanguageCode, AIConfig, ServerConfig, GenderTag, GlossaryCategory } from './types';
import {
  getStoredChapters,
  saveStoredChapters,
  getStoredReferences,
  saveStoredReferences,
  getStoredGlossaries,
  saveStoredGlossaries,
  generateUniqueId,
} from './services/storage';
import { translateChapterApi, extractGlossaryApi, authHeaders } from './services/api';
import { filterRelevantGlossaries, filterRelevantReferences } from './services/contextFilter';
import { validateGlossaryCandidate, partitionGlossaryByQuality } from './services/glossaryFilter';
import { exportNovelAsFolderZip } from './services/exportZip';
import { useLibrary } from './hooks/useLibrary';
import { useChapterEditor } from './hooks/useChapterEditor';
import { Header } from './components/Header';
import { NovelSidebar } from './components/NovelSidebar';
import { SplitEditor } from './components/SplitEditor';
import { ContextPanel } from './components/ContextPanel';
import { NewNovelModal } from './components/NewNovelModal';
import { NewChapterModal } from './components/NewChapterModal';
import { NewGlossaryModal } from './components/NewGlossaryModal';
import { ExportModal } from './components/ExportModal';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastConfig {
  message: string;
  actions?: ToastAction[];
}

export default function App() {
  // Custom Hooks for Subsystem State Isolation (Step 8)
  const library = useLibrary();
  const chapterEditor = useChapterEditor();

  const {
    novels,
    activeNovelId,
    activeNovel,
    reloadLibraryFromDisk,
  } = library;

  const {
    chapters,
    activeChapterId,
    activeChapter,
    references,
    synopsis,
    writingStyle,
    glossaries,
    promptStats,
    setSynopsis,
    setWritingStyle,
  } = chapterEditor;

  // Global App Config State (stored in config.json on server)
  const [globalStoragePath, setGlobalStoragePath] = useState<string>('');
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    openrouterApiKey: '',
    geminiApiKey: '',
  });

  // Fetch config.json on mount (API key TIDAK dikirim server — audit #2)
  useEffect(() => {
    fetch('/api/config', {
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((data: ServerConfig) => {
        if (data) {
          setServerConfig(data);
          if (data.global_storage_path) setGlobalStoragePath(data.global_storage_path);
          setAiConfig((prev) => {
            const provider = data.default_provider || prev.provider;
            const model = provider === 'openrouter'
              ? (data.default_openrouter_model || prev.model)
              : (data.default_model || prev.model);
            return {
              ...prev,
              provider,
              model: model || prev.model,
            };
          });
        }
      })
      .catch((err) => console.error('Failed fetching config.json:', err));
  }, []);

  // Modals States
  const [isNewNovelModalOpen, setIsNewNovelModalOpen] = useState(false);
  const [isNewChapterModalOpen, setIsNewChapterModalOpen] = useState(false);
  const [isNewGlossaryModalOpen, setIsNewGlossaryModalOpen] = useState(false);
  const [editingGlossary, setEditingGlossary] = useState<GlossaryItem | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isModelSettingsModalOpen, setIsModelSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Panel visibility states (responsive defaults)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return true;
  });

  // AI Loading & Notification States
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [toast, setToast] = useState<ToastConfig | null>(null);

  // Feature: Auto-Extract Glossary after translation finishes (toggleable, persisted in localStorage)
  const [autoExtractGlossary, setAutoExtractGlossary] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('noir_auto_extract_glossary');
        return saved === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const autoExtractGlossaryRef = useRef(autoExtractGlossary);
  autoExtractGlossaryRef.current = autoExtractGlossary;

  const handleToggleAutoExtractGlossary = () => {
    setAutoExtractGlossary((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('noir_auto_extract_glossary', String(next));
      } catch {}
      showToast(
        next
          ? 'Ekstraksi glosarium otomatis: AKTIF'
          : 'Ekstraksi glosarium otomatis: NONAKTIF'
      );
      return next;
    });
  };

  // Live Tab Title: Real-time status in background/active browser tabs
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const novelTitle = activeNovel?.judul?.trim();
    const chapterNum = activeChapter?.nomor_chapter;
    const base = novelTitle
      ? chapterNum !== undefined
        ? `Bab ${chapterNum} - ${novelTitle}`
        : `${novelTitle} | Noir Translator`
      : 'Noir Translator';

    if (isTranslating) {
      document.title = `⏳ [Menerjemahkan...] ${base}`;
    } else if (isExtracting) {
      document.title = `🔍 [Ekstrak Glosarium...] ${base}`;
    } else {
      document.title = base;
    }
  }, [isTranslating, isExtracting, activeNovel?.judul, activeChapter?.nomor_chapter]);

  const showToast = (msg: string | ToastConfig) => {
    if (typeof msg === 'string') {
      setToast({ message: msg });
      setTimeout(() => setToast(null), 4000);
    } else {
      setToast(msg);
      if (!msg.actions || msg.actions.length === 0) {
        setTimeout(() => setToast(null), 4000);
      }
    }
  };

  const handleSaveAiConfig = async (newConfig: AIConfig, newGlobalPath?: string) => {
    setAiConfig(newConfig);
    if (typeof newGlobalPath === 'string') {
      setGlobalStoragePath(newGlobalPath);
    }

    try {
      const body: Record<string, unknown> = {
        global_storage_path: newGlobalPath !== undefined ? newGlobalPath : globalStoragePath,
        default_provider: newConfig.provider,
        default_model: newConfig.provider === 'gemini' ? newConfig.model : (serverConfig?.default_model || 'gemini-2.5-flash'),
        default_openrouter_model: newConfig.provider === 'openrouter' ? newConfig.model : (serverConfig?.default_openrouter_model || 'google/gemini-2.5-flash'),
      };
      if (newConfig.geminiApiKey) body.gemini_api_key = newConfig.geminiApiKey;
      if (newConfig.openrouterApiKey) body.openrouter_api_key = newConfig.openrouterApiKey;

      await fetch('/api/config', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error('Failed saving config.json:', e);
    }

    showToast(`Pengaturan tersimpan ke config.json (${newConfig.provider.toUpperCase()}: ${newConfig.model}).`);
  };

  // Initial Load of Novels on Mount (fast cached load; manual reload button in Header provides force=true when needed)
  useEffect(() => {
    reloadLibraryFromDisk(undefined, { force: false }).then((serverData) => {
      if (serverData && serverData.novels.length > 0) {
        const targetId = activeNovelId || serverData.novels[0].id;
        chapterEditor.reloadFromServer(targetId, serverData);
      }
    });
  }, []);

  // 2. Load Chapters, References, Glossaries when Active Novel changes
  useEffect(() => {
    if (!activeNovelId) return;
    chapterEditor.reloadFromServer(activeNovelId);
  }, [activeNovelId]);
  // Helper: Save chapter to local disk via server API (/api/save-chapter)
  const saveChapterToDiskServer = async (chap: Chapter) => {
    if (!activeNovel) return;
    try {
      const folderPath = activeNovel.folder_path && !activeNovel.folder_path.startsWith('[')
        ? activeNovel.folder_path
        : globalStoragePath;

      await fetch('/api/save-chapter', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          folder_path: folderPath,
          chapter_number: chap.nomor_chapter,
          chapter_title: chap.judul_chapter,
          original_text: chap.teks_asli,
          translated_text: chap.teks_terjemahan,
          novel_title: activeNovel.judul,
          source_lang: activeNovel.bahasa_sumber,
          target_lang: activeNovel.bahasa_target,
        }),
      });
    } catch (err) {
      console.error('Error saving chapter file to disk via server:', err);
    }
  };

  // Handler: Select Chapter
  const handleSelectChapter = (id: string) => {
    chapterEditor.setActiveChapterId(id);
    if (activeNovelId) {
      chapterEditor.loadChapterContent(id, activeNovelId);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsLeftSidebarOpen(false);
    }
  };

  // Handler: Update Chapter Text (Original & Translation)
  const handleUpdateChapterText = (original: string, translated: string) => {
    if (!activeChapterId || !activeNovelId) return;
    const updatedChapter = chapterEditor.updateChapterText(activeChapterId, original, translated, activeNovelId);
    if (updatedChapter) {
      saveChapterToDiskServer(updatedChapter);
    }
  };

  // Handler: Update Chapter Status
  const handleUpdateChapterStatus = (status: ChapterStatus) => {
    if (!activeChapterId || !activeNovelId) return;
    chapterEditor.updateChapterStatus(activeChapterId, status, activeNovelId);
    showToast(`Status Bab diperbarui menjadi "${status}".`);
  };

  // Handler: Create New Novel
  const handleCreateNovel = (data: {
    judul: string;
    folder_path: string;
    bahasa_sumber: LanguageCode;
    bahasa_target: LanguageCode;
    dirHandle?: FileSystemDirectoryHandle;
  }) => {
    const newNovel: Novel = {
      id: `novel-${Date.now()}`,
      judul: data.judul,
      folder_path: data.folder_path,
      bahasa_sumber: data.bahasa_sumber,
      bahasa_target: data.bahasa_target,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    library.addNovel(newNovel);
    showToast(`Novel "${newNovel.judul}" berhasil dibuat.`);
  };

  // Handler: Delete Novel
  const handleDeleteNovel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Apakah Anda yakin ingin menghapus novel ini beserta seluruh bab dan glosariumnya?')) return;

    library.removeNovel(id);
    showToast('Novel dan foldernya di disk berhasil dihapus.');
  };

  // Handler: Rename Novel
  const handleRenameNovel = (id: string, newTitle: string) => {
    library.renameNovel(id, newTitle);
    showToast('Judul novel dan folder di disk berhasil diperbarui.');
  };

  // Handler: Update Chapter Number & Title
  const handleUpdateChapterMeta = (id: string, patch: { nomor_chapter?: number; judul_chapter?: string }) => {
    const updated = chapterEditor.updateChapterMeta(id, patch, activeNovelId || undefined);
    if (updated) {
      saveChapterToDiskServer(updated);
    }
    showToast('Nomor dan judul bab berhasil diperbarui.');
  };

  // Handler: Rename Chapter
  const handleRenameChapter = (id: string, newTitle: string, newNumber?: number) => {
    handleUpdateChapterMeta(id, {
      judul_chapter: newTitle,
      ...(newNumber !== undefined ? { nomor_chapter: newNumber } : {}),
    });
  };

  // Handler: Create New Chapter
  const handleCreateChapter = (data: {
    nomor_chapter: number;
    judul_chapter: string;
    teks_asli: string;
  }) => {
    if (!activeNovelId) return;
    const newChapter = chapterEditor.createChapter(activeNovelId, data);
    saveChapterToDiskServer(newChapter);
    showToast(`Bab ${newChapter.nomor_chapter} berhasil ditambahkan.`);
  };

  // Handler: Delete Chapter
  const handleDeleteChapter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus chapter ini?')) return;

    chapterEditor.deleteChapter(id, activeNovelId || undefined);
    showToast('Bab berhasil dihapus.');
  };

  // Handler: Add Glossary Item
  const handleAddGlossaryItem = (item: Omit<GlossaryItem, 'id' | 'novel_id'>) => {
    if (!activeNovelId) return;
    const newItem = chapterEditor.addGlossaryItem(activeNovelId, item);
    showToast(`Istilah "${newItem.istilah_asli}" ditambahkan ke glosarium.`);
  };

  // Handler: Update Glossary Item
  const handleUpdateGlossaryItem = (
    id: string,
    data: {
      istilah_asli: string;
      istilah_terjemahan: string;
      kategori: GlossaryCategory;
      gender?: GenderTag;
      konteks?: string;
    }
  ) => {
    if (!activeNovelId) return;
    const updated = chapterEditor.updateGlossaryItem(id, data, activeNovelId);
    if (updated) {
      showToast(`Istilah "${updated.istilah_asli}" berhasil diperbarui.`);
    }
  };

  // Handler: Delete Glossary Item
  const handleDeleteGlossaryItem = (id: string) => {
    if (!activeNovelId) return;
    chapterEditor.deleteGlossaryItem(id, activeNovelId);
    showToast('Istilah berhasil dihapus dari glosarium.');
  };

  // Handler: Update Glossary Gender Tag
  const handleUpdateGlossaryGender = (id: string, gender: GenderTag | undefined) => {
    if (!activeNovelId) return;
    const updated = chapterEditor.updateGlossaryGender(id, gender, activeNovelId);
    showToast(`Gender istilah "${updated.find((g) => g.id === id)?.istilah_asli}" diperbarui.`);
  };

  // Handler: Add Reference Item
  const handleAddReferenceItem = (item: Omit<ReferenceItem, 'id' | 'novel_id'>) => {
    if (!activeNovelId) return;
    const newItem = chapterEditor.addReferenceItem(activeNovelId, item);
    showToast(`Lore/Karakter "${newItem.nama_item}" ditambahkan.`);
  };

  // Handler: Delete Reference Item
  const handleDeleteReferenceItem = (id: string) => {
    if (!activeNovelId) return;
    chapterEditor.deleteReferenceItem(id, activeNovelId);
    showToast('Lore/Referensi berhasil dihapus.');
  };

  // Phase 1 & 2: Translate Chapter via LLM with Context Assembly
  const handleTranslateChapter = async () => {
    if (!activeNovel || !activeChapter || !activeChapter.teks_asli.trim()) return;

    setIsTranslating(true);
    try {
      const relevantGlossaries = filterRelevantGlossaries(activeChapter.teks_asli, glossaries);
      const relevantReferences = filterRelevantReferences(activeChapter.teks_asli, references);

      const reqData = {
        teks_asli: activeChapter.teks_asli,
        bahasa_sumber: activeNovel.bahasa_sumber,
        bahasa_target: activeNovel.bahasa_target,
        nomor_chapter: activeChapter.nomor_chapter,
        judul_novel: activeNovel.judul,
        reference_data: {
          synopsis,
          writing_style: writingStyle,
          lore_summary: relevantReferences.map((r) => `[${r.kategori}] ${r.nama_item}: ${r.deskripsi}`).join('\n'),
        },
        glossary_items: relevantGlossaries.map((g) => ({
          istilah_asli: g.istilah_asli,
          istilah_terjemahan: g.istilah_terjemahan,
          kategori: g.kategori,
          gender: g.gender,
          konteks: g.konteks,
        })),
        ai_config: {
          provider: aiConfig.provider,
          model: aiConfig.model,
        },
      };

      const result = await translateChapterApi(reqData);
      handleUpdateChapterText(activeChapter.teks_asli, result.translatedText);
      if (
        result.suggestedTitle &&
        (activeChapter.judul_chapter === `Bab ${activeChapter.nomor_chapter}` ||
          activeChapter.judul_chapter === `Chapter ${activeChapter.nomor_chapter}` ||
          !activeChapter.judul_chapter.trim())
      ) {
        handleRenameChapter(activeChapter.id, result.suggestedTitle);
      }
      handleUpdateChapterStatus('Selesai');

      // Auto-extract glossary after translation finishes if enabled (continuous async promise chain, no setTimeout)
      if (autoExtractGlossaryRef.current && result.translatedText) {
        showToast(`Chapter ${activeChapter.nomor_chapter} berhasil diterjemahkan! Mengekstrak glosarium otomatis...`);
        setIsTranslating(false);
        await handleExtractGlossary(result.translatedText);
      } else {
        showToast(`Chapter ${activeChapter.nomor_chapter} berhasil diterjemahkan!`);
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Gagal menerjemahkan: ${err.message || 'Kesalahan jaringan.'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Phase 3: Automatic Glossary Extraction & AI Progression
  const handleExtractGlossary = async (overrideTranslatedText?: string) => {
    const targetTranslated = overrideTranslatedText ?? activeChapter?.teks_terjemahan;
    if (!activeChapter || !targetTranslated || !targetTranslated.trim()) return;

    setIsExtracting(true);
    try {
      const relevantGlossaries = filterRelevantGlossaries(activeChapter.teks_asli, glossaries);
      const relevantReferences = filterRelevantReferences(activeChapter.teks_asli, references);

      const result = await extractGlossaryApi({
        teks_asli: activeChapter.teks_asli,
        teks_terjemahan: targetTranslated,
        nomor_chapter: activeChapter.nomor_chapter,
        bahasa_sumber: activeNovel?.bahasa_sumber || 'Mandarin',
        bahasa_target: activeNovel?.bahasa_target || 'Indonesia',
        reference_data: {
          synopsis,
          writing_style: writingStyle,
          lore_summary: relevantReferences.map((r) => `[${r.kategori}] ${r.nama_item}: ${r.deskripsi}`).join('\n'),
        },
        existing_glossary: relevantGlossaries.map((g) => ({
          istilah_asli: g.istilah_asli,
          istilah_terjemahan: g.istilah_terjemahan,
          kategori: g.kategori,
          gender: g.gender,
          konteks: g.konteks,
        })),
        ai_config: {
          provider: aiConfig.provider,
          model: aiConfig.model,
        },
      });

      if (result.terms && result.terms.length > 0) {
        let addedCount = 0;
        const currentGloss = activeNovelId ? getStoredGlossaries(activeNovelId) : glossaries;
        const newGlossaryItems: GlossaryItem[] = [...currentGloss];

        result.terms.forEach((term) => {
          const validation = validateGlossaryCandidate(term);
          if (!validation.valid) return;

          const exists = newGlossaryItems.some(
            (g) => g.istilah_asli.toLowerCase() === validation.cleanedTerm.toLowerCase()
          );
          if (!exists && activeNovelId) {
            newGlossaryItems.push({
              id: generateUniqueId('glos-auto'),
              novel_id: activeNovelId,
              istilah_asli: validation.cleanedTerm,
              istilah_terjemahan: validation.cleanedTranslation,
              kategori: term.kategori || 'Istilah Khusus',
              gender: term.gender,
              chapter_ditemukan: `Chapter ${activeChapter.nomor_chapter}`,
              konteks: term.konteks || '',
            });
            addedCount++;
          }
        });
        saveStoredGlossaries(newGlossaryItems, activeNovelId || undefined);
        chapterEditor.setGlossaries(newGlossaryItems);
        showToast(`Berhasil mengekstrak ${addedCount} istilah baru berkualitas ke glosarium!`);
      } else {
        showToast('Tidak ada istilah baru tambahan ditemukan pada bab ini.');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Gagal ekstraksi glosarium: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };
  // Handler: Clean generic noisy terms from existing glossary (e.g. Water-Attribute Magician)
  const handleCleanNoisyGlossary = () => {
    if (!activeNovelId || glossaries.length === 0) return;
    const { clean, removed } = partitionGlossaryByQuality(glossaries);
    if (removed.length === 0) {
      showToast('Glosarium sudah bersih! Tidak ada kata umum atau penanda bab yang terdeteksi.');
      return;
    }

    saveStoredGlossaries(clean, activeNovelId);
    chapterEditor.setGlossaries(clean);
    showToast(`Berhasil membersihkan ${removed.length} kata umum & judul bab dari glosarium!`);
  };

  // Export Physical Folder ZIP
  const handleExportFolderZip = () => {
    if (!activeNovel) return;
    exportNovelAsFolderZip(activeNovel, chapters, references, glossaries, synopsis, writingStyle);
    showToast('File physical library .ZIP berhasil diunduh.');
  };

  // Update Source and Target Languages for Active Novel
  const handleUpdateNovelLanguages = (source: LanguageCode, target: LanguageCode) => {
    if (!activeNovel) return;
    library.updateNovel(activeNovel.id, { bahasa_sumber: source, bahasa_target: target });
    showToast(`Bahasa diperbarui: ${source} ➔ ${target}`);
  };

  // Power & Latency Optimized: Stable Ref to avoid re-binding window listener on every keystroke
  const shortcutsStateRef = useRef({
    isShortcutsModalOpen,
    isAnyModalOpen: false,
    activeNovel,
    activeChapter,
    activeChapterId,
    chapters,
    isTranslating,
    isExtracting,
    handleTranslateChapter,
    handleExtractGlossary,
    saveChapterToDiskServer,
    handleSelectChapter,
    showToast,
    setIsShortcutsModalOpen,
    setIsNewChapterModalOpen,
  });

  shortcutsStateRef.current = {
    isShortcutsModalOpen,
    isAnyModalOpen:
      isNewNovelModalOpen ||
      isNewChapterModalOpen ||
      isNewGlossaryModalOpen ||
      editingGlossary !== null ||
      isExportModalOpen ||
      isModelSettingsModalOpen,
    activeNovel,
    activeChapter,
    activeChapterId,
    chapters,
    isTranslating,
    isExtracting,
    handleTranslateChapter,
    handleExtractGlossary,
    saveChapterToDiskServer,
    handleSelectChapter,
    showToast,
    setIsShortcutsModalOpen,
    setIsNewChapterModalOpen,
  };

  // Global Keyboard Shortcuts for High-Speed Translation Workflow (Single listener instance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = shortcutsStateRef.current;

      // 1. Toggle or Close Shortcuts Cheat Sheet Modal
      if (state.isShortcutsModalOpen) {
        if (e.key === 'Escape' || e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
          e.preventDefault();
          state.setIsShortcutsModalOpen(false);
        }
        return;
      }

      const activeTag = (e.target as HTMLElement)?.tagName;
      const isTypingInField = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      // 2. Open Shortcuts Modal (? when not typing in text field, or Ctrl+/)
      if ((e.key === '?' && !isTypingInField) || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault();
        state.setIsShortcutsModalOpen(true);
        return;
      }

      // If other modals are open, do not execute background shortcuts
      if (state.isAnyModalOpen) return;

      // 3. Translate Chapter: Ctrl+Enter / Cmd+Enter OR Alt+T
      if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || (e.altKey && (e.key === 't' || e.key === 'T'))) {
        e.preventDefault();
        if (state.isTranslating) return;
        if (!state.activeNovel) {
          state.showToast('Pilih novel terlebih dahulu untuk menerjemahkan.');
          return;
        }
        if (!state.activeChapter) {
          state.showToast('Pilih chapter yang ingin diterjemahkan.');
          return;
        }
        if (!state.activeChapter.teks_asli.trim()) {
          state.showToast('Teks bab asli masih kosong.');
          return;
        }
        state.handleTranslateChapter();
        return;
      }

      // 4. Extract Glossary: Alt+G OR Ctrl+Shift+G
      if (
        (e.altKey && (e.key === 'g' || e.key === 'G')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'g' || e.key === 'G'))
      ) {
        e.preventDefault();
        if (state.isExtracting) return;
        if (!state.activeChapter) {
          state.showToast('Pilih chapter terlebih dahulu.');
          return;
        }
        if (!state.activeChapter.teks_terjemahan || !state.activeChapter.teks_terjemahan.trim()) {
          state.showToast('Teks terjemahan masih kosong. Terjemahkan terlebih dahulu sebelum ekstrak glosarium.');
          return;
        }
        state.handleExtractGlossary();
        return;
      }

      // 5. Add Chapter: Alt+N
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        if (!state.activeNovel) {
          state.showToast('Pilih novel terlebih dahulu sebelum menambah bab.');
          return;
        }
        state.setIsNewChapterModalOpen(true);
        return;
      }

      // 6. Save Chapter: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (state.activeChapter && state.activeNovel) {
          state.saveChapterToDiskServer(state.activeChapter);
          state.showToast(`Chapter ${state.activeChapter.nomor_chapter} berhasil disimpan ke disk.`);
        }
        return;
      }

      // 7. Next Chapter: Alt+ArrowRight or Alt+] (prevent Arrow conflict while typing in editor)
      if (e.altKey && (e.key === 'ArrowRight' || e.key === ']')) {
        if (isTypingInField && e.key === 'ArrowRight') return;
        e.preventDefault();
        if (state.chapters.length > 0 && state.activeChapterId) {
          const idx = state.chapters.findIndex((c) => c.id === state.activeChapterId);
          if (idx >= 0 && idx < state.chapters.length - 1) {
            const nextChap = state.chapters[idx + 1];
            state.handleSelectChapter(nextChap.id);
            state.showToast(`Beralih ke Chapter ${nextChap.nomor_chapter}: ${nextChap.judul_chapter}`);
          }
        }
        return;
      }

      // 8. Previous Chapter: Alt+ArrowLeft or Alt+[ (prevent Arrow conflict while typing in editor)
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === '[')) {
        if (isTypingInField && e.key === 'ArrowLeft') return;
        e.preventDefault();
        if (state.chapters.length > 0 && state.activeChapterId) {
          const idx = state.chapters.findIndex((c) => c.id === state.activeChapterId);
          if (idx > 0) {
            const prevChap = state.chapters[idx - 1];
            state.handleSelectChapter(prevChap.id);
            state.showToast(`Beralih ke Chapter ${prevChap.nomor_chapter}: ${prevChap.judul_chapter}`);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const completedChaptersCount = chapters.filter((c) => c.status_pengerjaan === 'Selesai').length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111318] font-sans antialiased text-gray-200">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#1F2229] border border-indigo-500/30 text-indigo-300 px-4 py-2.5 rounded shadow-2xl text-xs font-medium flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-200">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          <span>{toast.message}</span>
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              {toast.actions.map((act, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    act.onClick();
                    setToast(null);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition cursor-pointer font-medium"
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Header Bar */}
      <Header
        activeNovel={activeNovel}
        totalChapters={chapters.length}
        completedChapters={completedChaptersCount}
        totalGlossaryCount={glossaries.length}
        aiConfig={aiConfig}
        onOpenNewNovelModal={() => setIsNewNovelModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenModelSettingsModal={() => setIsModelSettingsModalOpen(true)}
        onUpdateNovelLanguages={handleUpdateNovelLanguages}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onReloadFromDisk={async () => {
          const serverData = await reloadLibraryFromDisk(undefined, { force: true });
          if (serverData && activeNovelId) {
            chapterEditor.reloadFromServer(activeNovelId, serverData);
          }
          if (serverData) {
            showToast('Seluruh data novel, bab, dan glosarium berhasil dimuat ulang dari disk!');
          } else {
            showToast('Gagal memuat ulang data dari disk.');
          }
        }}
        isLeftSidebarOpen={isLeftSidebarOpen}
        isRightPanelOpen={isRightPanelOpen}
        onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
        onToggleRightPanel={() => setIsRightPanelOpen((prev) => !prev)}
      />
      <main className="flex-1 flex flex-row overflow-hidden relative min-h-0 min-w-0">
        {/* Panel 1: Navigasi Novel & Chapter (Left) */}
        {isLeftSidebarOpen && (
          <>
            {/* Mobile Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden"
              onClick={() => setIsLeftSidebarOpen(false)}
              aria-label="Tutup Library Sidebar"
            />
            <NovelSidebar
              novels={novels}
              activeNovelId={activeNovelId}
              isLoading={library.isLoading}
              onSelectNovel={library.setActiveNovelId}
              chapters={chapters}
              activeChapterId={activeChapterId}
              onSelectChapter={handleSelectChapter}
              onAddChapter={() => setIsNewChapterModalOpen(true)}
              onDeleteChapter={handleDeleteChapter}
              onDeleteNovel={handleDeleteNovel}
              onRenameNovel={handleRenameNovel}
              onRenameChapter={handleRenameChapter}
              onAddNovel={() => setIsNewNovelModalOpen(true)}
              onClose={() => setIsLeftSidebarOpen(false)}
            />
          </>
        )}

        {/* Panel 2: Split-View Editor Kerja (Center) */}
        <SplitEditor
          activeNovel={activeNovel}
          activeChapter={activeChapter}
          onUpdateChapterText={handleUpdateChapterText}
          onUpdateChapterStatus={handleUpdateChapterStatus}
          onTranslateChapter={handleTranslateChapter}
          onExtractGlossary={handleExtractGlossary}
          autoExtractGlossary={autoExtractGlossary}
          onToggleAutoExtractGlossary={handleToggleAutoExtractGlossary}
          onUpdateChapterMeta={handleUpdateChapterMeta}
          onUpdateNovelLanguages={handleUpdateNovelLanguages}
          onAddNovel={() => setIsNewNovelModalOpen(true)}
          onAddChapter={() => setIsNewChapterModalOpen(true)}
          isTranslating={isTranslating}
          isExtracting={isExtracting}
          isChapterLoading={chapterEditor.isChapterLoading}
          promptStats={promptStats}
        />

        {/* Panel 3: Konteks, Lore & Glosarium (Right) */}
        {isRightPanelOpen && (
          <>
            {/* Mobile Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden"
              onClick={() => setIsRightPanelOpen(false)}
              aria-label="Tutup Context Panel"
            />
            <ContextPanel
              activeNovel={activeNovel}
              references={references}
              glossaries={glossaries}
              synopsis={synopsis}
              writingStyle={writingStyle}
              onChangeSynopsis={setSynopsis}
              onChangeWritingStyle={setWritingStyle}
              onAddReferenceItem={handleAddReferenceItem}
              onDeleteReferenceItem={handleDeleteReferenceItem}
              onAddGlossaryItem={handleAddGlossaryItem}
              onEditGlossaryItem={(item) => setEditingGlossary(item)}
              onDeleteGlossaryItem={handleDeleteGlossaryItem}
              onUpdateGlossaryGender={handleUpdateGlossaryGender}
              onCleanNoisyGlossary={handleCleanNoisyGlossary}
              onOpenNewGlossaryModal={() => {
                setEditingGlossary(null);
                setIsNewGlossaryModalOpen(true);
              }}
              onClose={() => setIsRightPanelOpen(false)}
            />
          </>
        )}
      </main>
      {/* Dialog Modals */}
      <NewNovelModal
        isOpen={isNewNovelModalOpen}
        onClose={() => setIsNewNovelModalOpen(false)}
        globalStoragePath={globalStoragePath}
        onCreateNovel={handleCreateNovel}
      />

      <NewChapterModal
        isOpen={isNewChapterModalOpen}
        onClose={() => setIsNewChapterModalOpen(false)}
        nextChapterNumber={chapters.length > 0 ? Math.floor(Math.max(...chapters.map((c) => c.nomor_chapter || 0))) + 1 : 1}
        onCreateChapter={handleCreateChapter}
      />

      <NewGlossaryModal
        isOpen={isNewGlossaryModalOpen || editingGlossary !== null}
        onClose={() => {
          setIsNewGlossaryModalOpen(false);
          setEditingGlossary(null);
        }}
        activeChapterNum={activeChapter?.nomor_chapter}
        initialData={editingGlossary}
        onAddGlossary={handleAddGlossaryItem}
        onUpdateGlossary={handleUpdateGlossaryItem}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeNovel={activeNovel}
        globalStoragePath={globalStoragePath}
        onExportFolderZip={handleExportFolderZip}
      />

      <ModelSettingsModal
        isOpen={isModelSettingsModalOpen}
        onClose={() => setIsModelSettingsModalOpen(false)}
        aiConfig={aiConfig}
        globalStoragePath={globalStoragePath}
        defaultGeminiModel={serverConfig?.default_model}
        defaultOpenrouterModel={serverConfig?.default_openrouter_model}
        onSaveConfig={handleSaveAiConfig}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}

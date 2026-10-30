import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Workflow Keyboard Shortcuts Implementation', () => {
  const appTsx = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf-8');
  const splitEditorTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/SplitEditor.tsx'), 'utf-8');
  const novelSidebarTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/NovelSidebar.tsx'), 'utf-8');
  const newChapterModalTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/NewChapterModal.tsx'), 'utf-8');
  const shortcutsModalTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/KeyboardShortcutsModal.tsx'), 'utf-8');
  const headerTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/Header.tsx'), 'utf-8');

  it('App.tsx should listen to keydown events and unbind cleanly', () => {
    expect(appTsx).toContain("window.addEventListener('keydown', handleKeyDown)");
    expect(appTsx).toContain("window.removeEventListener('keydown', handleKeyDown)");
  });

  it('App.tsx should handle Translate Chapter via Ctrl+Enter / Cmd+Enter or Alt+T', () => {
    expect(appTsx).toMatch(/\(e\.ctrlKey\s*\|\|\s*e\.metaKey\)\s*&&\s*e\.key\s*===\s*'Enter'/);
    expect(appTsx).toMatch(/e\.altKey\s*&&\s*\(e\.key\s*===\s*'t'\s*\|\|\s*e\.key\s*===\s*'T'\)/);
    expect(appTsx).toContain('handleTranslateChapter()');
  });

  it('App.tsx should handle Extract Glossary via Alt+G or Ctrl+Shift+G', () => {
    expect(appTsx).toMatch(/e\.altKey\s*&&\s*\(e\.key\s*===\s*'g'\s*\|\|\s*e\.key\s*===\s*'G'\)/);
    expect(appTsx).toMatch(/\(e\.ctrlKey\s*\|\|\s*e\.metaKey\)\s*&&\s*e\.shiftKey/);
    expect(appTsx).toMatch(/(?:state\.)?handleExtractGlossary\(\)/);
  });

  it('App.tsx should handle Add Chapter via Alt+N', () => {
    expect(appTsx).toMatch(/e\.altKey\s*&&\s*\(e\.key\s*===\s*'n'\s*\|\|\s*e\.key\s*===\s*'N'\)/);
    expect(appTsx).toMatch(/(?:state\.)?setIsNewChapterModalOpen\(true\)/);
  });

  it('App.tsx should handle Save Chapter via Ctrl+S / Cmd+S', () => {
    expect(appTsx).toMatch(/\(e\.ctrlKey\s*\|\|\s*e\.metaKey\)\s*&&\s*\(e\.key\s*===\s*'s'\s*\|\|\s*e\.key\s*===\s*'S'\)/);
    expect(appTsx).toMatch(/(?:state\.)?saveChapterToDiskServer\((?:state\.)?activeChapter\)/);
  });

  it('App.tsx should handle Chapter Navigation via Alt+ArrowRight and Alt+ArrowLeft', () => {
    expect(appTsx).toMatch(/e\.altKey\s*&&\s*\(e\.key\s*===\s*'ArrowRight'\s*\|\|\s*e\.key\s*===\s*']'\)/);
    expect(appTsx).toMatch(/e\.altKey\s*&&\s*\(e\.key\s*===\s*'ArrowLeft'\s*\|\|\s*e\.key\s*===\s*'\['\)/);
  });

  it('App.tsx should suppress background shortcuts when any modal is open', () => {
    expect(appTsx).toMatch(/isAnyModalOpen/);
    expect(appTsx).toMatch(/if\s*\(\s*(?:state\.)?isAnyModalOpen\s*\)\s*return;/);
  });

  it('SplitEditor.tsx, NovelSidebar.tsx, and NewChapterModal.tsx should not render distracting kbd badges inside action buttons', () => {
    // Action buttons must not contain <kbd> badges on their faces
    expect(splitEditorTsx).not.toMatch(/<button[\s\S]*?<kbd[\s\S]*?<\/kbd>[\s\S]*?Translate Chapter/);
    expect(splitEditorTsx).not.toMatch(/<button[\s\S]*?<kbd[\s\S]*?<\/kbd>[\s\S]*?Ekstrak Glosarium/);
    expect(novelSidebarTsx).not.toMatch(/<button[\s\S]*?<kbd[\s\S]*?<\/kbd>[\s\S]*?Tambah Bab/);
    expect(newChapterModalTsx).not.toMatch(/<button[\s\S]*?<kbd[\s\S]*?<\/kbd>[\s\S]*?Tambah Bab/);

    // Tooltip titles must retain shortcut cues for accessibility
    expect(splitEditorTsx).toContain('title="Menerjemahkan chapter ini dengan AI (Ctrl+Enter)"');
    expect(splitEditorTsx).toContain('title="Ekstrak istilah baru otomatis dari chapter ini ke Glosarium (Alt+G)"');
    expect(novelSidebarTsx).toContain('title="Tambah Bab Baru (Alt+N)"');
    expect(newChapterModalTsx).toContain('title="Tambah Bab (Ctrl+Enter)"');
  });

  it('SplitEditor.tsx and App.tsx should implement toggleable Auto-Extract Glossary after translation', () => {
    // SplitEditor toggle UI
    expect(splitEditorTsx).toContain('autoExtractGlossary');
    expect(splitEditorTsx).toContain('onToggleAutoExtractGlossary');
    expect(splitEditorTsx).toContain('Auto-Ekstrak:');

    // App.tsx state & localStorage persistence
    expect(appTsx).toContain("localStorage.getItem('noir_auto_extract_glossary')");
    expect(appTsx).toContain("localStorage.setItem('noir_auto_extract_glossary'");
    expect(appTsx).toContain('autoExtractGlossaryRef');

    // App.tsx auto extraction trigger on translation complete (direct await without setTimeout to prevent background tab throttling)
    expect(appTsx).toMatch(/if\s*\(\s*autoExtractGlossaryRef\.current\s*&&\s*result\.translatedText\s*\)/);
    expect(appTsx).toMatch(/await\s+handleExtractGlossary\(result\.translatedText\)/);
    expect(appTsx).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{\s*handleExtractGlossary/);

    // Live tab title tracking for background tab observability
    expect(appTsx).toContain('document.title');
    expect(appTsx).toContain('⏳ [Menerjemahkan...]');
    expect(appTsx).toContain('🔍 [Ekstrak Glosarium...]');
  });

  it('handleExtractGlossary and SplitEditor.tsx should prevent SyntheticEvent leakage into manual glossary extraction', () => {
    // SplitEditor must call onExtractGlossary via zero-argument arrow function
    expect(splitEditorTsx).toMatch(/onClick=\{\(\)\s*=>\s*onExtractGlossary\(\)\}/);

    // App.tsx passes zero-argument wrapper to SplitEditor
    expect(appTsx).toMatch(/onExtractGlossary=\{\(\)\s*=>\s*handleExtractGlossary\(\)\}/);

    // handleExtractGlossary must defensively check typeof overrideTranslatedText === 'string'
    expect(appTsx).toMatch(/typeof\s+overrideTranslatedText\s*===\s*'string'/);
  });

  it('NewChapterModal.tsx should support Ctrl+Enter to submit directly from textarea', () => {
    expect(newChapterModalTsx).toMatch(/\(e\.ctrlKey\s*\|\|\s*e\.metaKey\)\s*&&\s*e\.key\s*===\s*'Enter'/);
  });

  it('Header.tsx and KeyboardShortcutsModal.tsx should provide accessible cheat sheet dialog', () => {
    expect(headerTsx).toContain('onOpenShortcutsModal');
    expect(headerTsx).toContain('Pintasan Keyboard (?)');
    expect(shortcutsModalTsx).toContain('Pintasan Keyboard (Shortcuts)');
    expect(shortcutsModalTsx).toContain('Alur Penerjemahan (Workflow AI)');
  });
});

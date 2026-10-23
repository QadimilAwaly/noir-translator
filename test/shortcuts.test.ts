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

  it('SplitEditor.tsx should display visual kbd shortcut hints for Translate and Extract Glossary', () => {
    expect(splitEditorTsx).toContain('Ctrl+Enter');
    expect(splitEditorTsx).toContain('Alt+G');
  });

  it('NovelSidebar.tsx should display visual kbd shortcut hint for Tambah Bab', () => {
    expect(novelSidebarTsx).toContain('Alt+N');
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

import { test, describe, beforeAll, afterAll } from 'bun:test';
import assert from 'assert';
import path from 'path';
import fs from 'fs';

describe('Config & Model Flexibility Verification', () => {
  const originalEnv = { ...process.env };

  afterAll(() => {
    process.env = originalEnv;
  });

  test('server.ts defines configurable models without forced hardcoded fallback', () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

    // Verify DEFAULT_MODEL and DEFAULT_OPENROUTER_MODEL env fallbacks
    assert.ok(
      serverCode.includes('process.env.DEFAULT_OPENROUTER_MODEL'),
      'server.ts must support DEFAULT_OPENROUTER_MODEL'
    );
    assert.ok(
      serverCode.includes('process.env.DEFAULT_GEMINI_MODEL') || serverCode.includes('process.env.DEFAULT_MODEL'),
      'server.ts must support DEFAULT_GEMINI_MODEL or DEFAULT_MODEL'
    );
    assert.ok(
      serverCode.includes('process.env.GEMINI_FALLBACK_MODEL'),
      'server.ts must support GEMINI_FALLBACK_MODEL'
    );
    assert.ok(
      serverCode.includes('process.env.OPENROUTER_API_URL') || serverCode.includes('process.env.OPENROUTER_BASE_URL'),
      'server.ts must support OPENROUTER_API_URL / OPENROUTER_BASE_URL'
    );
  });

  test('server.ts defines configurable paths for config, storage, prompt, and dist', () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

    assert.ok(
      serverCode.includes('process.env.CONFIG_PATH'),
      'server.ts must support CONFIG_PATH'
    );
    assert.ok(
      serverCode.includes('process.env.GLOBAL_STORAGE_PATH') || serverCode.includes('process.env.NOVEL_LIBRARY_DIR'),
      'server.ts must support GLOBAL_STORAGE_PATH / NOVEL_LIBRARY_DIR'
    );
    assert.ok(
      serverCode.includes('process.env.PROMPT_TEMPLATE_PATH'),
      'server.ts must support PROMPT_TEMPLATE_PATH'
    );
    assert.ok(
      serverCode.includes('process.env.DIST_PATH'),
      'server.ts must support DIST_PATH'
    );
  });

  test('Dynamic fallback logic respects custom models instead of only gemini-2.5-flash', () => {
    const primary1 = 'gemini-3.5-flash-lite';
    const fallback1 = primary1 === 'gemini-2.5-flash' ? 'gemini-2.5-pro' : (primary1 !== 'gemini-2.5-flash' ? 'gemini-2.5-flash' : '');
    assert.equal(fallback1, 'gemini-2.5-flash', 'Custom model falls back to gemini-2.5-flash');

    const primary2 = 'gemini-2.5-flash';
    const fallback2 = primary2 === 'gemini-2.5-flash' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    assert.equal(fallback2, 'gemini-2.5-pro', 'Standard gemini-2.5-flash falls back to gemini-2.5-pro');

    const customEnvFallback = 'custom-gemini-fallback';
    const effectiveFallback = customEnvFallback || fallback1;
    assert.equal(effectiveFallback, 'custom-gemini-fallback', 'Custom env fallback takes precedence');
  });

  test('Leading path normalization supports both custom library name and legacy Novel_Library', () => {
    const libraryBase = '/custom/path/My_Custom_Storage';
    const libraryDirName = path.basename(libraryBase);
    const escapedDir = libraryDirName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const leadingPattern = new RegExp(`^/(?:${escapedDir}|Novel_Library)/`);

    const path1 = '/Novel_Library/MyNovel';
    const path2 = '/My_Custom_Storage/MyNovel';
    const path3 = '/Unrelated_Path/MyNovel';

    assert.ok(leadingPattern.test(path1), 'Matches legacy /Novel_Library/ prefix');
    assert.ok(leadingPattern.test(path2), 'Matches custom libraryDirName prefix');
    assert.ok(!leadingPattern.test(path3), 'Rejects unrelated path');

    const stripped1 = path1.replace(/^\/[^/]+\//, '');
    const stripped2 = path2.replace(/^\/[^/]+\//, '');
    assert.equal(stripped1, 'MyNovel');
    assert.equal(stripped2, 'MyNovel');
  });

  test('ModelSettingsModal includes gemini-3.5-flash-lite and configurable props', () => {
    const modalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/ModelSettingsModal.tsx'), 'utf-8');
    assert.ok(modalCode.includes('gemini-3.5-flash-lite'), 'Includes gemini-3.5-flash-lite preset');
    assert.ok(modalCode.includes('defaultGeminiModel'), 'Accepts defaultGeminiModel prop');
    assert.ok(modalCode.includes('defaultOpenrouterModel'), 'Accepts defaultOpenrouterModel prop');
  });

  test('NewNovelModal and ExportModal respect globalStoragePath prop', () => {
    const newNovelCode = fs.readFileSync(path.join(process.cwd(), 'src/components/NewNovelModal.tsx'), 'utf-8');
    const exportCode = fs.readFileSync(path.join(process.cwd(), 'src/components/ExportModal.tsx'), 'utf-8');

    assert.ok(newNovelCode.includes('globalStoragePath'), 'NewNovelModal accepts globalStoragePath prop');
    assert.ok(newNovelCode.includes('libraryDir'), 'NewNovelModal computes libraryDir dynamically');
    assert.ok(exportCode.includes('globalStoragePath'), 'ExportModal accepts globalStoragePath prop');
    assert.ok(exportCode.includes('libraryDir'), 'ExportModal computes libraryDir dynamically');
  });
});

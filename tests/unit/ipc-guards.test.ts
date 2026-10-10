import { describe, it, expect } from 'vitest';
import { validateConfig, validateAppEntry } from '../../src/main/ipc';

describe('IPC 入参校验', () => {
  it('合法配置通过', () => {
    const cfg = {
      schemaVersion: 1, apps: [], categories: [],
      diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
    };
    expect(validateConfig(cfg)).toBe(true);
  });
  it('拒绝 schemaVersion 非 1 / 非法主题', () => {
    expect(validateConfig({ ...{ schemaVersion: 1, apps: [], categories: [], diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1 }, schemaVersion: 2 })).toBe(false);
    expect(validateConfig({ ...{ schemaVersion: 1, apps: [], categories: [], diameterRatio: 0.72, theme: 'neon', opacity: 0.35, colorSaturation: 0.85, fontScale: 1 } })).toBe(false);
  });
  it('合法应用条目通过并拒绝字段缺失', () => {
    const okApp = { id: 'x', name: 'n', iconPath: '', target: '/x', source: 'manual', categoryId: null, pinned: false };
    expect(validateAppEntry(okApp)).toBe(true);
    expect(validateAppEntry({ ...okApp, id: undefined })).toBe(false);
  });
});

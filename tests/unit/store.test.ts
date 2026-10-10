import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, defaultConfig } from '../../src/main/store';
import type { AppEntry } from '../../src/shared/types';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ringstore-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const app = (id: string, categoryId: string | null = null): AppEntry => ({
  id, name: id, iconPath: '', target: `/x/${id}`, source: 'desktop-file', categoryId, pinned: false,
});

describe('Store', () => {
  it('默认配置含 schemaVersion 与 7 个分类', () => {
    const cfg = defaultConfig();
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.categories).toHaveLength(7);
  });

  it('save 后可 load 回相同配置', () => {
    const s = new Store(join(dir, 'store.json'));
    const cfg = defaultConfig();
    cfg.apps = [app('a', 'dev')];
    s.save(cfg);
    const loaded = new Store(join(dir, 'store.json')).load();
    expect(loaded.apps).toEqual(cfg.apps);
  });

  it('mergeApps 保留已存在项的手动分类归属', () => {
    const cfg = defaultConfig();
    cfg.apps = [app('installed', 'tool')];
    const scanned = [app('installed'), app('new')];
    const merged = new Store(join(dir, 's.json')).mergeApps(cfg, scanned);
    expect(merged.find((a) => a.id === 'installed')?.categoryId).toBe('tool');
    expect(merged).toHaveLength(2);
  });

  it('配置损坏时恢复 .bak 并标记默认配置兜底', () => {
    const file = join(dir, 'store.json');
    writeFileSync(file, '{ broken json');
    const s = new Store(file);
    expect(() => s.load()).not.toThrow();
    expect(s.load().schemaVersion).toBe(1);
  });

  it('损坏恢复会保留 .bak 备份', () => {
    const file = join(dir, 'store.json');
    writeFileSync(file, '{not valid');
    const s = new Store(file);
    s.load();
    expect(readFileSync(join(dir, 'store.json.bak'), 'utf8')).toContain('{not valid');
  });

  it('重复 save 时备份前一版本', () => {
    const file = join(dir, 'store.json');
    const s = new Store(file);
    const first = defaultConfig();
    s.save(first);
    const second = defaultConfig();
    second.apps = [app('b', 'dev')];
    s.save(second);
    const bak = JSON.parse(readFileSync(join(dir, 'store.json.bak'), 'utf8')) as { apps: AppEntry[] };
    expect(bak.apps).toEqual(first.apps);
  });
});
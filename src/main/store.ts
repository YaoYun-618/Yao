import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AppEntry, DEFAULT_CATEGORIES, RingConfig } from '../shared/types';

export function defaultConfig(): RingConfig {
  return {
    schemaVersion: 1,
    apps: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    diameterRatio: 0.72,
    theme: 'dark',
    opacity: 0.35,
    colorSaturation: 0.85,
    fontScale: 1,
  };
}

export class Store {
  private readonly bakPath: string;
  constructor(private readonly filePath: string) {
    this.bakPath = `${filePath}.bak`;
  }

  load(): RingConfig {
    if (!existsSync(this.filePath)) return defaultConfig();
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as RingConfig;
      if (parsed.schemaVersion !== 1) throw new Error('unsupported schema');
      return parsed;
    } catch {
      this.backup();
      return defaultConfig();
    }
  }

  save(cfg: RingConfig): void {
    if (existsSync(this.filePath)) this.backup();
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(cfg, null, 2), 'utf8');
  }

  backup(): string {
    if (existsSync(this.filePath)) {
      copyFileSync(this.filePath, this.bakPath);
    }
    return this.bakPath;
  }

  mergeApps(existing: RingConfig, scanned: AppEntry[]): AppEntry[] {
    const known = new Map(existing.apps.map((a) => [a.id, a]));
    const merged = new Map<string, AppEntry>();
    for (const app of scanned) {
      const prev = known.get(app.id);
      merged.set(app.id, prev ? { ...app, categoryId: prev.categoryId, pinned: prev.pinned } : app);
    }
    for (const app of existing.apps) {
      if (!merged.has(app.id)) merged.set(app.id, app);
    }
    return [...merged.values()];
  }
}
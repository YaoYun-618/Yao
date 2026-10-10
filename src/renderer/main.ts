import { computeLayout } from './ring-layout';
import { renderRing } from './icon-grid';
import { renderCenter, highlightMatches, highlightAllOff } from './center-console';
import { resolveTheme } from './theme';
import type { AppEntry, RingConfig } from '../shared/types';

declare global {
  interface Window {
    ringAPI: {
      loadConfig: () => Promise<RingConfig>;
      saveConfig: (cfg: RingConfig) => Promise<boolean>;
      scan: () => Promise<{ apps: AppEntry[]; warnings: string[] }>;
      launch: (entry: AppEntry) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

const DEFAULT_CATEGORIES: RingConfig['categories'] = [
  { id: 'work', name: '工作', angleDeg: null, color: '' },
  { id: 'dev', name: '开发', angleDeg: null, color: '' },
  { id: 'fun', name: '娱乐', angleDeg: null, color: '' },
  { id: 'design', name: '设计', angleDeg: null, color: '' },
  { id: 'tool', name: '工具', angleDeg: null, color: '' },
  { id: 'system', name: '系统', angleDeg: null, color: '' },
  { id: 'uncategorized', name: '未分类', angleDeg: null, color: '' },
];

let cfg: RingConfig = {
  schemaVersion: 1, apps: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
};

function applyTheme(): void {
  const vars = resolveTheme(cfg);
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v);
  }
}

function render(): void {
  const root = document.getElementById('ring');
  if (!root) return;
  const size = window.innerHeight * cfg.diameterRatio;
  const cx = size / 2;
  const cy = size / 2;
  const sectors = computeLayout(cfg, size, cx, cy);
  const labels = new Map(cfg.categories.map((c) => [c.id, c.name]));
  renderRing(
    root,
    sectors,
    labels,
    size,
    (window.innerWidth - size) / 2,
    (window.innerHeight - size) / 2,
  );
  renderCenter(root, cfg.apps, cfg.apps.filter((a) => a.pinned));
}

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  render();
  if (window.ringAPI?.loadConfig) {
    cfg = await window.ringAPI.loadConfig();
    applyTheme();
    render();
  }
  const ring = document.getElementById('ring');
  ring?.addEventListener('click', (evt) => {
    const target = (evt.target as HTMLElement).closest('.app-icon') as HTMLElement | null;
    const appId = target?.dataset.appId;
    if (!appId) return;
    const app = cfg.apps.find((a) => a.id === appId);
    if (app) void window.ringAPI.launch(app);
  });
  const input = document.querySelector<HTMLInputElement>('input[data-testid="search"]');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { highlightAllOff(document.getElementById('ring')!); return; }
    const ids = cfg.apps.filter((a) => a.name.toLowerCase().includes(q)).map((a) => a.id);
    highlightMatches(document.getElementById('ring')!, ids);
  });
});

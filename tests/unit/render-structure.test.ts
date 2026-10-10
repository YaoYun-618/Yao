// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../../src/renderer/theme';
import { renderRing } from '../../src/renderer/icon-grid';
import { renderCenter } from '../../src/renderer/center-console';
import { highlightMatches } from '../../src/renderer/center-console';
import { computeLayout } from '../../src/renderer/ring-layout';
import type { AppEntry, RingConfig } from '../../src/shared/types';

const app = (id: string): AppEntry => ({
  id, name: id, iconPath: '', target: '/x', source: 'manual',
  categoryId: 'dev', pinned: false,
});

function cfg(): RingConfig {
  return {
    schemaVersion: 1,
    apps: [app('a'), app('b')],
    categories: [{ id: 'dev', name: '开发', angleDeg: null, color: '' }],
    diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
  };
}

describe('theme', () => {
  it('暗色主题返回完整变量集', () => {
    const t = resolveTheme({ theme: 'dark', opacity: 0.35, colorSaturation: 0.85 });
    expect(t['--panel-base']).toBeTruthy();
    expect(t['--text']).toBeTruthy();
  });
});

describe('renderRing', () => {
  it('渲染扇区 path 与图标节点', () => {
    const container = document.createElement('div');
    const sectors = computeLayout(cfg(), 800, 400, 400);
    renderRing(container, sectors, new Map([['dev', '开发']]));
    expect(container.querySelectorAll('path.sector')).toHaveLength(1);
    expect(container.querySelectorAll('.app-icon')).toHaveLength(2);
  });
  it('搜索高亮给匹配图标加光晕类', () => {
    const container = document.createElement('div');
    const sectors = computeLayout(cfg(), 800, 400, 400);
    renderRing(container, sectors, new Map());
    highlightMatches(container, ['a']);
    expect(container.querySelectorAll('.app-icon.match')).toHaveLength(1);
    expect(container.querySelectorAll('.app-icon')).toHaveLength(2);
  });
});

describe('renderCenter', () => {
  it('渲染搜索框与固定常用槽', () => {
    const container = document.createElement('div');
    renderCenter(container, cfg().apps, [cfg().apps[0]]);
    expect(container.querySelector('input[data-testid="search"]')).not.toBeNull();
    expect(container.querySelectorAll('.pinned-slot')).toHaveLength(1);
  });
});

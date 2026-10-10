import { describe, it, expect } from 'vitest';
import { allocateAngles, polarToCartesian, computeLayout } from '../../src/renderer/ring-layout';
import type { AppEntry, RingConfig } from '../../src/shared/types';

const app = (id: string): AppEntry => ({
  id, name: id, iconPath: '', target: '/x', source: 'manual', categoryId: null, pinned: false,
});

describe('allocateAngles', () => {
  it('空指定角度时均分 360', () => {
    const r = allocateAngles([{ id: 'a', angleDeg: null }, { id: 'b', angleDeg: null }]);
    expect(r[0]).toEqual({ categoryId: 'a', startDeg: 0, endDeg: 180 });
    expect(r[1]).toEqual({ categoryId: 'b', startDeg: 180, endDeg: 360 });
  });
  it('指定角度后其余均分剩余', () => {
    const r = allocateAngles([{ id: 'a', angleDeg: 90 }, { id: 'b', angleDeg: null }, { id: 'c', angleDeg: null }]);
    expect(r[0]).toEqual({ categoryId: 'a', startDeg: 0, endDeg: 90 });
    expect(r[2].startDeg).toBe(225);
    expect(r[2].endDeg).toBe(360);
  });
});

describe('polarToCartesian', () => {
  it('0° 在圆心正右', () => {
    const p = polarToCartesian(0, 10, 0, 0);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });
  it('90° 在圆心正下（屏幕坐标 y 向下）', () => {
    const p = polarToCartesian(90, 10, 0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });
});

describe('computeLayout', () => {
  it('扇区内图标落在对应角度范围与轨道半径', () => {
    const cfg: RingConfig = {
      schemaVersion: 1,
      apps: [app('a'), app('b'), app('c')],
      categories: [
        { id: 'dev', name: '开发', angleDeg: null, color: '' },
        { id: 'uncategorized', name: '未分类', angleDeg: null, color: '' },
      ],
      diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
    };
    cfg.apps.forEach((a, i) => { a.categoryId = i === 2 ? 'uncategorized' : 'dev'; });
    const sectors = computeLayout(cfg, 800, 400, 400);
    expect(sectors).toHaveLength(2);
    const dev = sectors.find((s) => s.categoryId === 'dev')!;
    expect(dev.icons).toHaveLength(2);
    const icon = dev.icons[0];
    expect(icon.size).toBeGreaterThan(0);
    expect(icon.x).toBeGreaterThan(0);
    expect(icon.y).toBeGreaterThan(0);
  });
  it('空应用分类仍产出扇区但无图标', () => {
    const cfg: RingConfig = {
      schemaVersion: 1, apps: [], categories: [{ id: 'tool', name: '工具', angleDeg: null, color: '' }],
      diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
    };
    const sectors = computeLayout(cfg, 800, 400, 400);
    expect(sectors[0].icons).toHaveLength(0);
  });
});
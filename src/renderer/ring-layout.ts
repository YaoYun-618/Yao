import { AppEntry, RingConfig } from '../shared/types';

export interface SectorAngle {
  categoryId: string;
  startDeg: number;
  endDeg: number;
}

export interface PlacedIcon {
  app: AppEntry;
  x: number;
  y: number;
  size: number;
}

export interface SectorLayout extends SectorAngle {
  icons: PlacedIcon[];
}

export function allocateAngles(
  categories: { id: string; angleDeg: number | null }[],
): SectorAngle[] {
  const fixed = categories.filter((c) => c.angleDeg != null);
  const fixedSum = fixed.reduce((s, c) => s + (c.angleDeg as number), 0);
  const flexible = categories.filter((c) => c.angleDeg == null);
  const perFlexible = flexible.length > 0 ? Math.max(0, 360 - fixedSum) / flexible.length : 0;

  const out: SectorAngle[] = [];
  let cursor = 0;
  for (const c of categories) {
    const span = c.angleDeg ?? perFlexible;
    out.push({ categoryId: c.id, startDeg: cursor, endDeg: cursor + span });
    cursor += span;
  }
  return out;
}

export function polarToCartesian(
  deg: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function computeLayout(
  cfg: RingConfig,
  diameter: number,
  cx: number,
  cy: number,
): SectorLayout[] {
  const radius = diameter / 2;
  const centerR = radius * 0.18;      // 中心控制区
  const labelR = radius * 0.28;       // 分类名环带
  const innerR = radius * 0.36;       // 图标轨道内半径
  const outerR = radius * 0.92;       // 图标轨道外半径
  const edgeR = radius * 0.97;        // 装饰轨
  const tracks = 4;
  const angles = allocateAngles(cfg.categories);

  return angles.map((angle) => {
    const apps = cfg.apps.filter((a) => a.categoryId === angle.categoryId);
    const trackSpan = (outerR - innerR) / tracks;
    const icons: PlacedIcon[] = [];
    apps.forEach((appItem, idx) => {
      const track = Math.min(tracks - 1, Math.floor(idx / 12));
      const slot = idx % 12;
      const slots = Math.max(6, Math.min(12, Math.floor((angle.endDeg - angle.startDeg) / 8)));
      const deg = angle.startDeg + 4 + (slot * Math.max(0, angle.endDeg - angle.startDeg - 8)) / slots;
      const r = innerR + track * trackSpan + trackSpan / 2;
      const size = Math.max(24, trackSpan * 1.6);
      icons.push({ app: appItem, ...polarToCartesian(deg, r, cx, cy), size });
    });
    return { ...angle, icons };
  });
}
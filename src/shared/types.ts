export type AppSource = 'start-menu' | 'desktop-file' | 'manual';

export interface AppEntry {
  id: string;
  name: string;
  iconPath: string;
  target: string;
  source: AppSource;
  categoryId: string | null;
  pinned: boolean;
}

export interface Category {
  id: string;
  name: string;
  angleDeg: number | null;
  color: string;
}

export interface RingConfig {
  schemaVersion: 1;
  apps: AppEntry[];
  categories: Category[];
  diameterRatio: number;
  theme: 'dark' | 'light';
  opacity: number;
  colorSaturation: number;
  fontScale: number;
}

export const UNCATEGORIZED_ID = 'uncategorized';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: '工作', angleDeg: null, color: '' },
  { id: 'dev', name: '开发', angleDeg: null, color: '' },
  { id: 'fun', name: '娱乐', angleDeg: null, color: '' },
  { id: 'design', name: '设计', angleDeg: null, color: '' },
  { id: 'tool', name: '工具', angleDeg: null, color: '' },
  { id: 'system', name: '系统', angleDeg: null, color: '' },
  { id: UNCATEGORIZED_ID, name: '未分类', angleDeg: null, color: '' },
];
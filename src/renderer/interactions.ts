import { AppEntry } from '../shared/types';

export function filterApps(apps: AppEntry[], query: string): AppEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return apps;
  return apps.filter((a) => a.name.toLowerCase().includes(q));
}

export function moveAppToCategory(
  apps: AppEntry[],
  appId: string,
  categoryId: string | null,
): AppEntry[] {
  return apps.map((a) => (a.id === appId ? { ...a, categoryId } : a));
}

export function togglePin(apps: AppEntry[], appId: string): AppEntry[] {
  return apps.map((a) => (a.id === appId ? { ...a, pinned: !a.pinned } : a));
}
import type { AppEntry } from '../shared/types';

export function renderCenter(
  container: HTMLElement,
  apps: AppEntry[],
  pinned: AppEntry[],
): void {
  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'center-console';

  const input = document.createElement('input');
  input.dataset.testid = 'search';
  input.placeholder = '搜索应用…';
  box.appendChild(input);

  const slots = document.createElement('div');
  slots.className = 'pinned-slots';
  for (const p of pinned.slice(0, 8)) {
    const slot = document.createElement('button');
    slot.className = 'pinned-slot';
    slot.dataset.appId = p.id;
    slot.title = p.name;
    slot.textContent = p.name.slice(0, 4);
    slots.appendChild(slot);
  }
  box.appendChild(slots);
  container.appendChild(box);
}

export function highlightMatches(container: HTMLElement, ids: string[]): void {
  const matched = new Set(ids);
  for (const el of container.querySelectorAll<HTMLElement>('.app-icon')) {
    const appId = el.dataset.appId ?? '';
    el.classList.toggle('match', matched.has(appId));
  }
}

export function highlightAllOff(container: HTMLElement): void {
  for (const el of container.querySelectorAll<HTMLElement>('.app-icon')) {
    el.classList.remove('match');
  }
}

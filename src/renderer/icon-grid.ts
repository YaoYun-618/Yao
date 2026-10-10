import { SectorLayout } from './ring-layout';

export function sectorPath(
  cx: number, cy: number, r1: number, r2: number, startDeg: number, endDeg: number,
): string {
  const pop = (deg: number, r: number): [number, number] => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [ax, ay] = pop(startDeg, r1);
  const [bx, by] = pop(endDeg, r1);
  const [cx2, cy2] = pop(endDeg, r2);
  const [dx, dy] = pop(startDeg, r2);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${ax.toFixed(2)} ${ay.toFixed(2)}`,
    `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${large} 1 ${bx.toFixed(2)} ${by.toFixed(2)}`,
    `L ${cx2.toFixed(2)} ${cy2.toFixed(2)}`,
    `A ${r2.toFixed(2)} ${r2.toFixed(2)} 0 ${large} 0 ${dx.toFixed(2)} ${dy.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export function renderRing(
  container: HTMLElement,
  sectors: SectorLayout[],
  labels: Map<string, string>,
  diameter = 800,
  left = 0,
  top = 0,
): void {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'ring-wrapper';
  wrapper.style.position = 'absolute';
  wrapper.style.left = `${left}px`;
  wrapper.style.top = `${top}px`;
  wrapper.style.width = `${diameter}px`;
  wrapper.style.height = `${diameter}px`;
  wrapper.style.pointerEvents = 'none';
  container.appendChild(wrapper);

  const cx = diameter / 2;
  const cy = diameter / 2;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(diameter));
  svg.setAttribute('height', String(diameter));
  svg.setAttribute('viewBox', `0 0 ${diameter} ${diameter}`);
  wrapper.appendChild(svg);

  const ringR1 = diameter * 0.3;
  const ringR2 = diameter * 0.46;
  const labelR = diameter * 0.29;
  const labelText = labels.size > 0 ? labels : new Map<string, string>();

  for (const s of sectors) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('class', 'sector');
    path.setAttribute('d', sectorPath(cx, cy, ringR1, ringR2, s.startDeg, s.endDeg));
    const hue = Math.abs(s.startDeg) % 360;
    path.setAttribute('fill', `hsla(${hue}, 70%, 55%, 0.16)`);
    path.setAttribute('stroke', `hsla(${hue}, 70%, 60%, 0.4)`);
    svg.appendChild(path);

    const name = labelText.get(s.categoryId) ?? s.categoryId;
    if (name) {
      const mid = (s.startDeg + s.endDeg) / 2;
      const rad = ((mid - 90) * Math.PI) / 180;
      const ctx = cx + labelR * Math.cos(rad);
      const cty = cy + labelR * Math.sin(rad);
      if (Number.isFinite(ctx) && Number.isFinite(cty)) {
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('class', 'sector-label');
        label.setAttribute('x', String(ctx));
        label.setAttribute('y', String(cty));
        label.textContent = name;
        svg.appendChild(label);
      }
    }
  }

  const layer = document.createElement('div');
  layer.className = 'icons-layer';
  for (const s of sectors) {
    for (const icon of s.icons) {
      const el = document.createElement('button');
      el.className = 'app-icon';
      el.dataset.appId = icon.app.id;
      el.title = icon.app.name;
      el.style.left = `${icon.x - icon.size / 2}px`;
      el.style.top = `${icon.y - icon.size / 2}px`;
      el.style.width = `${icon.size}px`;
      el.style.height = `${icon.size}px`;
      const img = document.createElement('img');
      img.src = icon.app.iconPath || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="%235a6cff"/></svg>';
      img.draggable = false;
      el.appendChild(img);
      el.appendChild(document.createTextNode(icon.app.name));
      layer.appendChild(el);
    }
  }
  container.appendChild(layer);
}

import type { RingConfig } from '../shared/types';

export function resolveTheme(
  cfg: Pick<RingConfig, 'theme' | 'opacity' | 'colorSaturation'>,
): Record<string, string> {
  const dark = cfg.theme === 'dark';
  const alpha = Math.min(0.6, Math.max(0.15, cfg.opacity));
  const sat = Math.min(1, Math.max(0, cfg.colorSaturation));
  return {
    '--panel-base': dark ? `rgba(18, 22, 36, ${alpha})` : `rgba(245, 247, 252, ${alpha})`,
    '--panel-border': dark ? 'rgba(120, 150, 255, 0.35)' : 'rgba(60, 80, 160, 0.3)',
    '--text': dark ? '#e8ecf8' : '#1c2340',
    '--text-dim': dark ? 'rgba(232, 236, 248, 0.55)' : 'rgba(28, 35, 64, 0.55)',
    '--glow': `rgba(120, 150, 255, ${sat * 0.55})`,
  };
}

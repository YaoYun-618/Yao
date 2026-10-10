import { describe, it, expect } from 'vitest';
import { composeHideIconsCommand, composeSetBottomScript, isInsideRing } from '../../src/main/desktop-layer';

describe('desktop-layer', () => {
  it('隐藏图标命令开关正确', () => {
    expect(composeHideIconsCommand(true)).toContain('HideIcons');
    expect(composeHideIconsCommand(true)).toContain('REG_DWORD');
    expect(composeHideIconsCommand(true)).toContain('/d 1 /f');
    expect(composeHideIconsCommand(false)).toContain('/d 0 /f');
  });
  it('置底脚本引用指定窗口句柄', () => {
    const script = composeSetBottomScript(0x1234);
    expect(script).toContain('4660');
    expect(script).toContain('SetWindowPos');
    expect(script).toContain('HWND_BOTTOM');
  });
  it('isInsideRing 判定圆内外', () => {
    expect(isInsideRing(10, 10, 0, 0, 15)).toBe(true);
    expect(isInsideRing(20, 0, 0, 0, 15)).toBe(false);
  });
});
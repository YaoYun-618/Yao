/**
 * 文件名: desktop-layer.ts
 * 描述: 系统桌面层集成命令构造——隐藏图标开关与窗口置底脚本
 */
const HIDE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';

export function composeHideIconsCommand(enabled: boolean): string {
  return (
    `reg add "${HIDE_KEY}" /v HideIcons /t REG_DWORD /d ${enabled ? 1 : 0} /f && ` +
    `ie4uinit.exe -show`
  );
}

export function composeSetBottomScript(hwnd: number): string {
  return [
    'Add-Type "using System;using System.Runtime.InteropServices;public class W{[DllImport(\\"user32.dll\\")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int c,int d,uint f);}";',
    `$HWND_BOTTOM=[IntPtr]-1;`,
    `[W]::SetWindowPos([IntPtr]${hwnd},$HWND_BOTTOM,0,0,0,0,0x0040)`,
  ].join('\n');
}

export function isInsideRing(x: number, y: number, cx: number, cy: number, radius: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  entryId, parseDesktopFile, scanDesktopDirs, composeShortcutScript, parseShortcutOutput,
} from '../../src/main/app-scanner';

describe('app-scanner', () => {
  it('entryId 稳定且定长', () => {
    expect(entryId('/a/b')).toBe(entryId('/a/b'));
    expect(entryId('/a/b')).toHaveLength(12);
  });

  it('解析 .desktop 文件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scan-'));
    const file = join(dir, 'demo.desktop');
    writeFileSync(file, [
      '[Desktop Entry]',
      'Type=Application',
      'Name=示例浏览器',
      'Exec=/usr/bin/demo --flag',
      'Icon=/usr/share/icons/demo.png',
    ].join('\n'));
    const app = parseDesktopFile(file);
    rmSync(dir, { recursive: true, force: true });
    expect(app).not.toBeNull();
    expect(app!.name).toBe('示例浏览器');
    expect(app!.target).toBe('/usr/bin/demo --flag');
    expect(app!.iconPath).toBe('/usr/share/icons/demo.png');
    expect(app!.source).toBe('desktop-file');
  });

  it('目录扫描收集全部 .desktop 并自动分类', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scan-dir-'));
    writeFileSync(join(dir, 'a.desktop'), '[Desktop Entry]\nType=Application\nName=VS Code\nExec=/usr/bin/code\n');
    writeFileSync(join(dir, 'b.desktop'), '[Desktop Entry]\nType=Application\nName=某软件\nExec=/usr/bin/x\n');
    const apps = scanDesktopDirs([dir]);
    rmSync(dir, { recursive: true, force: true });
    expect(apps).toHaveLength(2);
    expect(apps.find((a) => a.name === 'VS Code')?.categoryId).toBe('dev');
    expect(apps.some((a) => a.categoryId === 'uncategorized')).toBe(true);
  });

  it('composeShortcutScript 用白名单模板且转义单引号', () => {
    const script = composeShortcutScript(["C:\\Program Files\\It's.lnk"]);
    expect(script).toContain("'C:\\Program Files\\It''s.lnk'");
    expect(script).toContain('WScript.Shell');
  });

  it('parseShortcutOutput 解析 CSV 输出', () => {
    const csv = 'Name,C:\nchrome.exe,http://chrome\n记事本,C:\\Windows\\notepad.exe\n';
    const apps = parseShortcutOutput(csv);
    expect(apps).toHaveLength(2);
    expect(apps[0].name).toBe('chrome.exe');
    expect(apps[1].target.endsWith('notepad.exe')).toBe(true);
  });
});
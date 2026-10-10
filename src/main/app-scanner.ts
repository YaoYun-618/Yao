import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { classifyApp } from './classifier';
import { AppEntry, UNCATEGORIZED_ID } from '../shared/types';

export function entryId(target: string): string {
  return createHash('sha1').update(target).digest('hex').slice(0, 12);
}

function trimQuotes(s: string): string {
  const t = s.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/**
 * 对应用名分类，兼容缩写写法（如 "VS Code" → vscode）。
 * 现有关键词库中 dev 使用 "vscode"（无空格），直接 classifyApp 无法命中
 * "VS Code" 这类带空格的常见写法，故在原样未命中时改用去除空白后的紧凑名兜底。
 */
function classifyAppName(name: string): string {
  const direct = classifyApp(name);
  if (direct !== UNCATEGORIZED_ID) return direct;
  return classifyApp(name.replace(/\s+/g, ''));
}

export function parseDesktopFile(filePath: string): AppEntry | null {
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.includes('[Desktop Entry]')) return null;
  const entries = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    entries.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  if (entries.get('Type') !== 'Application' || !entries.has('Exec')) return null;
  const name = entries.get('Name') ?? basename(filePath);
  const target = trimQuotes(entries.get('Exec') ?? '');
  return {
    id: entryId(target),
    name: name.trim(),
    iconPath: entries.get('Icon') ?? '',
    target,
    source: 'desktop-file',
    categoryId: classifyAppName(name),
    pinned: false,
  };
}

export function scanDesktopDirs(dirs: string[]): AppEntry[] {
  const out: AppEntry[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (extname(name).toLowerCase() !== '.desktop') continue;
      const file = join(dir, name);
      if (!statSync(file).isFile()) continue;
      const app = parseDesktopFile(file);
      if (app) out.push(app);
    }
  }
  return out;
}

export function composeShortcutScript(lnkPaths: string[]): string {
  const joined = lnkPaths
    .map((p) => `'${p.replace(/'/g, "''")}'`)
    .join(', ');
  return [
    `$paths = @(${joined})`,
    `$sh = New-Object -ComObject WScript.Shell`,
    `foreach ($p in $paths) {`,
    `  try { $link = $sh.CreateShortcut($p); Write-Output ("{0}|{1}|{2}" -f $link.TargetPath, $link.IconLocation, $link.Description) } catch { Write-Output ("{0}|||" -f $p) }`,
    `}`,
  ].join('\n');
}

export function parseShortcutOutput(csv: string): AppEntry[] {
  const apps: AppEntry[] = [];
  for (const line of csv.split('\n')) {
    if (!/\S/.test(line)) continue;
    let target: string;
    let iconPart = '';
    let description = '';
    if (line.includes('|')) {
      // 脚本真实输出格式：target|iconLocation|description
      const [t, i, d] = line.split('|');
      target = t ?? '';
      iconPart = i ?? '';
      description = d ?? '';
    } else {
      // 兼容 name,target 的 CSV 形式（首行表头跳过）
      const cols = line.split(',');
      if (cols.length < 2) continue;
      const first = cols[0].trim();
      const second = cols[1].trim();
      if (first.toLowerCase() === 'name') continue;
      description = first;
      target = second;
    }
    if (!target || !/\S/.test(target)) continue;
    const cleanTarget = trimQuotes(target);
    const icon = iconPart.split(',')[0];
    const name =
      (description && description.trim()) ||
      basename(cleanTarget).replace(/\.[^.]+$/, '') ||
      cleanTarget;
    apps.push({
      id: entryId(cleanTarget),
      name,
      iconPath: icon,
      target: cleanTarget,
      source: 'start-menu',
      categoryId: classifyAppName(name),
      pinned: false,
    });
  }
  return apps;
}

export function collectStartMenuLnk(dirs: string[]): string[] {
  return dirs.flatMap((d) => {
    if (!existsSync(d)) return [];
    return readdirSync(d)
      .filter((n) => extname(n).toLowerCase() === '.lnk')
      .map((n) => join(d, n));
  });
}

export async function scanAll(): Promise<{ apps: AppEntry[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (process.platform === 'win32') {
    const dirs = [
      join(process.env.ProgramData ?? '', 'Microsoft/Windows/Start Menu/Programs'),
      join(process.env.APPDATA ?? '', 'Microsoft/Windows/Start Menu/Programs'),
    ];
    const lnkFiles = collectStartMenuLnk(dirs);
    if (lnkFiles.length === 0) {
      warnings.push('未发现开始菜单快捷方式');
      return { apps: [], warnings };
    }
    const script = composeShortcutScript(lnkFiles);
    const out = await new Promise<string>((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
    });
    return { apps: parseShortcutOutput(out), warnings };
  }
  const lookup = [join('/usr/share/applications'), join(process.env.HOME ?? '', '.local/share/applications')];
  return { apps: scanDesktopDirs(lookup), warnings };
}
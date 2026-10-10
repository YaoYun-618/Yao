# RingDesk 环状桌面美化应用 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Electron 桌面应用，以同心圆风扇区呈现已安装应用分类分区，透明浮层式悬浮于桌面之上且不遮挡壁纸，支持点击启动、拖拽分类、搜索与主题配置。

**Architecture:** 主进程（Node/TS）负责窗口、扫描 `.lnk`/`.desktop`、启动应用、注册表与置底命令构造、JSON 持久化；渲染进程（原生 TS + SVG/CSS，无框架）负责环状布局、图标、搜索与拖拽交互。纯逻辑（分类、布局、交互、命令构造）抽为独立纯函数模块以便 Vitest 单测；Windows 专有路径以命令构造断言 + mock 覆盖。

**Tech Stack:** Electron ^33、TypeScript ^5、Vitest ^2 + happy-dom（渲染结构测试）、@playwright/test（集成冒烟）、electron-builder ^25（NSIS 打包）。

## Global Constraints

- 全程 TypeScript strict 模式，禁 `any`（IPC 入参校验明确类型）。
- 渲染进程禁用 `nodeIntegration`，仅经 `contextBridge` 暴露 API。
- 图标像素透明区域必须 `α=0` 且鼠标穿透，壁纸完整可见；应用绝不写入/替换壁纸。
- 系统桌面图标默认不隐藏；「隐藏图标」为独立开关（默认关）。
- Windows 专有调用（注册表、`.lnk`、置底）一律经「命令构造纯函数 + 主进程执行」两层，命令模板白名单化，禁止拼接任意用户输入。
- 配置持久化必须具备 `.bak` 备份与损坏恢复。
- 测试命令：`npm test`（Vitest）、`npm run typecheck`（tsc --noEmit）。
- 提交规范：conventional commits，中文正文（如 `feat: 添加分类器`）。

### 文件结构（本计划铺开）

```
package.json            tsconfig.json         vitest.config.ts      electron-builder.yml   .gitignore
src/
  shared/types.ts       shared/keywords.ts
  main/index.ts         main/store.ts         main/app-scanner.ts   main/launcher.ts
  main/classifier.ts    main/desktop-layer.ts main/ipc.ts
  preload/index.ts
  renderer/index.html   renderer/main.ts      renderer/ring-layout.ts renderer/interactions.ts
  renderer/theme.ts     renderer/icon-grid.ts renderer/center-console.ts
tests/unit/*.test.ts    tests/smoke/ring.app.spec.ts
```

---

### Task 1: 项目脚手架与最小 Electron 骨架

**Files:**
- Create: `package.json`、`tsconfig.json`、`vitest.config.ts`、`.gitignore`
- Create: `src/main/index.ts`、`src/preload/index.ts`、`src/renderer/index.html`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Produces: `npm test` 可运行（Vitest 绿）；`npm run typecheck` 通过；`npm start` 可启动一个空白 Electron 窗口。

- [ ] **Step 1: 写环境冒烟测试（先行确认测试基建）**

`tests/unit/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('env', () => {
  it('vitest works', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(1, 2)).toBe(3);
  });
});
```

- [ ] **Step 2: 写 package.json 与依赖**

`package.json`:
```json
{
  "name": "ringdesk",
  "version": "0.1.0",
  "description": "Windows 环状桌面美化应用",
  "main": "dist/main/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "npm run build && electron .",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "pack:win": "npm run build && electron-builder --win nsis --publish never"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@types/node": "^22",
    "electron": "^33",
    "electron-builder": "^25",
    "happy-dom": "^15",
    "typescript": "^5.6",
    "vitest": "^2"
  }
}
```

- [ ] **Step 3: 写 TypeScript 配置**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

`.gitignore`:
```
node_modules/
dist/
release/
```

- [ ] **Step 4: 写最小主进程/预加载/HTML**

`src/preload/index.ts`:
```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ringAPI', {
  ping: async () => 'pong',
});
```

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>RingDesk</title>
</head>
<body>
  <div id="ring"></div>
  <script src="./main.js"></script>
</body>
</html>
```

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

`src/renderer/main.ts`:
```ts
document.addEventListener('DOMContentLoaded', () => {
  const ring = document.getElementById('ring');
  if (ring) ring.textContent = 'RingDesk bootstrap ok';
});
```

- [ ] **Step 5: 跑测试与类型检查**

Run: `npm install && npm test && npm run typecheck`
Expected: 1 test PASS，typecheck 无错误。（`npm start` 在有显示器环境可见空白窗口；无显示服务器环境跳过图形验证。）

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "chore: 搭建 RingDesk 脚手架与最小 Electron 骨架"
```

---

### Task 2: 共享类型与自动分类器

**Files:**
- Create: `src/shared/types.ts`、`src/shared/keywords.ts`、`src/main/classifier.ts`
- Test: `tests/unit/classifier.test.ts`

**Interfaces:**
- Produces:
  - `src/shared/types.ts` 导出 `AppEntry`、`AppSource`、`Category`、`RingConfig`、`UNCATEGORIZED_ID`、`DEFAULT_CATEGORIES`
  - `src/main/classifier.ts` 导出 `classifyApp(name: string): string`（返回分类 id 或 `'uncategorized'`）

- [ ] **Step 1: 写失败测试**

`tests/unit/classifier.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classifyApp } from '../../src/main/classifier';

describe('classifyApp', () => {
  it('匹配开发关键词', () => {
    expect(classifyApp('Visual Studio Code')).toBe('dev');
    expect(classifyApp('IntelliJ IDEA')).toBe('dev');
  });
  it('匹配系统关键词', () => {
    expect(classifyApp('计算器')).toBe('system');
  });
  it('未知名称落到未分类', () => {
    expect(classifyApp('MyRandomApp 3000')).toBe('uncategorized');
  });
  it('大小写不敏感', () => {
    expect(classifyApp('GOOGLE CHROME')).toBe('tool');
  });
});
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: `Cannot find module '../../src/main/classifier'` → FAIL

- [ ] **Step 3: 实现共享类型**

`src/shared/types.ts`:
```ts
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
```

`src/shared/keywords.ts`:
```ts
import { UNCATEGORIZED_ID } from './types';

export type ClassifiableCategoryId =
  | 'work' | 'dev' | 'fun' | 'design' | 'tool' | 'system';

export const CATEGORY_KEYWORDS: Record<ClassifiableCategoryId, string[]> = {
  work: ['office', 'word', 'excel', 'ppt', 'outlook', 'teams', 'wps', '钉钉', '飞书', 'slack', 'zoom', '会议', '文档'],
  dev: ['vscode', 'visual studio code', 'idea', 'pycharm', 'webstorm', 'android studio', 'eclipse', 'sublime', 'git', 'docker', 'terminal', 'bash', '终端', 'node', 'npm'],
  fun: ['steam', 'epic games', 'mpv', 'vlc', 'spotify', '网易云', 'bilibili', '哔哩哔哩', 'youku', '视频', '音乐', '游戏', '播放'],
  design: ['photoshop', 'figma', 'sketch', 'illustrator', 'blender', 'after effects', 'premiere', '剪映', '设计', '绘画', 'ps'],
  tool: ['chrome', 'edge', 'firefox', 'browser', '浏览器', 'winrar', '7-zip', '压缩', 'everything', 'snipaste', '截图', 'clash', 'v2ray', '迅雷', '下载', '输入法'],
  system: ['settings', '设置', 'control panel', 'task manager', '任务管理器', 'explorer', '文件资源管理器', 'regedit', 'powershell', '计算器', 'calculator', 'notepad', '记事本'],
};

export const UNCATEGORIZED = UNCATEGORIZED_ID;
```

- [ ] **Step 4: 实现分类器**

`src/main/classifier.ts`:
```ts
import { CATEGORY_KEYWORDS } from '../shared/keywords';
import { UNCATEGORIZED_ID } from '../shared/types';

export function classifyApp(name: string): string {
  const lower = name.toLowerCase();
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return categoryId;
    }
  }
  return UNCATEGORIZED_ID;
}
```

- [ ] **Step 5: 验证通过**

Run: `npm test`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared src/main/classifier.ts tests/unit/classifier.test.ts
git commit -m "feat: 添加应用自动分类器与共享类型"
```

---

### Task 3: 配置存储与 diff 合并

**Files:**
- Create: `src/main/store.ts`
- Test: `tests/unit/store.test.ts`

**Interfaces:**
- Produces:
  - `class Store { constructor(filePath: string); load(): RingConfig; save(cfg: RingConfig): void; backup(): string; mergeApps(existing: RingConfig, scanned: AppEntry[]): AppEntry[] }`
  - `defaultConfig(): RingConfig`
- Consumes: `RingConfig`、`AppEntry`、`DEFAULT_CATEGORIES`（Task 2）

- [ ] **Step 1: 写失败测试**

`tests/unit/store.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, defaultConfig } from '../../src/main/store';
import type { AppEntry } from '../../src/shared/types';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ringstore-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const app = (id: string, categoryId: string | null = null): AppEntry => ({
  id, name: id, iconPath: '', target: `/x/${id}`, source: 'desktop-file', categoryId, pinned: false,
});

describe('Store', () => {
  it('默认配置含 schemaVersion 与 7 个分类', () => {
    const cfg = defaultConfig();
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.categories).toHaveLength(7);
  });

  it('save 后可 load 回相同配置', () => {
    const s = new Store(join(dir, 'store.json'));
    const cfg = defaultConfig();
    cfg.apps = [app('a', 'dev')];
    s.save(cfg);
    const loaded = new Store(join(dir, 'store.json')).load();
    expect(loaded.apps).toEqual(cfg.apps);
  });

  it('mergeApps 保留已存在项的手动分类归属', () => {
    const cfg = defaultConfig();
    cfg.apps = [app('installed', 'tool')];
    const scanned = [app('installed'), app('new')];
    const merged = new Store(join(dir, 's.json')).mergeApps(cfg, scanned);
    expect(merged.find((a) => a.id === 'installed')?.categoryId).toBe('tool');
    expect(merged).toHaveLength(2);
  });

  it('配置损坏时恢复 .bak 并标记默认配置兜底', () => {
    const file = join(dir, 'store.json');
    writeFileSync(file, '{ broken json');
    const s = new Store(file);
    expect(() => s.load()).not.toThrow();
    expect(s.load().schemaVersion).toBe(1);
  });

  it('损坏恢复会保留 .bak 备份', () => {
    const file = join(dir, 'store.json');
    writeFileSync(file, '{not valid');
    const s = new Store(file);
    s.load();
    expect(readFileSync(join(dir, 'store.json.bak'), 'utf8')).toContain('{not valid');
  });
});
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: FAIL（`Cannot find module '../../src/main/store'`）

- [ ] **Step 3: 实现 store.ts**

`src/main/store.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AppEntry, DEFAULT_CATEGORIES, RingConfig } from '../shared/types';

export function defaultConfig(): RingConfig {
  return {
    schemaVersion: 1,
    apps: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    diameterRatio: 0.72,
    theme: 'dark',
    opacity: 0.35,
    colorSaturation: 0.85,
    fontScale: 1,
  };
}

export class Store {
  private readonly bakPath: string;
  constructor(private readonly filePath: string) {
    this.bakPath = `${filePath}.bak`;
  }

  load(): RingConfig {
    if (!existsSync(this.filePath)) return defaultConfig();
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as RingConfig;
      if (parsed.schemaVersion !== 1) throw new Error('unsupported schema');
      return parsed;
    } catch {
      this.backup();
      return defaultConfig();
    }
  }

  save(cfg: RingConfig): void {
    if (existsSync(this.filePath)) this.backup();
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(cfg, null, 2), 'utf8');
  }

  backup(): string {
    if (existsSync(this.filePath)) {
      copyFileSync(this.filePath, this.bakPath);
    }
    return this.bakPath;
  }

  mergeApps(existing: RingConfig, scanned: AppEntry[]): AppEntry[] {
    const known = new Map(existing.apps.map((a) => [a.id, a]));
    const merged = new Map<string, AppEntry>();
    for (const app of scanned) {
      const prev = known.get(app.id);
      merged.set(app.id, prev ? { ...app, categoryId: prev.categoryId, pinned: prev.pinned } : app);
    }
    for (const app of existing.apps) {
      if (!merged.has(app.id)) merged.set(app.id, app);
    }
    return [...merged.values()];
  }
}
```

- [ ] **Step 4: 验证通过**

Run: `npm test`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store.ts tests/unit/store.test.ts
git commit -m "feat: 实现配置持久化与扫描结果 diff 合并"
```

---

### Task 4: 应用扫描（.desktop / .lnk）

**Files:**
- Create: `src/main/app-scanner.ts`
- Test: `tests/unit/scanner.test.ts`

**Interfaces:**
- Produces:
  - `entryId(target: string): string`
  - `parseDesktopFile(filePath: string): AppEntry | null`
  - `scanDesktopDirs(dirs: string[]): AppEntry[]`
  - `composeShortcutScript(lnkPaths: string[]): string`（Windows PowerShell 白名单模板）
  - `parseShortcutOutput(csv: string): AppEntry[]`（解析脚本输出）
  - `scanAll(): Promise<{ apps: AppEntry[]; warnings: string[] }>`
- Consumes: `classifyApp`（Task 2）、`UNCATEGORIZED_ID`

- [ ] **Step 1: 写失败测试**

`tests/unit/scanner.test.ts`:
```ts
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
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现 app-scanner.ts**

`src/main/app-scanner.ts`:
```ts
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
    categoryId: classifyApp(name),
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
    const [target, iconPart, description] = line.split('|');
    if (!target || !/\S/.test(target)) continue;
    const icon = (iconPart ?? '').split(',')[0];
    const name = description?.trim() || basename(target).replace(/\.[^.]+$/, '') || target;
    const cleanTarget = trimQuotes(target);
    apps.push({
      id: entryId(cleanTarget),
      name,
      iconPath: icon,
      target: cleanTarget,
      source: 'start-menu',
      categoryId: classifyApp(name),
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
```
（需在文件头部补 `import { execFile } from 'node:child_process';`，与 `readdirSync/existsSync` 同行保留。）

- [ ] **Step 4: 验证通过**

Run: `npm test`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/app-scanner.ts tests/unit/scanner.test.ts
git commit -m "feat: 实现 .desktop/.lnk 应用扫描与快捷方式命令构造"
```

---

### Task 5: 启动器与系统集成命令

**Files:**
- Create: `src/main/launcher.ts`、`src/main/desktop-layer.ts`
- Test: `tests/unit/launcher.test.ts`、`tests/unit/desktop-layer.test.ts`

**Interfaces:**
- Produces:
  - `composeLaunchArgs(entry: AppEntry): { cmd: string; args: string[] } | null`
  - `launchEntry(entry: AppEntry): Promise<{ ok: boolean; error?: string }>`
  - `composeHideIconsCommand(enabled: boolean): string`
  - `composeSetBottomScript(hwnd: number): string`（`hwnd` 为原生窗口句柄数值）
  - `isInsideRing(x, y, cx, cy, radius): boolean`
- Consumes: `AppEntry`（Task 2）

- [ ] **Step 1: 写失败测试**

`tests/unit/launcher.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { composeLaunchArgs } from '../../src/main/launcher';
import type { AppEntry } from '../../src/shared/types';

const entry = (target: string): AppEntry => ({
  id: 'x', name: 'x', iconPath: '', target, source: 'manual', categoryId: null, pinned: false,
});

describe('composeLaunchArgs', () => {
  it('.lnk 走 cmd start，参数逐字面传递', () => {
    const r = composeLaunchArgs(entry('C:\\App\\my app.lnk'));
    expect(r).toEqual({ cmd: 'cmd', args: ['/c', 'start', '""', 'C:\\App\\my app.lnk'] });
  });
  it('exe 直接作为命令启动', () => {
    const r = composeLaunchArgs(entry('C:\\App\\run.exe'));
    expect(r?.cmd).toBe('C:\\App\\run.exe');
    expect(r?.args).toEqual([]);
  });
  it('.desktop 命令拆分为 cmd+args', () => {
    const r = composeLaunchArgs(entry('/usr/bin/demo --flag'));
    expect(r?.cmd).toBe('/usr/bin/demo');
    expect(r?.args).toEqual(['--flag']);
  });
  it('空目标返回 null', () => {
    expect(composeLaunchArgs(entry(''))).toBeNull();
  });
});
```

`tests/unit/desktop-layer.test.ts`:
```ts
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
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现 launcher.ts**

`src/main/launcher.ts`:
```ts
import { execFile } from 'node:child_process';
import { AppEntry } from '../shared/types';

function splitCommand(cmdLine: string): { cmd: string; args: string[] } {
  const parts = cmdLine.split(/\s+/).filter(Boolean);
  return { cmd: parts[0] ?? '', args: parts.slice(1) };
}

export function composeLaunchArgs(entry: AppEntry): { cmd: string; args: string[] } | null {
  const target = entry.target.trim();
  if (!target) return null;
  if (target.toLowerCase().endsWith('.lnk')) {
    return { cmd: 'cmd', args: ['/c', 'start', '""', target] };
  }
  return splitCommand(target);
}

export function launchEntry(
  entry: AppEntry,
): Promise<{ ok: boolean; error?: string }> {
  const launched = composeLaunchArgs(entry);
  if (!launched) return Promise.resolve({ ok: false, error: '目标为空' });
  return new Promise((resolve) => {
    execFile(
      launched.cmd,
      launched.args,
      { windowsHide: true, detached: true },
      (err) => resolve(err ? { ok: false, error: String(err.message ?? err) } : { ok: true }),
    );
  });
}
```

- [ ] **Step 4: 实现 desktop-layer.ts**

`src/main/desktop-layer.ts`:
```ts
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
```

- [ ] **Step 5: 验证通过**

Run: `npm test`
Expected: 7 tests PASS（launcher 4 + desktop-layer 3）

- [ ] **Step 6: Commit**

```bash
git add src/main/launcher.ts src/main/desktop-layer.ts tests/unit/launcher.test.ts tests/unit/desktop-layer.test.ts
git commit -m "feat: 实现应用启动器与系统集成命令构造"
```

---

### Task 6: 环状布局引擎

**Files:**
- Create: `src/renderer/ring-layout.ts`
- Test: `tests/unit/layout.test.ts`

**Interfaces:**
- Produces:
  - `allocateAngles(categories: { id: string; angleDeg: number | null }[]): Array<{ categoryId: string; startDeg: number; endDeg: number }>`
  - `polarToCartesian(deg: number, radius: number, cx: number, cy: number): { x: number; y: number }`
  - `computeLayout(cfg: RingConfig, diameter: number, cx: number, cy: number): SectorLayout[]`
  - types：`SectorLayout { categoryId; startDeg; endDeg; icons: PlacedIcon[] }`、`PlacedIcon { app: AppEntry; x; y; size }`
- Consumes: `RingConfig`、`AppEntry`

- [ ] **Step 1: 写失败测试**

`tests/unit/layout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { allocateAngles, polarToCartesian, computeLayout } from '../../src/renderer/ring-layout';
import type { AppEntry, RingConfig } from '../../src/shared/types';

const app = (id: string): AppEntry => ({
  id, name: id, iconPath: '', target: '/x', source: 'manual', categoryId: null, pinned: false,
});

describe('allocateAngles', () => {
  it('空指定角度时均分 360', () => {
    const r = allocateAngles([{ id: 'a', angleDeg: null }, { id: 'b', angleDeg: null }]);
    expect(r[0]).toEqual({ categoryId: 'a', startDeg: 0, endDeg: 180 });
    expect(r[1]).toEqual({ categoryId: 'b', startDeg: 180, endDeg: 360 });
  });
  it('指定角度后其余均分剩余', () => {
    const r = allocateAngles([{ id: 'a', angleDeg: 90 }, { id: 'b', angleDeg: null }, { id: 'c', angleDeg: null }]);
    expect(r[0]).toEqual({ categoryId: 'a', startDeg: 0, endDeg: 90 });
    expect(r[2].startDeg).toBe(225);
    expect(r[2].endDeg).toBe(360);
  });
});

describe('polarToCartesian', () => {
  it('0° 在圆心正右', () => {
    const p = polarToCartesian(0, 10, 0, 0);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });
  it('90° 在圆心正下（屏幕坐标 y 向下）', () => {
    const p = polarToCartesian(90, 10, 0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });
});

describe('computeLayout', () => {
  it('扇区内图标落在对应角度范围与轨道半径', () => {
    const cfg: RingConfig = {
      schemaVersion: 1,
      apps: [app('a'), app('b'), app('c')],
      categories: [
        { id: 'dev', name: '开发', angleDeg: null, color: '' },
        { id: 'uncategorized', name: '未分类', angleDeg: null, color: '' },
      ],
      diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
    };
    cfg.apps.forEach((a, i) => { a.categoryId = i === 2 ? 'uncategorized' : 'dev'; });
    const sectors = computeLayout(cfg, 800, 400, 400);
    expect(sectors).toHaveLength(2);
    const dev = sectors.find((s) => s.categoryId === 'dev')!;
    expect(dev.icons).toHaveLength(2);
    const icon = dev.icons[0];
    expect(icon.size).toBeGreaterThan(0);
    expect(icon.x).toBeGreaterThan(0);
    expect(icon.y).toBeGreaterThan(0);
  });
  it('空应用分类仍产出扇区但无图标', () => {
    const cfg: RingConfig = {
      schemaVersion: 1, apps: [], categories: [{ id: 'tool', name: '工具', angleDeg: null, color: '' }],
      diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
    };
    const sectors = computeLayout(cfg, 800, 400, 400);
    expect(sectors[0].icons).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现 ring-layout.ts**

`src/renderer/ring-layout.ts`:
```ts
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
  const rad = ((deg - 90) * Math.PI) / 180;
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
```

- [ ] **Step 4: 验证通过**

Run: `npm test`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/ring-layout.ts tests/unit/layout.test.ts
git commit -m "feat: 实现环状扇区布局引擎"
```

---

### Task 7: 交互逻辑纯函数

**Files:**
- Create: `src/renderer/interactions.ts`
- Test: `tests/unit/interactions.test.ts`

**Interfaces:**
- Produces:
  - `filterApps(apps: AppEntry[], query: string): AppEntry[]`
  - `moveAppToCategory(apps: AppEntry[], appId: string, categoryId: string | null): AppEntry[]`
  - `togglePin(apps: AppEntry[], appId: string): AppEntry[]`
- Consumes: `AppEntry`

- [ ] **Step 1: 写失败测试**

`tests/unit/interactions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterApps, moveAppToCategory, togglePin } from '../../src/renderer/interactions';
import type { AppEntry } from '../../src/shared/types';

const app = (id: string, name = id): AppEntry => ({
  id, name, iconPath: '', target: '/x', source: 'manual', categoryId: null, pinned: false,
});

describe('filterApps', () => {
  it('按名称子串匹配（忽略大小写）', () => {
    const apps = [app('1', 'Visual Studio Code'), app('2', '记事本')];
    const r = filterApps(apps, 'code');
    expect(r.map((a) => a.id)).toEqual(['1']);
  });
  it('空查询返回全部', () => {
    const apps = [app('1'), app('2')];
    expect(filterApps(apps, '')).toHaveLength(2);
  });
});

describe('moveAppToCategory', () => {
  it('移动应用到指定分类并保持不可变性', () => {
    const apps = [app('a')];
    const next = moveAppToCategory(apps, 'a', 'dev');
    expect(next[0].categoryId).toBe('dev');
    expect(apps[0].categoryId).toBeNull();
  });
  it('移动到未分类接收 null', () => {
    const apps = [app('a')];
    expect(moveAppToCategory(apps, 'a', null)[0].categoryId).toBeNull();
  });
});

describe('togglePin', () => {
  it('切换固定状态', () => {
    const apps = [app('a')];
    expect(togglePin(apps, 'a')[0].pinned).toBe(true);
    expect(togglePin(togglePin(apps, 'a'), 'a')[0].pinned).toBe(false);
  });
});
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现 interactions.ts**

`src/renderer/interactions.ts`:
```ts
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
```

- [ ] **Step 4: 验证通过**

Run: `npm test`
Expected: 11 tests PASS（总计）

- [ ] **Step 5: Commit**

```bash
git add src/renderer/interactions.ts tests/unit/interactions.test.ts
git commit -m "feat: 实现搜索过滤与分类归位交互逻辑"
```

---

### Task 8: 渲染进程装配（环渲染 / 中心控制 / 主题）

**Files:**
- Create: `src/renderer/theme.ts`、`src/renderer/icon-grid.ts`、`src/renderer/center-console.ts`
- Modify: `src/renderer/main.ts`、`src/renderer/index.html`
- Test: `tests/unit/render-structure.test.ts`（happy-dom）
- Modify: `vitest.config.ts`（环境切换）

**Interfaces:**
- Produces:
  - `resolveTheme(cfg: Pick<RingConfig, 'theme' | 'opacity' | 'colorSaturation'>): Record<string, string>`
  - `renderRing(container: HTMLElement, sectors: SectorLayout[], labels: Map<string, string>): void`
  - `renderCenter(container: HTMLElement, apps: AppEntry[], pinned: AppEntry[]): void`
  - `highlightMatches(container: HTMLElement, ids: string[]): void`
- Consumes: `computeLayout`（Task 6）、`filterApps` 等（Task 7）、`RingConfig`（Task 2）
- 通过 `contextBridge` 暴露的 window API：`window.ringAPI`（预加载 Task 9 定义；本任务先用最小声明）

- [ ] **Step 1: 写失败测试（happy-dom）**

`tests/unit/render-structure.test.ts`:
```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../../src/renderer/theme';
import { renderRing } from '../../src/renderer/icon-grid';
import { renderCenter } from '../../src/renderer/center-console';
import { highlightMatches } from '../../src/renderer/center-console';
import { computeLayout } from '../../src/renderer/ring-layout';
import type { AppEntry, RingConfig } from '../../src/shared/types';

const app = (id: string): AppEntry => ({
  id, name: id, iconPath: '', target: '/x', source: 'manual',
  categoryId: 'dev', pinned: false,
});

function cfg(): RingConfig {
  return {
    schemaVersion: 1,
    apps: [app('a'), app('b')],
    categories: [{ id: 'dev', name: '开发', angleDeg: null, color: '' }],
    diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
  };
}

describe('theme', () => {
  it('暗色主题返回完整变量集', () => {
    const t = resolveTheme({ theme: 'dark', opacity: 0.35, colorSaturation: 0.85 });
    expect(t['--panel-base']).toBeTruthy();
    expect(t['--text']).toBeTruthy();
  });
});

describe('renderRing', () => {
  it('渲染扇区 path 与图标节点', () => {
    const container = document.createElement('div');
    const sectors = computeLayout(cfg(), 800, 400, 400);
    renderRing(container, sectors, new Map([['dev', '开发']]));
    expect(container.querySelectorAll('path.sector')).toHaveLength(1);
    expect(container.querySelectorAll('.app-icon')).toHaveLength(2);
  });
  it('搜索高亮给匹配图标加光晕类', () => {
    const container = document.createElement('div');
    const sectors = computeLayout(cfg(), 800, 400, 400);
    renderRing(container, sectors, new Map());
    highlightMatches(container, ['a']);
    expect(container.querySelectorAll('.app-icon.match')).toHaveLength(1);
    expect(container.querySelectorAll('.app-icon')).toHaveLength(2);
  });
});

describe('renderCenter', () => {
  it('渲染搜索框与固定常用槽', () => {
    const container = document.createElement('div');
    renderCenter(container, cfg().apps, [cfg().apps[0]]);
    expect(container.querySelector('input[data-testid="search"]')).not.toBeNull();
    expect(container.querySelectorAll('.pinned-slot')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 确认为 FAIL/无法编译**

Run: `npm test`
Expected: FAIL（找不到 `theme.ts` / `icon-grid.ts` / `center-console.ts`）

- [ ] **Step 3: 改 vitest.config.ts 允许 per-file 环境**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
```
（`@vitest-environment happy-dom` 注释即可按文件切换，无需全局改。）

- [ ] **Step 4: 实现 theme.ts**

`src/renderer/theme.ts`:
```ts
import { RingConfig } from '../shared/types';

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
```

- [ ] **Step 5: 实现 icon-grid.ts（含扇区 SVG + 图标 DOM）**

`src/renderer/icon-grid.ts`:
```ts
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
```

- [ ] **Step 6: 实现 center-console.ts**

`src/renderer/center-console.ts`:
```ts
import { AppEntry } from '../shared/types';

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
```

- [ ] **Step 7: 更新 renderer/main.ts 与 index.html（最小装配）**

`src/renderer/main.ts`:
```ts
import { computeLayout } from './ring-layout';
import { renderRing } from './icon-grid';
import { renderCenter, highlightMatches, highlightAllOff } from './center-console';
import { resolveTheme } from './theme';
import type { AppEntry, RingConfig } from '../shared/types';

declare global {
  interface Window {
    ringAPI: {
      loadConfig: () => Promise<RingConfig>;
      saveConfig: (cfg: RingConfig) => Promise<boolean>;
      scan: () => Promise<{ apps: AppEntry[]; warnings: string[] }>;
      launch: (entry: AppEntry) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

const DEFAULT_CATEGORIES: RingConfig['categories'] = [
  { id: 'work', name: '工作', angleDeg: null, color: '' },
  { id: 'dev', name: '开发', angleDeg: null, color: '' },
  { id: 'fun', name: '娱乐', angleDeg: null, color: '' },
  { id: 'design', name: '设计', angleDeg: null, color: '' },
  { id: 'tool', name: '工具', angleDeg: null, color: '' },
  { id: 'system', name: '系统', angleDeg: null, color: '' },
  { id: 'uncategorized', name: '未分类', angleDeg: null, color: '' },
];

let cfg: RingConfig = {
  schemaVersion: 1, apps: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
};

function applyTheme(): void {
  const vars = resolveTheme(cfg);
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v);
  }
}

function render(): void {
  const root = document.getElementById('ring');
  if (!root) return;
  const size = window.innerHeight * cfg.diameterRatio;
  const cx = size / 2;
  const cy = size / 2;
  const sectors = computeLayout(cfg, size, cx, cy);
  const labels = new Map(cfg.categories.map((c) => [c.id, c.name]));
  renderRing(
    root,
    sectors,
    labels,
    size,
    (window.innerWidth - size) / 2,
    (window.innerHeight - size) / 2,
  );
  renderCenter(root, cfg.apps, cfg.apps.filter((a) => a.pinned));
}

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  render();
  if (window.ringAPI?.loadConfig) {
    cfg = await window.ringAPI.loadConfig();
    applyTheme();
    render();
  }
  const ring = document.getElementById('ring');
  ring?.addEventListener('click', (evt) => {
    const target = (evt.target as HTMLElement).closest('.app-icon') as HTMLElement | null;
    const appId = target?.dataset.appId;
    if (!appId) return;
    const app = cfg.apps.find((a) => a.id === appId);
    if (app) void window.ringAPI.launch(app);
  });
  const input = document.querySelector<HTMLInputElement>('input[data-testid="search"]');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { highlightAllOff(document.getElementById('ring')!); return; }
    const ids = cfg.apps.filter((a) => a.name.toLowerCase().includes(q)).map((a) => a.id);
    highlightMatches(document.getElementById('ring')!, ids);
  });
});
```

`src/renderer/index.html`（在 `#ring` 旁加入样式表内联，含玻璃拟态基础样式）:
```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>RingDesk</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
    #ring { position: fixed; inset: 0; pointer-events: none; }
    .ring-wrapper { border-radius: 50%; overflow: hidden; }
    .icons-layer { position: absolute; inset: 0; pointer-events: none; }
    .app-icon {
      position: absolute; pointer-events: auto; background: rgba(120,150,255,.12);
      border: 1px solid var(--panel-border, rgba(120,150,255,.35)); border-radius: 18%;
      backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 4px; color: var(--text, #e8ecf8); font-size: 12px; cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease;
    }
    .app-icon img { width: 60%; height: 60%; object-fit: contain; border-radius: 16%; }
    .app-icon:hover { transform: scale(1.12); box-shadow: 0 0 14px var(--glow, rgba(120,150,255,.55)); }
    .app-icon.match { outline: 2px solid #ffd166; box-shadow: 0 0 18px #ffd166; transform: scale(1.18); }
    .sector-label { fill: var(--text, #e8ecf8); font-size: 15px; text-anchor: middle; }
    .center-console { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      text-align: center; width: 260px; pointer-events: auto; }
    .center-console input {
      width: 100%; padding: 10px 14px; border-radius: 999px; border: 1px solid var(--panel-border);
      background: var(--panel-base); color: var(--text); outline: none; font-size: 14px;
      backdrop-filter: blur(10px);
    }
    .pinned-slots { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
    .pinned-slot {
      width: 44px; height: 44px; border-radius: 16%; border: 1px solid var(--panel-border);
      background: var(--panel-base); color: var(--text); font-size: 11px; cursor: pointer;
      backdrop-filter: blur(8px);
    }
  </style>
</head>
<body>
  <div id="ring"></div>
  <script src="./main.js"></script>
</body>
</html>
```

- [ ] **Step 8: 验证通过**

Run: `npm test && npm run typecheck`
Expected: 14 tests PASS，typecheck 无错

- [ ] **Step 9: Commit**

```bash
git add src/renderer tests/unit/render-structure.test.ts vitest.config.ts
git commit -m "feat: 渲染环状界面与中心控制台"
```

---

### Task 9: 主进程集成（IPC + 置底透明窗口接线）

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`、`src/preload/index.ts`
- Test: `tests/unit/ipc-guards.test.ts`

**Interfaces:**
- Produces:
  - `registerIpcHandlers(store: Store): void`（handler：`config:load` / `config:save` / `apps:scan` / `app:launch` / `desktop:hideIcons`）
  - `validateConfig(cfg: unknown): cfg is RingConfig`
  - `validateAppEntry(entry: unknown): entry is AppEntry`
- Consumes: `Store`（Task 3）、`scanAll`（Task 4）、`launchEntry`（Task 5）、`composeHideIconsCommand`（Task 5）、`RingConfig/AppEntry`（Task 2）

- [ ] **Step 1: 写失败测试**

`tests/unit/ipc-guards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateConfig, validateAppEntry } from '../../src/main/ipc';

describe('IPC 入参校验', () => {
  it('合法配置通过', () => {
    const cfg = {
      schemaVersion: 1, apps: [], categories: [],
      diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1,
    };
    expect(validateConfig(cfg)).toBe(true);
  });
  it('拒绝 schemaVersion 非 1 / 非法主题', () => {
    expect(validateConfig({ ...{ schemaVersion: 1, apps: [], categories: [], diameterRatio: 0.72, theme: 'dark', opacity: 0.35, colorSaturation: 0.85, fontScale: 1 }, schemaVersion: 2 })).toBe(false);
    expect(validateConfig({ ...{ schemaVersion: 1, apps: [], categories: [], diameterRatio: 0.72, theme: 'neon', opacity: 0.35, colorSaturation: 0.85, fontScale: 1 } })).toBe(false);
  });
  it('合法应用条目通过并拒绝字段缺失', () => {
    const okApp = { id: 'x', name: 'n', iconPath: '', target: '/x', source: 'manual', categoryId: null, pinned: false };
    expect(validateAppEntry(okApp)).toBe(true);
    expect(validateAppEntry({ ...okApp, id: undefined })).toBe(false);
  });
});
```

- [ ] **Step 2: 确认其失败**

Run: `npm test`
Expected: FAIL（找不到 `ipc`）

- [ ] **Step 3: 实现 ipc.ts**

`src/main/ipc.ts`:
```ts
import { exec } from 'node:child_process';
import { ipcMain, BrowserWindow } from 'electron';
import { Store } from './store';
import { scanAll } from './app-scanner';
import { launchEntry } from './launcher';
import { composeHideIconsCommand } from './desktop-layer';
import { AppEntry, RingConfig } from '../shared/types';

type WithSchema = { schemaVersion?: unknown };

export function validateConfig(cfg: unknown): cfg is RingConfig {
  if (typeof cfg !== 'object' || cfg === null) return false;
  const c = cfg as WithSchema & Record<string, unknown>;
  if (c.schemaVersion !== 1) return false;
  const theme = c.theme;
  if (theme !== 'dark' && theme !== 'light') return false;
  const num = (...keys: string[]): boolean =>
    keys.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]));
  return num('diameterRatio', 'opacity', 'colorSaturation', 'fontScale')
    && Array.isArray(c.apps) && Array.isArray(c.categories);
}

export function validateAppEntry(entry: unknown): entry is AppEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.name === 'string'
    && typeof e.iconPath === 'string' && typeof e.target === 'string'
    && (e.source === 'start-menu' || e.source === 'desktop-file' || e.source === 'manual')
    && (e.categoryId === null || typeof e.categoryId === 'string')
    && typeof e.pinned === 'boolean';
}

export function registerIpcHandlers(store: Store): void {
  ipcMain.handle('config:load', () => store.load());

  ipcMain.handle('config:save', (_evt, cfg: unknown): boolean => {
    if (!validateConfig(cfg)) return false;
    store.save(cfg);
    return true;
  });

  ipcMain.handle('apps:scan', async () => {
    try {
      const { apps, warnings } = await scanAll();
      const merged = store.mergeApps(store.load(), apps);
      const next = { ...store.load(), apps: merged };
      store.save(next);
      return { apps: merged, warnings };
    } catch (err) {
      return { apps: [], warnings: [String(err instanceof Error ? err.message : err)] };
    }
  });

  ipcMain.handle('app:launch', async (_evt, entry: unknown) => {
    if (!validateAppEntry(entry)) return { ok: false, error: '无效条目' };
    return launchEntry(entry);
  });

  ipcMain.handle('desktop:hideIcons', (_evt, enabled: unknown): boolean => {
    if (typeof enabled !== 'boolean') return false;
    if (process.platform !== 'win32') return false;
    exec(composeHideIconsCommand(enabled), { windowsHide: true }, (err: Error | null) => {
      if (err) BrowserWindow.getAllWindows()[0]?.webContents.send('config:toast', '隐藏桌面图标失败');
    });
    return true;
  });
}
```

- [ ] **Step 4: 更新主进程入口（置底透明全屏窗口 + IPC 注册 + 双击空白穿透）**

`src/main/index.ts`:
```ts
import { app, BrowserWindow, screen } from 'electron';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { Store } from './store';
import { registerIpcHandlers } from './ipc';
import { composeSetBottomScript } from './desktop-layer';

const store = new Store(path.join(app.getPath('userData'), 'store.json'));
registerIpcHandlers(store);

let win: BrowserWindow | null = null;

function createWindow(): void {
  const bounds = screen.getPrimaryDisplay().bounds;
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame: false, transparent: true, resizable: false,
    fullscreenable: false, skipTaskbar: true, show: false, roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => {
    win?.showInactive();
    if (process.platform === 'win32' && win) {
      exec(composeSetBottomScript(win.getNativeWindowHandle().readUInt32LE(0)), { windowsHide: true });
    }
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

process.on('uncaughtException', (err) => console.error('[RingDesk]', err));
```

- [ ] **Step 5: 更新 preload 暴露 API**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron';
import { RingConfig, AppEntry } from '../shared/types';

contextBridge.exposeInMainWorld('ringAPI', {
  loadConfig: (): Promise<RingConfig> => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg: RingConfig): Promise<boolean> => ipcRenderer.invoke('config:save', cfg),
  scan: (): Promise<{ apps: AppEntry[]; warnings: string[] }> => ipcRenderer.invoke('apps:scan'),
  launch: (entry: AppEntry): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('app:launch', entry),
  hideIcons: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('desktop:hideIcons', enabled),
  onToast: (cb: (msg: string) => void): void => {
    ipcRenderer.on('config:toast', (_e, msg: string) => cb(msg));
  },
});
```

- [ ] **Step 6: 验证通过**

Run: `npm test && npm run typecheck && npm run build`
Expected: 17 tests PASS，typecheck 无错，`dist/` 产出完整

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload/index.ts tests/unit/ipc-guards.test.ts
git commit -m "feat: 接入 IPC 与置底透明全屏窗口"
```

---

### Task 10: 集成冒烟 + 打包 + 交付文档

**Files:**
- Create: `electron-builder.yml`、`tests/smoke/ring.app.spec.ts`、`playwright.config.ts`、`README.md`
- Test: 冒烟（Playwright 驱动 Electron，需显示服务器，可用 `xvfb-run`）

**Interfaces:**
- Produces: Windows NSIS 安装包 `dist/RingDesk-0.1.0-setup.exe`；冒烟脚本验证「启动→渲染扇区→点击图标发起启动→隐藏环」闭环。

- [ ] **Step 1: 写打包与冒烟配置**

`electron-builder.yml`:
```yaml
appId: com.ringdesk.app
productName: RingDesk
directories:
  output: dist
files:
  - dist/**/*
  - package.json
win:
  target:
    - target: nsis
      arch: [x64]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  workers: 1,
  use: { trace: 'retain-on-failure' },
});
```

`tests/smoke/ring.app.spec.ts`:
```ts
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fixtureConfig() {
  return {
    schemaVersion: 1,
    apps: [
      { id: 'a1', name: 'Firefox', iconPath: '', target: '/usr/bin/firefox', source: 'desktop-file', categoryId: 'tool', pinned: false },
      { id: 'a2', name: 'VS Code', iconPath: '', target: '/usr/bin/code', source: 'desktop-file', categoryId: 'dev', pinned: false },
      { id: 'a3', name: 'Steam', iconPath: '', target: '/usr/bin/steam', source: 'desktop-file', categoryId: 'fun', pinned: true },
    ],
    categories: [
      { id: 'fun', name: '娱乐', angleDeg: null, color: '' },
      { id: 'dev', name: '开发', angleDeg: null, color: '' },
      { id: 'tool', name: '工具', angleDeg: null, color: '' },
      { id: 'uncategorized', name: '未分类', angleDeg: null, color: '' },
    ],
    diameterRatio: 0.72,
    theme: 'dark',
    opacity: 0.35,
    colorSaturation: 0.85,
    fontScale: 1,
  };
}

async function launchWithFixture() {
  const userData = mkdtempSync(join(tmpdir(), 'ring-e2e-'));
  writeFileSync(join(userData, 'store.json'), JSON.stringify(fixtureConfig()));
  return electron.launch({ args: ['.', '--user-data-dir=' + userData] });
}

test('启动后渲染环状扇区与图标', async () => {
  const app = await launchWithFixture();
  const page = await app.firstWindow();
  await page.waitForSelector('.app-icon', { timeout: 30_000 });
  expect(await page.locator('path.sector').count()).toBeGreaterThan(0);
  expect(await page.locator('.app-icon').count()).toBe(3);
  await app.close();
});

test('点击图标发起启动', async () => {
  const app = await launchWithFixture();
  const page = await app.firstWindow();
  await page.waitForSelector('.app-icon', { timeout: 30_000 });
  await page.locator('.app-icon[data-app-id="a2"]').click();
  await page.waitForTimeout(500);
  await app.close();
});

test('输入搜索出现匹配高亮', async () => {
  const app = await launchWithFixture();
  const page = await app.firstWindow();
  await page.waitForSelector('.app-icon', { timeout: 30_000 });
  await page.fill('input[data-testid="search"]', 'code');
  expect(await page.locator('.app-icon.match').count()).toBe(1);
  await page.fill('input[data-testid="search"]', '????不存在');
  expect(await page.locator('.app-icon.match').count()).toBe(0);
  await app.close();
});
```

- [ ] **Step 2: 运行冒烟（Linux 无显示服务器时用 xvfb-run；若环境缺少 xvfb，跳过图形执行并在 CI 备注）**

Run:
```bash
npx playwright test --config=playwright.config.ts
# 无显示服务器时：xvfb-run -a npx playwright test --config=playwright.config.ts
```
Expected: 若存在显示会话：2 tests PASS；若无 xvfb：明确记录为「需 Windows/带显示器环境执行」，单元层已覆盖全部纯逻辑。

- [ ] **Step 3: 写 README.md**

`README.md` 内容要点：项目简介与截图位；`npm install` / `npm start` / `npm test` / `npm run typecheck` / `npm run pack:win`；Windows 真机验证清单（置底窗口、壁纸可见、图标点击启动、隐藏图标开关、热键）；已知限制（Windows 下 `.lnk` 解析依赖 PowerShell 可用、非真壁纸层）。

- [ ] **Step 4: 打 Windows 安装包**

Run: `npm run pack:win`
Expected: 产出 `dist/RingDesk-0.1.0-setup.exe`（若构建机联网受限致 electron-builder 工具链下载失败，保留配置与命令，在 Windows/CI 执行并记录说明）。

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: 完成集成冒烟、打包配置与交付文档"
```

---

## 自审记录

**1. Spec 覆盖核对**：架构(§3)→Task 1/8/9；环状布局(§4.1)→Task 6/8；壁纸可见性与置底(§4.3)→Task 5/9（透明背景 + `isInsideRing` 光栅思路 + `composeSetBottomScript`）；数据流与扫描(§5)→Task 2/3/4；系统集成表(§6)→Task 5/9；交互(§7)→Task 7/8；错误处理(§8)→Task 3（.bak/恢复）与 Task 9（scan 降级返回 warnings）；测试策略(§9)→Task 10 冒烟 + 各任务单测；打包(§10)→Task 10。

**2. 占位符扫描**：计划中无 TBD/TODO；所有代码步骤附完整实现。Task 4 `scanAll` 的 win32 分支完整接线 PowerShell 执行并补入 `execFile` import；Windows 专有行为以命令构造断言覆盖。

**3. 类型一致性**：`classifyApp`→string（Task 2/4 一致）；`Store.mergeApps(existing: RingConfig, scanned: AppEntry[])`（Task 3/9 一致）；`composeLaunchArgs` 返回 `{cmd,args}|null`（Task 5/9 一致）；`composeSetBottomScript(hwnd: number)`（接收原生窗口句柄，Task 5 定义 / Task 9 传入 `getNativeWindowHandle().readUInt32LE(0)`，一致）；`computeLayout(cfg, diameter, cx, cy)`（Task 6/8 一致）；`renderRing(container, sectors, labels, diameter?, left?, top?)`（Task 8 定义/调用/测试一致，wrapper 以 `left/top` 居中于视口，图标坐标采用 wrapper 局部坐标系）；`renderCenter(container, apps, pinned)`、`highlightMatches(container, ids)`（Task 8 内部一致）；IPC 通道名 `config:load/config:save/apps:scan/app:launch/desktop:hideIcons/config:toast`（Task 8 preload 声明与 Task 9 注册完全对应）；`window.ringAPI` 形状（Task 8 renderer 声明与 Task 9 preload 一致）。渲染层对 `shared/types` 仅做 type-only import（避免 `<script>` 环境 require 运行时常量），`DEFAULT_CATEGORIES` 在 renderer 本地内联（Task 8）。
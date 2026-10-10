# RingDesk

Windows 环状桌面美化应用 —— 以同心圆风扇区呈现已安装应用分类分区，透明浮层式悬浮于桌面之上且不遮挡壁纸，支持点击启动、拖拽分类、搜索与主题配置。

> 截图位（待补）：环状扇区 + 中心控制台 + 透明背景下的桌面壁纸。

## 功能概览

- **环状布局**：按分类将应用图标排布在同心圆扇区中，扇区按分类着色。
- **透明浮层**：全屏透明窗口置底于桌面图标层之下，壁纸完整可见；应用绝不写入/替换壁纸。
- **点击启动**：点击环上图标即启动对应应用（Windows 走 `.lnk` 目标，Linux 走 `.desktop` Exec）。
- **拖拽分类**：拖动图标在扇区间移动以重新归类，结果持久化。
- **搜索高亮**：中心控制台输入关键词，匹配图标高亮，其余淡化。
- **主题与配置**：深色/浅色主题、不透明度、色彩饱和度、字号缩放，JSON 持久化（含 `.bak` 损坏恢复）。
- **隐藏桌面图标**：独立开关（默认关），可选隐藏系统桌面图标以获得更纯净的壁纸视图。

## 安装与运行

前置：Node.js 18+（推荐 22），npm 10+。

```bash
# 安装依赖
npm install

# 开发启动（编译 TS 并启动 Electron）
npm start

# 单元测试（Vitest，41 用例覆盖全部纯逻辑）
npm test

# 类型检查
npm run typecheck

# 打 Windows NSIS 安装包（需在 Windows 或配齐 wine 的 CI 执行）
npm run pack:win
```

## 集成冒烟测试

冒烟测试位于 `tests/smoke/ring.app.spec.ts`，由 Playwright 驱动 Electron，验证「启动 → 渲染扇区与图标 → 点击图标发起启动 → 搜索匹配高亮」闭环。

```bash
# 有显示器的环境
npx playwright test --config=playwright.config.ts

# Linux 无显示器服务器
xvfb-run -a npx playwright test --config=playwright.config.ts
```

> 当前 Linux 无显示器构建机缺少 `libgtk-3` 等图形库，冒烟需在带显示器/Windows 环境执行。单元层（41 用例）已覆盖全部纯逻辑：分类器、存储 diff 合并、扫描器（`.desktop`/`.lnk` 解析与 PowerShell 命令构造）、布局引擎、渲染结构、交互、启动器命令构造、置底脚本构造、IPC 守卫。

## Windows 真机验证清单

打包后在 Windows 真机执行以下逐项确认：

- [ ] **置底窗口**：应用窗口位于桌面图标层之下，不遮挡桌面图标（除非开启「隐藏图标」）。
- [ ] **壁纸可见**：窗口透明区域鼠标穿透，壁纸完整可见，应用未修改壁纸文件。
- [ ] **图标点击启动**：点击环上图标成功启动对应应用（验证 Firefox / VS Code / Steam 等代表性目标）。
- [ ] **隐藏图标开关**：开启后桌面图标隐藏，关闭后恢复；开关状态持久化。
- [ ] **热键**：全局热键可呼出/隐藏环（若已绑定）。
- [ ] **拖拽分类**：拖动图标至另一扇区，分类归属更新并持久化，重启后保留。
- [ ] **搜索高亮**：输入关键词后匹配图标高亮、非匹配淡化，清空后恢复。
- [ ] **配置持久化与恢复**：手动破坏 `store.json` 后重启，应用以默认配置启动且保留 `.bak` 备份。

## 打包

`electron-builder.yml` 配置：

- `appId: com.ringdesk.app`
- `productName: RingDesk`
- Windows NSIS x64 安装包，非一键安装，允许选择安装目录，创建桌面快捷方式。
- 产物输出至 `dist/`，包含 `RingDesk-0.1.0-setup.exe`。

```bash
npm run pack:win
```

> 在 Linux 上 cross-build Windows NSIS 需下载 electron-builder 工具链（wine 等）。若联网受限或工具链下载失败，请在 Windows 机器或配齐 wine 的 CI 环境执行。当前构建机未产出安装包，配置与命令已就绪。

## 已知限制

- **Windows `.lnk` 解析依赖 PowerShell**：应用扫描通过白名单化的 PowerShell 脚本解析开始菜单 `.lnk` 目标，需目标机器 PowerShell 可用（Windows 10+ 默认满足）。
- **非真壁纸层**：本应用以透明置底窗口呈现，不替换或修改系统壁纸文件；「壁纸可见」由窗口透明 + 鼠标穿透 + 置底实现，而非壁纸图层操作。
- **Linux 开发预览模式**：Linux 下 `.desktop` 扫描与启动为开发预览支持，置底/隐藏桌面图标等 Windows 专有能力在 Linux 不生效。
- **图标透明区域**：要求图标像素透明区域 `α=0` 且鼠标穿透；非 PNG 透明格式的图标可能存在穿透偏差。

## 技术栈

- Electron ^33（主进程 + preload + renderer）
- TypeScript ^5 strict（禁 `any`）
- Vitest ^2 + happy-dom（单元测试）
- @playwright/test ^1.64（集成冒烟）
- electron-builder ^25（NSIS 打包）
- 渲染层：原生 TS + SVG/CSS，无前端框架

## 项目结构

```
src/
  shared/types.ts        共享类型与默认分类
  shared/keywords.ts     分类关键词表
  main/index.ts          主进程入口
  main/store.ts          配置持久化与 diff 合并
  main/app-scanner.ts    应用扫描（.desktop / .lnk）
  main/launcher.ts       应用启动器与命令构造
  main/classifier.ts     自动分类器
  main/desktop-layer.ts  置底/隐藏图标命令构造
  main/ipc.ts            IPC 通道注册与守卫
  preload/index.ts       contextBridge API 暴露
  renderer/              环状布局、图标、交互、主题、中心控制台
tests/unit/              41 个单元测试
tests/smoke/             Playwright 集成冒烟
electron-builder.yml     打包配置
playwright.config.ts     冒烟配置
```

## 开发

提交规范：conventional commits，中文正文（如 `feat: 添加分类器`）。

测试命令：

- `npm test` — Vitest 单元测试
- `npm run typecheck` — tsc --noEmit 类型检查
- `npx playwright test --config=playwright.config.ts` — 集成冒烟（需显示器）

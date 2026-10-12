#!/usr/bin/env node
/**
 * 复制静态资源到 dist/。
 * tsc 只编译 .ts 文件，不会复制 HTML/CSS 等静态资源，这里统一补齐。
 * 用法：build 脚本中 tsc 之后执行 `node scripts/copy-assets.js`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 需要复制的静态资源映射（源路径 -> 目标路径，均相对项目根目录）
const ASSETS = [
  { from: 'src/renderer/index.html', to: 'dist/renderer/index.html' },
];

let failed = false;
for (const { from, to } of ASSETS) {
  const src = path.join(ROOT, from);
  const dest = path.join(ROOT, to);
  if (!fs.existsSync(src)) {
    console.error(`[copy-assets] 缺少源文件: ${from}`);
    failed = true;
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[copy-assets] OK ${from} -> ${to}`);
}

if (failed) {
  process.exit(1);
}

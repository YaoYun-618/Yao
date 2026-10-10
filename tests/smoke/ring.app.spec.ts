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

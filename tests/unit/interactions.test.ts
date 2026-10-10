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
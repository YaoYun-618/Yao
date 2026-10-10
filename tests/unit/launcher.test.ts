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
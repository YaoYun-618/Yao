/**
 * 文件名: launcher.ts
 * 描述: 应用启动器——将 AppEntry 目标解析为可执行命令并启动
 */
import { execFile } from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';
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
  // detached 存在于 SpawnOptions，execFile 内部透传给 spawn（Overload 需用 SpawnOptions 规避字面量多余属性检查）
  const options: SpawnOptions = { windowsHide: true, detached: true };
  return new Promise((resolve) => {
    execFile(
      launched.cmd,
      launched.args,
      options,
      (err) => resolve(err ? { ok: false, error: String(err.message ?? err) } : { ok: true }),
    );
  });
}
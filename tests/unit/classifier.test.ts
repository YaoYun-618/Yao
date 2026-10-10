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
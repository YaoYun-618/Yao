import { describe, it, expect } from 'vitest';

describe('env', () => {
  it('vitest works', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(1, 2)).toBe(3);
  });
});
import { describe, it, expect } from 'vitest';
import { expandMacros } from './index';

describe('preprocessor (足場)', () => {
  it('現時点では入力をそのまま返す', () => {
    expect(expandMacros('[A] = 1;')).toBe('[A] = 1;');
  });
});

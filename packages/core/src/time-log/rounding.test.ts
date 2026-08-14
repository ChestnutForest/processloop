import { describe, expect, it } from 'vitest';
import { roundTimeLog } from './rounding';

describe('roundTimeLog', () => {
  it('UT-B4-01: 59秒999ミリ秒ではログを作らない', () => {
    expect(roundTimeLog(59_999, 0)).toBeNull();
  });

  it('UT-B4-02: 1分29秒999ミリ秒の作業はdelta=1に丸める', () => {
    expect(roundTimeLog(89_999, 0)).toEqual({ delta: 1, interrupt: 0 });
  });

  it('UT-B4-03: 1分30秒の作業はdelta=2に丸める', () => {
    expect(roundTimeLog(90_000, 0)).toEqual({ delta: 2, interrupt: 0 });
  });

  it('UT-B4-04: 1分59秒の中断はinterrupt=1に切り捨てる', () => {
    expect(roundTimeLog(60_000, 119_000)).toEqual({ delta: 1, interrupt: 1 });
  });

  it('interruptはdeltaを超えてよい', () => {
    expect(roundTimeLog(60_000, 180_000)).toEqual({ delta: 1, interrupt: 3 });
  });
});

import { describe, expect, it } from 'vitest';
import type { Clock, MonotonicClock } from './clock';
import { MonotonicElapsedTimer } from './clock';
import {
  checkpointSession,
  pauseSession,
  restoreSession,
  resumeSession,
  startSession,
  stopSession,
} from './session';
import { VersionConflictError } from './types';

class MutableClock implements Clock {
  constructor(private millis: number) {}

  now(): Date {
    return new Date(this.millis);
  }

  advance(millis: number): void {
    this.millis += millis;
  }
}

class MutableMonotonicClock implements MonotonicClock {
  constructor(public millis: number) {}

  nowMillis(): number {
    return this.millis;
  }
}

const NODE_A = { nodeId: 1, path: '/Project/Code' } as const;
const NODE_B = { nodeId: 2, path: '/Project/Test' } as const;

describe('time session', () => {
  it('UT-B4-05: 複数の中断区間を合算する', () => {
    const clock = new MutableClock(0);
    let session = startSession(null, NODE_A, clock).session;

    clock.advance(60_000);
    session = pauseSession(session, session.version, clock);
    clock.advance(40_000);
    session = resumeSession(session, session.version, clock);
    clock.advance(60_000);
    session = pauseSession(session, session.version, clock);
    clock.advance(80_000);
    session = resumeSession(session, session.version, clock);

    expect(session.workMillis).toBe(120_000);
    expect(session.interruptMillis).toBe(120_000);
  });

  it('UT-B4-06: 中断中の明示終了は終了時刻までを中断へ加える', () => {
    const clock = new MutableClock(0);
    let session = startSession(null, NODE_A, clock).session;
    clock.advance(60_000);
    session = pauseSession(session, session.version, clock);
    clock.advance(120_000);

    const result = stopSession(session, session.version, null, clock);

    expect(result.finalSession.interruptMillis).toBe(120_000);
    expect(result.log).toMatchObject({ delta: 1, interrupt: 2 });
  });

  it('UT-B4-07: 時計の読みが逆行しても表示用経過時間は減らない', () => {
    const clock = new MutableMonotonicClock(1_000);
    const timer = new MonotonicElapsedTimer(clock);
    clock.millis = 6_000;
    expect(timer.elapsedMillis()).toBe(5_000);

    clock.millis = 4_000;
    expect(timer.elapsedMillis()).toBe(5_000);
  });

  it('UT-B4-08: 同じノードを再開始しても新しいセッションを作らない', () => {
    const clock = new MutableClock(0);
    const first = startSession(null, NODE_A, clock);
    clock.advance(60_000);

    const second = startSession(first.session, NODE_A, clock);

    expect(second.kind).toBe('continued');
    expect(second.session).toBe(first.session);
    expect(second.stopped).toBeNull();
  });

  it('UT-B4-09: 異なるノードの開始は既存を終了対象として新規だけを返す', () => {
    const clock = new MutableClock(0);
    const first = startSession(null, NODE_A, clock);
    clock.advance(60_000);

    const second = startSession(first.session, NODE_B, clock);

    expect(second.kind).toBe('switched');
    expect(second.session.nodeId).toBe(NODE_B.nodeId);
    expect(second.session.state).toBe('running');
    expect(second.stopped?.log).toMatchObject({ nodeId: NODE_A.nodeId, delta: 1 });
  });

  it('UT-B4-10: 古いversionで更新すると競合エラーになる', () => {
    const clock = new MutableClock(0);
    const session = startSession(null, NODE_A, clock).session;

    expect(() => pauseSession(session, session.version - 1, clock)).toThrow(
      VersionConflictError,
    );
  });

  it('チェックポイントは単調時計で測った現在区間だけを積算する', () => {
    const clock = new MutableClock(60_000);
    const session = startSession(null, NODE_A, new MutableClock(0)).session;

    const checkpoint = checkpointSession(session, session.version, 45_000, clock);

    expect(checkpoint.workMillis).toBe(45_000);
    expect(checkpoint.stateChangedAt).toEqual(new Date(60_000));
    expect(checkpoint.version).toBe(session.version + 1);
  });

  it('中断中の復元は保存状態を変えず表示用の中断時間だけを進める', () => {
    const clock = new MutableClock(0);
    let session = startSession(null, NODE_A, clock).session;
    clock.advance(60_000);
    session = pauseSession(session, session.version, clock);
    clock.advance(30_000);

    const restored = restoreSession(session, clock);

    expect(restored.session).toBe(session);
    expect(restored.displayWorkMillis).toBe(60_000);
    expect(restored.displayInterruptMillis).toBe(30_000);
  });
});

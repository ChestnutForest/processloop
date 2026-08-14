import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../time-log';
import { VersionConflictError } from '../time-log';
import { TEST_DATABASE_URL, clearTables } from './test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { disconnect, getClient } from './client';
import * as hierarchy from './hierarchy';
import * as timeLog from './time-log';
import * as timeSession from './time-session';

class MutableClock implements Clock {
  constructor(private millis: number) {}

  now(): Date {
    return new Date(this.millis);
  }

  advance(millis: number): void {
    this.millis += millis;
  }
}

function toTimeNode(node: { readonly id: number; readonly path: string }) {
  return { nodeId: node.id, path: node.path };
}

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('time-session persistence', () => {
  it('IT-B4-01: 開始後に再接続して未終了セッションを復元する', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'Code' });
    const clock = new MutableClock(0);
    await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(30_000);

    await disconnect();
    const restored = await timeSession.restoreSession(clock);

    expect(restored?.session.nodeId).toBe(node.id);
    expect(restored?.displayWorkMillis).toBe(30_000);
  });

  it('IT-B4-02: 中断後に再接続すると正味時間を止めて中断時間を復元する', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'Design' });
    const clock = new MutableClock(0);
    const started = await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(60_000);
    await timeSession.pauseSession(started.session.version, clock);
    clock.advance(30_000);

    await disconnect();
    const restored = await timeSession.restoreSession(clock);

    expect(restored?.session.state).toBe('paused');
    expect(restored?.displayWorkMillis).toBe(60_000);
    expect(restored?.displayInterruptMillis).toBe(30_000);
  });

  it('IT-B4-03: チェックポイント後に再接続して保存済みミリ秒から復元する', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'Review' });
    const clock = new MutableClock(0);
    const started = await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(60_000);
    await timeSession.checkpointSession(started.session.version, 45_000, clock);
    clock.advance(15_000);

    await disconnect();
    const restored = await timeSession.restoreSession(clock);

    expect(restored?.session.workMillis).toBe(45_000);
    expect(restored?.displayWorkMillis).toBe(60_000);
  });

  it('終了時に正式ログを保存して未終了セッションを削除する', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'Compile' });
    const clock = new MutableClock(0);
    const started = await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(90_000);

    const stopped = await timeSession.stopSession(started.session.version, 'done', clock);

    expect(stopped.log).toMatchObject({ delta: 2, interrupt: 0, comment: 'done' });
    expect(await timeSession.restoreSession(clock)).toBeNull();
    expect(await timeLog.findByNode(node.id)).toHaveLength(1);
  });

  it('1分未満で終了するとログを作らず未終了セッションだけを削除する', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'ShortTask' });
    const clock = new MutableClock(0);
    const started = await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(59_999);

    const stopped = await timeSession.stopSession(started.session.version, null, clock);

    expect(stopped.log).toBeNull();
    expect(await timeSession.restoreSession(clock)).toBeNull();
    expect(await timeLog.findByNode(node.id)).toEqual([]);
  });

  it('別ノードへの切替を旧ログと新セッションの1トランザクションで保存する', async () => {
    const firstNode = await hierarchy.create({ parentId: null, name: 'Code' });
    const secondNode = await hierarchy.create({ parentId: null, name: 'Test' });
    const clock = new MutableClock(0);
    await timeSession.startSession(toTimeNode(firstNode), clock);
    clock.advance(60_000);

    const switched = await timeSession.startSession(toTimeNode(secondNode), clock);
    const current = await timeSession.restoreSession(clock);

    expect(switched.kind).toBe('switched');
    expect(await timeLog.findByNode(firstNode.id)).toHaveLength(1);
    expect(current?.session.nodeId).toBe(secondNode.id);
    expect(await getClient().activeTimeSession.count()).toBe(1);
  });

  it('古いversionの更新を拒否して最新の保存状態を保つ', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'Plan' });
    const clock = new MutableClock(0);
    const started = await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(60_000);
    const paused = await timeSession.pauseSession(started.session.version, clock);

    await expect(timeSession.resumeSession(started.session.version, clock)).rejects.toThrow(
      VersionConflictError,
    );
    const restored = await timeSession.restoreSession(clock);
    expect(restored?.session.version).toBe(paused.version);
    expect(restored?.session.state).toBe('paused');
  });

  it('IT-B4-04: 正式ログの保存失敗時に未終了セッションの削除を戻す', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'AtomicStop' });
    const clock = new MutableClock(0);
    const started = await timeSession.startSession(toTimeNode(node), clock);
    clock.advance(60_000);
    const client = getClient();
    await client.$executeRawUnsafe(`
      CREATE TRIGGER fail_time_log_insert
      BEFORE INSERT ON TimeLogEntry
      BEGIN
        SELECT RAISE(ABORT, 'forced time-log failure');
      END
    `);

    try {
      await expect(
        timeSession.stopSession(started.session.version, null, clock),
      ).rejects.toThrow();
    } finally {
      await client.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_time_log_insert');
    }

    expect((await timeSession.restoreSession(clock))?.session.nodeId).toBe(node.id);
    expect(await timeLog.findByNode(node.id)).toEqual([]);
  });
});

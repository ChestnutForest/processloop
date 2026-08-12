import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, clearTables } from './test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { disconnect } from './client';
import * as hierarchy from './hierarchy';
import * as timeLog from './time-log';

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('time-log', () => {
  it('10. 記録を作る: delta と interrupt が保存される', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const entry = await timeLog.create({
      nodeId: node.id,
      path: node.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 30,
      interrupt: 5,
    });
    expect(entry.delta).toBe(30);
    expect(entry.interrupt).toBe(5);
  });

  it('11. interrupt を省く: 既定値 0 になる', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const entry = await timeLog.create({
      nodeId: node.id,
      path: node.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 30,
    });
    expect(entry.interrupt).toBe(0);
  });

  it('12. ノードに紐づく記録を取る: 対象ノードの分だけ返る', async () => {
    const nodeA = await hierarchy.create({ parentId: null, name: 'ProjectA' });
    const nodeB = await hierarchy.create({ parentId: null, name: 'ProjectB' });
    await timeLog.create({
      nodeId: nodeA.id,
      path: nodeA.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
    });
    await timeLog.create({
      nodeId: nodeB.id,
      path: nodeB.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 20,
    });

    const entries = await timeLog.findByNode(nodeA.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.nodeId).toBe(nodeA.id);
  });

  it('13. パス配下の記録を取る: 子孫の分も含めて返る', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const child = await hierarchy.create({ parentId: parent.id, name: 'Design' });
    await timeLog.create({
      nodeId: parent.id,
      path: parent.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
    });
    await timeLog.create({
      nodeId: child.id,
      path: child.path,
      start: new Date('2026-08-01T10:00:00Z'),
      delta: 20,
    });

    const entries = await timeLog.findUnderPath(parent.path);
    expect(entries).toHaveLength(2);
  });

  it('14. 件数と合計を取る: 正しい件数と合計時間が返る', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });
    await timeLog.create({
      nodeId: node.id,
      path: node.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
      interrupt: 1,
    });
    await timeLog.create({
      nodeId: node.id,
      path: node.path,
      start: new Date('2026-08-01T10:00:00Z'),
      delta: 20,
      interrupt: 2,
    });

    expect(await timeLog.countByNode(node.id)).toBe(2);
    expect(await timeLog.sumByNode(node.id)).toEqual({ delta: 30, interrupt: 3 });
  });

  it('15. 記録のないノードで合計を取る: 0 が返る', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });
    expect(await timeLog.countByNode(node.id)).toBe(0);
    expect(await timeLog.sumByNode(node.id)).toEqual({ delta: 0, interrupt: 0 });
  });

  it('16. ノードを削除する: 紐づく記録も削除される', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });
    await timeLog.create({
      nodeId: node.id,
      path: node.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
    });

    await hierarchy.remove(node.id);

    expect(await timeLog.findByNode(node.id)).toEqual([]);
  });
});

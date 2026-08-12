import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, clearTables } from '../persistence/test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { DuplicateNameError, disconnect, hierarchy, timeLog } from '../persistence';
import * as node from './node';
import { InvalidNameError } from './types';

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('node', () => {
  it('6. 最上位を作る: parentId が null', async () => {
    const created = await node.addRoot('MyProject');
    expect(created.path).toBe('/MyProject');

    const stored = await hierarchy.findByPath('/MyProject');
    expect(stored?.parentId).toBeNull();
  });

  it('7. 子を作る: パスが連結される', async () => {
    await node.addRoot('MyProject');
    const child = await node.addChild('/MyProject', 'Design');
    expect(child.path).toBe('/MyProject/Design');
  });

  it('8. 名前の前後に空白: 除去される', async () => {
    const created = await node.addRoot('  MyProject  ');
    expect(created.name).toBe('MyProject');
  });

  it('9. 空の名前: InvalidNameError', async () => {
    await expect(node.addRoot('   ')).rejects.toThrow(InvalidNameError);
  });

  it('10. 201文字の名前: InvalidNameError', async () => {
    await expect(node.addRoot('a'.repeat(201))).rejects.toThrow(InvalidNameError);
  });

  it('11. 名前に / を含む: InvalidNameError', async () => {
    await expect(node.addRoot('My/Project')).rejects.toThrow(InvalidNameError);
  });

  it('12. 同じ親の下に同名: DuplicateNameError', async () => {
    await node.addRoot('MyProject');
    await node.addChild('/MyProject', 'Design');

    await expect(node.addChild('/MyProject', 'Design')).rejects.toThrow(DuplicateNameError);
  });

  it('13. 改名すると配下のパスが変わる: 子孫すべてが更新される', async () => {
    await node.addRoot('MyProject');
    await node.addChild('/MyProject', 'Design');
    await node.addChild('/MyProject/Design', 'Review');

    const renamed = await node.rename('/MyProject', 'Renamed');
    expect(renamed.path).toBe('/Renamed');

    expect(await hierarchy.findByPath('/Renamed/Design')).not.toBeNull();
    expect(await hierarchy.findByPath('/Renamed/Design/Review')).not.toBeNull();
  });

  it('14. 改名で時間ログのパスも変わる: TimeLogEntry.path が更新される', async () => {
    const project = await node.addRoot('MyProject');
    await timeLog.create({
      nodeId: project.id,
      path: project.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 30,
    });

    await node.rename('/MyProject', 'Renamed');

    const entries = await timeLog.findByNode(project.id);
    expect(entries[0]?.path).toBe('/Renamed');
  });

  it('15. 記録のないノードを調べる: timeLogCount が 0', async () => {
    await node.addRoot('MyProject');

    const impact = await node.inspectRemoval('/MyProject');

    expect(impact.timeLogCount).toBe(0);
    expect(impact.totalDelta).toBe(0);
    expect(impact.totalInterrupt).toBe(0);
  });

  it('16. 記録のあるノードを調べる: 件数と合計時間が返る', async () => {
    const project = await node.addRoot('MyProject');
    await timeLog.create({
      nodeId: project.id,
      path: project.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
      interrupt: 1,
    });
    await timeLog.create({
      nodeId: project.id,
      path: project.path,
      start: new Date('2026-08-01T10:00:00Z'),
      delta: 20,
      interrupt: 2,
    });

    const impact = await node.inspectRemoval('/MyProject');

    expect(impact.timeLogCount).toBe(2);
    expect(impact.totalDelta).toBe(30);
    expect(impact.totalInterrupt).toBe(3);
  });

  it('17. 子孫の記録も集計される: 配下すべてが合算される', async () => {
    const project = await node.addRoot('MyProject');
    const design = await node.addChild('/MyProject', 'Design');
    await timeLog.create({
      nodeId: project.id,
      path: project.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
    });
    await timeLog.create({
      nodeId: design.id,
      path: design.path,
      start: new Date('2026-08-01T10:00:00Z'),
      delta: 20,
    });

    const impact = await node.inspectRemoval('/MyProject');

    expect(impact.nodeCount).toBe(2);
    expect(impact.timeLogCount).toBe(2);
    expect(impact.totalDelta).toBe(30);
  });

  it('18. inspectRemoval は削除しない: ノードが残る', async () => {
    await node.addRoot('MyProject');

    await node.inspectRemoval('/MyProject');

    expect(await hierarchy.findByPath('/MyProject')).not.toBeNull();
  });

  it('19. removeConfirmed で削除する: ノードと記録が消える', async () => {
    const project = await node.addRoot('MyProject');
    await timeLog.create({
      nodeId: project.id,
      path: project.path,
      start: new Date('2026-08-01T09:00:00Z'),
      delta: 10,
    });

    await node.removeConfirmed('/MyProject');

    expect(await hierarchy.findByPath('/MyProject')).toBeNull();
    expect(await timeLog.findByNode(project.id)).toEqual([]);
  });
});

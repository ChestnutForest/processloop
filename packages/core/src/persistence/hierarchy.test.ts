import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, clearTables } from './test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { disconnect } from './client';
import * as hierarchy from './hierarchy';
import { DuplicateNameError, NodeNotFoundError } from './types';

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('hierarchy', () => {
  it('1. 最上位のノードを作る: parentId が null で作られる', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });
    expect(node.parentId).toBeNull();
    expect(node.path).toBe('/MyProject');
  });

  it('2. 子ノードを作る: 親の配下に作られ、path が連結される', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const child = await hierarchy.create({ parentId: parent.id, name: 'Design' });
    expect(child.parentId).toBe(parent.id);
    expect(child.path).toBe('/MyProject/Design');
  });

  it('3. 同じ親の下に同名を作る: DuplicateNameError を投げる', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    await hierarchy.create({ parentId: parent.id, name: 'Design' });

    await expect(hierarchy.create({ parentId: parent.id, name: 'Design' })).rejects.toThrow(
      DuplicateNameError,
    );
  });

  it('4. 別の親の下に同名を作る: 成功する', async () => {
    const parentA = await hierarchy.create({ parentId: null, name: 'ProjectA' });
    const parentB = await hierarchy.create({ parentId: null, name: 'ProjectB' });
    await hierarchy.create({ parentId: parentA.id, name: 'Design' });

    const node = await hierarchy.create({ parentId: parentB.id, name: 'Design' });
    expect(node.path).toBe('/ProjectB/Design');
  });

  it('5. 名前の前後に空白を含める: 除去して保存される', async () => {
    const node = await hierarchy.create({ parentId: null, name: '  MyProject  ' });
    expect(node.name).toBe('MyProject');
    expect(node.path).toBe('/MyProject');
  });

  it('6. ノード名を変える: 配下すべての path が付け直される', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const child = await hierarchy.create({ parentId: parent.id, name: 'Design' });
    const grandchild = await hierarchy.create({ parentId: child.id, name: 'Review' });

    const renamed = await hierarchy.update(parent.id, { name: 'Renamed' });
    expect(renamed.path).toBe('/Renamed');

    const updatedChild = await hierarchy.findByPath('/Renamed/Design');
    expect(updatedChild?.id).toBe(child.id);

    const updatedGrandchild = await hierarchy.findByPath('/Renamed/Design/Review');
    expect(updatedGrandchild?.id).toBe(grandchild.id);
  });

  it('7. 存在しない ID を更新する: NodeNotFoundError を投げる', async () => {
    await expect(hierarchy.update(999, { name: 'Nope' })).rejects.toThrow(NodeNotFoundError);
  });

  it('8. 子を持つノードを削除する: 配下も削除される', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    await hierarchy.create({ parentId: parent.id, name: 'Design' });

    await hierarchy.remove(parent.id);

    expect(await hierarchy.findByPath('/MyProject')).toBeNull();
    expect(await hierarchy.findByPath('/MyProject/Design')).toBeNull();
    expect(await hierarchy.findChildren(null)).toEqual([]);
  });

  it('9. 兄弟の並び順を保つ: sortOrder の昇順で返る', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    await hierarchy.create({ parentId: parent.id, name: 'Third', sortOrder: 2 });
    await hierarchy.create({ parentId: parent.id, name: 'First', sortOrder: 0 });
    await hierarchy.create({ parentId: parent.id, name: 'Second', sortOrder: 1 });

    const children = await hierarchy.findChildren(parent.id);
    expect(children.map((node) => node.name)).toEqual(['First', 'Second', 'Third']);
  });
});

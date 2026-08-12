import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, clearTables } from '../persistence/test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { disconnect, hierarchy } from '../persistence';
import * as tree from './tree';

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('tree', () => {
  it('1. 平坦な配列から木を組み立てる: 親子関係が復元される', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const child = await hierarchy.create({ parentId: parent.id, name: 'Design' });

    const result = await tree.buildTree();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(parent.id);
    expect(result[0]?.children).toHaveLength(1);
    expect(result[0]?.children[0]?.id).toBe(child.id);
  });

  it('2. 兄弟の並び順: sortOrder の昇順になる', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    await hierarchy.create({ parentId: parent.id, name: 'Third', sortOrder: 2 });
    await hierarchy.create({ parentId: parent.id, name: 'First', sortOrder: 0 });
    await hierarchy.create({ parentId: parent.id, name: 'Second', sortOrder: 1 });

    const result = await tree.buildTree();

    expect(result[0]?.children.map((node) => node.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('3. 最上位が複数ある: すべて根として返る', async () => {
    await hierarchy.create({ parentId: null, name: 'ProjectA' });
    await hierarchy.create({ parentId: null, name: 'ProjectB' });

    const result = await tree.buildTree();

    expect(result.map((node) => node.name)).toEqual(['ProjectA', 'ProjectB']);
  });

  it('4. 存在しないパスを探す: null が返る', async () => {
    await hierarchy.create({ parentId: null, name: 'MyProject' });

    const result = await tree.findNode('/NoSuchProject');

    expect(result).toBeNull();
  });

  it('5. 子孫を列挙する: 深い階層も含めて返る', async () => {
    const parent = await hierarchy.create({ parentId: null, name: 'MyProject' });
    const child = await hierarchy.create({ parentId: parent.id, name: 'Design' });
    const grandchild = await hierarchy.create({ parentId: child.id, name: 'Review' });

    const result = await tree.listDescendants('/MyProject');

    expect(result.map((node) => node.id)).toEqual([child.id, grandchild.id]);
  });
});

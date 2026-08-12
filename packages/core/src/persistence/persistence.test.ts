import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, clearTables, packageRoot, pushSchemaTo } from './test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { disconnect } from './client';
import * as hierarchy from './hierarchy';

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('persistence', () => {
  it('17. 書き出した後に接続を切り、再接続する: 内容が保たれている', async () => {
    const node = await hierarchy.create({ parentId: null, name: 'MyProject' });

    // disconnect() は client.ts の共有インスタンスを破棄する。次に getClient() を
    // 呼んだ時点（hierarchy.findByPath の内部）で新しい PrismaClient が作られ、
    // 同じ DATABASE_URL のファイルへ再接続する。
    await disconnect();

    const reconnected = await hierarchy.findByPath('/MyProject');
    expect(reconnected?.id).toBe(node.id);
  });

  it(
    '18. データベースのファイルがない状態で開く: 新規に作られる',
    async () => {
      // 共有テスト DB とは別に、存在しない DB ファイルを指す URL を用意する。
      const freshDbUrl = 'file:./test-fresh.db';
      const freshDbPath = join(packageRoot, 'prisma', 'test-fresh.db');
      if (existsSync(freshDbPath)) rmSync(freshDbPath);
      expect(existsSync(freshDbPath)).toBe(false);

      // 起動時に行うスキーマの適用（NFR-DATA-001.220 の「開く」に相当）を模す。
      pushSchemaTo(freshDbUrl);

      try {
        expect(existsSync(freshDbPath)).toBe(true);

        const freshClient = new PrismaClient({ datasources: { db: { url: freshDbUrl } } });
        try {
          await expect(freshClient.hierarchyNode.findMany()).resolves.toEqual([]);
        } finally {
          await freshClient.$disconnect();
        }
      } finally {
        if (existsSync(freshDbPath)) rmSync(freshDbPath);
      }
    },
    // `prisma db push` の CLI 起動に10秒以上かかるため、既定の testTimeout を延ばす。
    30000,
  );
});

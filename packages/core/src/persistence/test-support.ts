/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * テスト専用のヘルパー。単体テストの対象ではない
 * （docs/phase1/units/prt-b9-persistence.md 3章「テストコードは行数に含めない」）。
 *
 * `prisma db push` の CLI 起動には10秒以上かかり、vitest の beforeAll から毎回
 * 呼ぶと hookTimeout（既定10秒）を超えて失敗する。そのため全テストファイルで
 * 1つのマイグレーション済み DB を共有し、スキーマ投入は vitest.global-setup.ts から
 * 実行全体で1回だけ行う。beforeEach では clearTables で中身を消すだけにする。
 * DB を共有する都合上、vitest.config.ts 側でテストファイルを逐次実行にしている。
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient } from './client';

/** sqlite の相対パスは schema.prisma のあるディレクトリを基準に解決される。 */
export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = join(packageRoot, 'prisma', 'schema.prisma');
const testDatabasePath = join(packageRoot, 'prisma', 'test.db');

/** 全テストファイルで共有する、マイグレーション済みのテスト用 DB。 */
export const TEST_DATABASE_URL = 'file:./test.db';

/** 指定した DATABASE_URL に対してスキーマを反映する。 */
export function pushSchemaTo(databaseUrl: string): void {
  // Prisma 6.19のschema engineは、存在しないSQLiteファイルへdb pushすると
  // P1003になる。移植元の「ファイルがなければ作る」挙動と既存テストを保つため、
  // スキーマ適用前に空ファイルを用意する。
  if (databaseUrl.startsWith('file:')) {
    const databaseName = databaseUrl.slice('file:'.length);
    const databasePath = isAbsolute(databaseName)
      ? databaseName
      : resolve(dirname(schemaPath), databaseName);
    if (!existsSync(databasePath)) writeFileSync(databasePath, '');
  }
  execSync(`npx --no-install prisma db push --skip-generate --schema="${schemaPath}"`, {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

/** テスト用 DB にスキーマを反映する。vitest.global-setup.ts から実行全体で1回だけ呼ぶ。 */
export function pushSchema(): void {
  if (existsSync(testDatabasePath)) rmSync(testDatabasePath);
  pushSchemaTo(TEST_DATABASE_URL);
}

/** 全テーブルの行を削除する。テストごとに呼び、状態を独立させる。 */
export async function clearTables(): Promise<void> {
  const client = getClient();
  await client.activeTimeSession.deleteMany();
  await client.timeLogEntry.deleteMany();
  await client.hierarchyNode.deleteMany();
}

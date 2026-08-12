/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Process Dashboard (GPLv3, Copyright (C) 1998-2025 Tuma Solutions, LLC) を
 * 基にした派生物。GPLv3 で提供する。詳細はリポジトリ直下の LICENSE / NOTICE を参照。
 *
 * Prisma クライアントを1つ生成して共有する
 * （docs/phase1/units/prt-b9-persistence.md 2章）。
 *
 * 開発中の再読み込みで接続が増える問題が Next.js で知られているが、
 * 第1期では packages/core 側で1つに保つ方式を採る。必要になれば
 * globalThis を用いる方式へ変える。
 */

import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

export function getClient(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function disconnect(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

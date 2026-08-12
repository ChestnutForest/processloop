/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Process Dashboard (GPLv3, Copyright (C) 1998-2025 Tuma Solutions, LLC) を
 * 基にした派生物。GPLv3 で提供する。詳細はリポジトリ直下の LICENSE / NOTICE を参照。
 *
 * B-2 階層のドメインロジックが公開する関数のまとめ
 * （docs/phase1/units/prt-b2-hierarchy.md 2章）。
 *
 * `process.ts` は `processAssignment` という名前で公開する。`process` のままだと
 * 利用側で Node.js のグローバル `process` を隠してしまうため。
 */

export * as tree from './tree';
export * as node from './node';
export * as processAssignment from './process';
export * from './types';

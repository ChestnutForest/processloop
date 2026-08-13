/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Process Dashboard (GPLv3, Copyright (C) 1998-2025 Tuma Solutions, LLC) を
 * 基にした派生物。GPLv3 で提供する。詳細はリポジトリ直下の LICENSE / NOTICE を参照。
 *
 * B-2 階層のドメインロジックの型（docs/phase1/units/prt-b2-hierarchy.md 2章）。
 *
 * `DuplicateNameError` と `NodeNotFoundError` は再定義しない。B-9（永続化層）が
 * 投げたものをそのまま呼び出し側へ通す（PRT-B2 2章「エラーの扱い」）。
 */

import type { PhaseType } from '../persistence';

/** 画面に渡す階層。子を再帰的に含む。 */
export interface TreeNode {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly templateId: string | null;
  readonly phaseType: PhaseType | null;
  readonly children: readonly TreeNode[];
}

/** 削除の影響。確認を求める前に返す（FR-HIER-001.340）。 */
export interface RemovalImpact {
  readonly nodeCount: number;
  readonly timeLogCount: number;
  readonly totalDelta: number;
  readonly totalInterrupt: number;
}

/** ノード名が空、201文字以上、または `/` を含むときに投げる（FR-HIER-001.10 `.30`）。 */
export class InvalidNameError extends Error {
  constructor(readonly invalidName: string) {
    super(`ノード名が不正である: ${invalidName}`);
    this.name = 'InvalidNameError';
  }
}

/** フェーズのノードへ子ノードを追加しようとしたときに投げる（FR-HIER-001.430）。 */
export class PhaseNodeError extends Error {
  constructor(readonly path: string) {
    super(`フェーズのノードには子を追加できない: ${path}`);
    this.name = 'PhaseNodeError';
  }
}

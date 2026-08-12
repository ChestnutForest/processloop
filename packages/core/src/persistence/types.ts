/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Process Dashboard (GPLv3, Copyright (C) 1998-2025 Tuma Solutions, LLC) を
 * 基にした派生物。GPLv3 で提供する。詳細はリポジトリ直下の LICENSE / NOTICE を参照。
 *
 * 永続化層のドメイン型。Prisma が生成する型はここへ変換してから外へ出す
 * （docs/phase1/units/prt-b9-persistence.md 2章）。
 */

/** 移植元 PhaseUtil のフェーズ種別。列挙型にせず、文字列のユニオン型で持つ。 */
export type PhaseType =
  | 'plan'
  | 'hld'
  | 'hldr'
  | 'dld'
  | 'dldr'
  | 'code'
  | 'cr'
  | 'comp'
  | 'ut'
  | 'it'
  | 'st'
  | 'at'
  | 'pl'
  | 'pm';

export interface HierarchyNode {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly templateId: string | null;
  readonly phaseType: PhaseType | null;
  readonly parentId: number | null;
  readonly sortOrder: number;
}

export interface CreateNodeInput {
  readonly parentId: number | null;
  readonly name: string;
  readonly templateId?: string | null;
  readonly phaseType?: PhaseType | null;
  readonly sortOrder?: number;
}

/** 指定したキーのみを更新する。省略したキーは変更しない。 */
export interface UpdateNodeInput {
  readonly name?: string;
  readonly templateId?: string | null;
  readonly phaseType?: PhaseType | null;
}

export interface TimeLogEntry {
  readonly id: number;
  readonly nodeId: number;
  readonly path: string;
  /** 計測開始時刻。 */
  readonly start: Date;
  /** 中断を除いた正味時間（分）。 */
  readonly delta: number;
  /** 中断時間（分）。 */
  readonly interrupt: number;
  readonly comment: string | null;
}

export interface CreateEntryInput {
  readonly nodeId: number;
  readonly path: string;
  readonly start: Date;
  readonly delta: number;
  readonly interrupt?: number;
  readonly comment?: string | null;
}

export interface TimeLogSummary {
  readonly delta: number;
  readonly interrupt: number;
}

/** 同じ親の下に同名のノードを作ろうとしたときに投げる（Prisma P2002 の変換先）。 */
export class DuplicateNameError extends Error {
  constructor(
    readonly parentId: number | null,
    readonly nodeName: string,
  ) {
    super(`同じ親の下に同名のノードが存在する: ${nodeName}`);
    this.name = 'DuplicateNameError';
  }
}

/** 指定した ID のノードが存在しないときに投げる（Prisma P2025 の変換先）。 */
export class NodeNotFoundError extends Error {
  constructor(readonly id: number) {
    super(`ノードが見つからない: id=${id}`);
    this.name = 'NodeNotFoundError';
  }
}

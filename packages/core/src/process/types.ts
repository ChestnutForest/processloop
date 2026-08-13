/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Process Dashboard (GPLv3, Copyright (C) 1998-2025 Tuma Solutions, LLC) を
 * 基にした派生物。GPLv3 で提供する。詳細はリポジトリ直下の LICENSE / NOTICE を参照。
 *
 * プロセス定義の型（docs/phase1/units/prt-b3-process.md 2章）。
 *
 * `PhaseType` は B-9（永続化層）の型を再定義せず import する。
 */

import type { PhaseType } from '../persistence';

export interface ProcessDefinition {
  readonly id: string;
  readonly name: string;
  readonly hasDefectLog: boolean;
  readonly phases: readonly PhaseDefinition[];
}

export interface PhaseDefinition {
  readonly name: string;
  readonly type: PhaseType;
}

/** `PhaseUtil` の4分類。どれにも属さない種別は `'other'`。 */
export type PhaseCategory = 'appraisal' | 'failure' | 'overhead' | 'development' | 'other';

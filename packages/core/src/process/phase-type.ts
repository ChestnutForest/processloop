/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * The four classification sets and the case-insensitive matching rule are
 * transcribed from
 * src/net/sourceforge/processdash/process/PhaseUtil.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001 (Process Dashboard 2.7.6,
 * 2026-05-28); see docs/analysis/ana-b3.md section 5. Unlike upstream,
 * which has no explicit "none of the above" case, this port makes the
 * absence of a match an explicit `'other'` category (PRT-B3 2章).
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

import type { PhaseType } from '../persistence';
import type { PhaseCategory } from './types';

const APPRAISAL = [
  'appraisal',
  'review',
  'insp',
  'reqinsp',
  'hldr',
  'hldrinsp',
  'dldr',
  'dldinsp',
  'cr',
  'codeinsp',
];
const FAILURE = ['failure', 'comp', 'ut', 'it', 'st', 'at', 'pl'];
const OVERHEAD = ['overhead', 'mgmt', 'strat', 'plan', 'pm'];
const DEVELOPMENT = ['develop', 'req', 'stp', 'itp', 'td', 'hld', 'dld', 'code', 'doc'];

// 判定の前に小文字化する（移植元と同じ。ana-b3.md 5章）。
function normalize(type: PhaseType): string {
  return type.toLowerCase();
}

/** M3 の歩留まり計算で使う（PRT-B3 2章）。 */
export function isAppraisal(type: PhaseType): boolean {
  return APPRAISAL.includes(normalize(type));
}

/** M3 の歩留まり計算で使う（PRT-B3 2章）。 */
export function isFailure(type: PhaseType): boolean {
  return FAILURE.includes(normalize(type));
}

function isOverhead(type: PhaseType): boolean {
  return OVERHEAD.includes(normalize(type));
}

function isDevelopment(type: PhaseType): boolean {
  return DEVELOPMENT.includes(normalize(type));
}

/**
 * フェーズ種別を4分類のいずれかに割り当てる（FR-HIER-001.420）。
 * `PhaseUtil` は「その他」の集合を持たず4つの判定がすべて false を返すことが
 * あるため、移植先では `'other'` として明示する。
 */
export function classifyPhase(type: PhaseType): PhaseCategory {
  if (isAppraisal(type)) return 'appraisal';
  if (isFailure(type)) return 'failure';
  if (isOverhead(type)) return 'overhead';
  if (isDevelopment(type)) return 'development';
  return 'other';
}

/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * The PSP2 phase list is transcribed from the `<template name="PSP2" ...>`
 * element of Templates/PSP-template.xml at upstream commit
 * bf5a4d63aff08410f79840001c816b37392e5001 (Process Dashboard 2.7.6,
 * 2026-05-28); see docs/analysis/ana-b3.md section 4 for the transcription
 * and docs/phase1/units/prt-b3-process.md section 6 for how to re-derive it
 * after an upstream update. The definition is held as a static constant
 * rather than parsed from XML at runtime, since it never changes at
 * runtime; see PRT-B3 section 2.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

import type { ProcessDefinition } from './types';

/**
 * PSP2 のフェーズ構成。フェーズ名は移植元のまま英語で持つ。階層のノード名になり、
 * 表示の日本語化は i18n で行うため（PRT-B3 2章）。
 */
export const PSP2: ProcessDefinition = {
  id: 'PSP2',
  name: 'PSP2',
  hasDefectLog: true,
  phases: [
    { name: 'Planning', type: 'plan' },
    { name: 'Design', type: 'dld' },
    { name: 'Design Review', type: 'dldr' },
    { name: 'Code', type: 'code' },
    { name: 'Code Review', type: 'cr' },
    { name: 'Compile', type: 'comp' },
    { name: 'Test', type: 'ut' },
    { name: 'Postmortem', type: 'pm' },
  ],
};

/** 保持しているプロセス定義の一覧を返す（FR-HIER-001.310）。M1 では PSP2 のみを持つ。 */
export function listDefinitions(): ProcessDefinition[] {
  return [PSP2];
}

/** ID でプロセス定義を探す。見つからなければ `null` を返す（FR-HIER-001.320）。 */
export function findDefinition(id: string): ProcessDefinition | null {
  return listDefinitions().find((definition) => definition.id === id) ?? null;
}

/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * The TimeLogEntry attribute names are derived from
 * src/net/sourceforge/processdash/log/time/TimeLogIOConstants.java at
 * upstream commit bf5a4d63aff08410f79840001c816b37392e5001
 * (Process Dashboard 2.7.6, 2026-05-28). This is a redesign onto a
 * relational schema, not a line-for-line port; see
 * docs/phase1/units/prt-b9-persistence.md for the mapping. The `flag`
 * attribute (team sync metadata) is deliberately not ported.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

/**
 * TimeLogEntry のリポジトリ層。
 *
 * 移植元は delta（正味時間）と interrupt（中断時間）を別属性に分けている。
 * PSP が中断を除いた正味時間を測る方法論であるための必然であり、その分離を
 * そのまま引き継ぐ（PRT-B9 1章）。
 */

import { getClient } from './client';
import type { CreateEntryInput, TimeLogEntry, TimeLogSummary } from './types';

function toDomain(row: {
  id: number;
  nodeId: number;
  path: string;
  start: Date;
  delta: number;
  interrupt: number;
  comment: string | null;
}): TimeLogEntry {
  return {
    id: row.id,
    nodeId: row.nodeId,
    path: row.path,
    start: row.start,
    delta: row.delta,
    interrupt: row.interrupt,
    comment: row.comment,
  };
}

export async function findByNode(nodeId: number): Promise<TimeLogEntry[]> {
  const rows = await getClient().timeLogEntry.findMany({
    where: { nodeId },
    orderBy: { start: 'asc' },
  });
  return rows.map(toDomain);
}

/** `path` が示すノード自身と、その配下のノードに紐づく記録をすべて返す。 */
export async function findUnderPath(path: string): Promise<TimeLogEntry[]> {
  const rows = await getClient().timeLogEntry.findMany({
    where: { OR: [{ path }, { path: { startsWith: `${path}/` } }] },
    orderBy: { start: 'asc' },
  });
  return rows.map(toDomain);
}

export async function countByNode(nodeId: number): Promise<number> {
  return getClient().timeLogEntry.count({ where: { nodeId } });
}

export async function sumByNode(nodeId: number): Promise<TimeLogSummary> {
  const result = await getClient().timeLogEntry.aggregate({
    where: { nodeId },
    _sum: { delta: true, interrupt: true },
  });
  return {
    delta: result._sum.delta ?? 0,
    interrupt: result._sum.interrupt ?? 0,
  };
}

export async function create(input: CreateEntryInput): Promise<TimeLogEntry> {
  const created = await getClient().timeLogEntry.create({
    data: {
      nodeId: input.nodeId,
      path: input.path,
      start: input.start,
      delta: input.delta,
      interrupt: input.interrupt ?? 0,
      comment: input.comment ?? null,
    },
  });
  return toDomain(created);
}

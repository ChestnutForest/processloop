/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * The HierarchyNode schema and attribute names are derived from
 * src/net/sourceforge/processdash/hier/DashHierarchy.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001 (Process Dashboard 2.7.6,
 * 2026-05-28). This is a redesign onto a relational schema, not a
 * line-for-line port; see docs/phase1/units/prt-b9-persistence.md for the
 * mapping and for what was deliberately not ported (dataFile, defectLog,
 * imaginary, imaginaryUnless, constraints, href).
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

/**
 * HierarchyNode のリポジトリ層。
 *
 * 移植元は `path`（階層パス）ですべてのデータを結ぶ。この設計を引き継ぎつつ、
 * 移植先では外部キーでも結ぶ（ARC 3.3）。ノード名の変更時は、配下のノードと
 * 紐づく TimeLogEntry の path をまとめて付け直す（FR-HIER-001.520）。
 */

import type { Prisma } from '@prisma/client';
import { getClient } from './client';
import {
  DuplicateNameError,
  NodeNotFoundError,
  type CreateNodeInput,
  type HierarchyNode,
  type PhaseType,
  type UpdateNodeInput,
} from './types';

/** Prisma が生成する行を、絞り込んだ型のドメインオブジェクトへ変換する。 */
function toDomain(row: {
  id: number;
  name: string;
  path: string;
  templateId: string | null;
  phaseType: string | null;
  parentId: number | null;
  sortOrder: number;
}): HierarchyNode {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    templateId: row.templateId,
    // Prisma のモデルでは phaseType を String? とする（ARC 3.5）。
    // 絞り込みはここで行う。
    phaseType: row.phaseType as PhaseType | null,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

const SIBLING_ORDER: Prisma.HierarchyNodeOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { id: 'asc' },
];

export async function findAll(): Promise<HierarchyNode[]> {
  const rows = await getClient().hierarchyNode.findMany({ orderBy: SIBLING_ORDER });
  return rows.map(toDomain);
}

export async function findByPath(path: string): Promise<HierarchyNode | null> {
  const row = await getClient().hierarchyNode.findUnique({ where: { path } });
  return row === null ? null : toDomain(row);
}

export async function findChildren(parentId: number | null): Promise<HierarchyNode[]> {
  const rows = await getClient().hierarchyNode.findMany({
    where: { parentId },
    orderBy: SIBLING_ORDER,
  });
  return rows.map(toDomain);
}

export async function create(input: CreateNodeInput): Promise<HierarchyNode> {
  const client = getClient();
  const name = input.name.trim();

  let parentPath: string | null = null;
  if (input.parentId !== null) {
    const parent = await client.hierarchyNode.findUnique({ where: { id: input.parentId } });
    if (parent === null) throw new NodeNotFoundError(input.parentId);
    parentPath = parent.path;
  }
  const path = parentPath === null ? `/${name}` : `${parentPath}/${name}`;

  try {
    const created = await client.hierarchyNode.create({
      data: {
        name,
        path,
        parentId: input.parentId,
        templateId: input.templateId ?? null,
        phaseType: input.phaseType ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return toDomain(created);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) throw new DuplicateNameError(input.parentId, name);
    throw error;
  }
}

export async function update(id: number, input: UpdateNodeInput): Promise<HierarchyNode> {
  return getClient().$transaction(async (tx) => {
    const current = await tx.hierarchyNode.findUnique({ where: { id } });
    if (current === null) throw new NodeNotFoundError(id);

    const data: Prisma.HierarchyNodeUpdateInput = {};
    if (input.templateId !== undefined) data.templateId = input.templateId;
    if (input.phaseType !== undefined) data.phaseType = input.phaseType;

    let newPath = current.path;
    let newName = current.name;
    if (input.name !== undefined) {
      newName = input.name.trim();
      const parent =
        current.parentId === null
          ? null
          : await tx.hierarchyNode.findUnique({ where: { id: current.parentId } });
      newPath = parent === null ? `/${newName}` : `${parent.path}/${newName}`;
      data.name = newName;
      data.path = newPath;
    }

    let updated;
    try {
      updated = await tx.hierarchyNode.update({ where: { id }, data });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new DuplicateNameError(current.parentId, newName);
      throw error;
    }

    // ノード名を変えた場合のみ、配下の path を付け直す必要がある
    if (newPath !== current.path) {
      await cascadePathRename(tx, current.path, newPath);
    }

    return toDomain(updated);
  });
}

/**
 * `oldPath` 配下の HierarchyNode と、`oldPath` 自身および配下を指す
 * TimeLogEntry の path を、`newPath` を基準に付け直す。
 *
 * ノード自身の path は呼び出し側が既に更新済みであることを前提とする。
 */
async function cascadePathRename(
  tx: Prisma.TransactionClient,
  oldPath: string,
  newPath: string,
): Promise<number> {
  const prefix = `${oldPath}/`;

  const descendantNodes = await tx.hierarchyNode.findMany({
    where: { path: { startsWith: prefix } },
  });
  for (const node of descendantNodes) {
    await tx.hierarchyNode.update({
      where: { id: node.id },
      data: { path: newPath + node.path.slice(oldPath.length) },
    });
  }

  const affectedEntries = await tx.timeLogEntry.findMany({
    where: { OR: [{ path: oldPath }, { path: { startsWith: prefix } }] },
  });
  for (const entry of affectedEntries) {
    const updatedPath = entry.path === oldPath ? newPath : newPath + entry.path.slice(oldPath.length);
    await tx.timeLogEntry.update({ where: { id: entry.id }, data: { path: updatedPath } });
  }

  return descendantNodes.length + affectedEntries.length;
}

/** `update` から名前変更時に呼ばれる付け替え処理を、単独でも呼べるようにしたもの。 */
export async function updatePathsUnder(
  id: number,
  oldPath: string,
  newPath: string,
): Promise<number> {
  return getClient().$transaction(async (tx) => {
    const node = await tx.hierarchyNode.findUnique({ where: { id } });
    if (node === null) throw new NodeNotFoundError(id);
    return cascadePathRename(tx, oldPath, newPath);
  });
}

export async function remove(id: number): Promise<void> {
  await getClient().$transaction(async (tx) => {
    const node = await tx.hierarchyNode.findUnique({ where: { id } });
    if (node === null) throw new NodeNotFoundError(id);

    const descendants = await tx.hierarchyNode.findMany({
      where: { path: { startsWith: `${node.path}/` } },
    });
    // 自己参照の外部キー制約に反しないよう、深いノードから削除する。
    // TimeLogEntry は onDelete: Cascade によりノードの削除に追従する。
    const deepestFirst = [...descendants].sort((a, b) => b.path.length - a.path.length);
    for (const descendant of deepestFirst) {
      await tx.hierarchyNode.delete({ where: { id: descendant.id } });
    }
    await tx.hierarchyNode.delete({ where: { id } });
  });
}

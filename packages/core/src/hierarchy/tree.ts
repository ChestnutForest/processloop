/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * The tree assembly logic is derived from the traversal behaviour of
 * src/net/sourceforge/processdash/hier/DashHierarchy.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001 (Process Dashboard 2.7.6,
 * 2026-05-28), redesigned around B-9's flat HierarchyNode rows instead of
 * the upstream Prop tree; see docs/phase1/units/prt-b2-hierarchy.md for the
 * mapping.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

/**
 * 階層の組み立てと走査。
 *
 * B-9 の `hierarchy.findAll()` が返す平坦な `HierarchyNode[]` を、
 * `parentId` で結び `sortOrder` で並べて木に組み立てる（FR-HIER-001.510）。
 */

import { hierarchy, type HierarchyNode } from '../persistence';
import type { TreeNode } from './types';

/** HierarchyNode を、子を持たない TreeNode に変換する。 */
export function toTreeNode(node: HierarchyNode, children: readonly TreeNode[] = []): TreeNode {
  return {
    id: node.id,
    name: node.name,
    path: node.path,
    templateId: node.templateId,
    phaseType: node.phaseType,
    children,
  };
}

function assemble(nodes: readonly HierarchyNode[], parentId: number | null): TreeNode[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((node) => toTreeNode(node, assemble(nodes, node.id)));
}

/** 階層全体を木として返す。最上位が複数あれば、すべて根として返る。 */
export async function buildTree(): Promise<TreeNode[]> {
  const nodes = await hierarchy.findAll();
  return assemble(nodes, null);
}

function search(nodes: readonly TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = search(node.children, path);
    if (found !== null) return found;
  }
  return null;
}

/** 指定したパスのノードを木の中から探す。見つからなければ `null` を返す。 */
export async function findNode(path: string): Promise<TreeNode | null> {
  const tree = await buildTree();
  return search(tree, path);
}

function collect(node: TreeNode): TreeNode[] {
  return node.children.flatMap((child) => [child, ...collect(child)]);
}

/** 指定したパスの配下にある子孫をすべて列挙する。深い階層も含む（FR-HIER-001.520 の対象範囲）。 */
export async function listDescendants(path: string): Promise<TreeNode[]> {
  const node = await findNode(path);
  return node === null ? [] : collect(node);
}

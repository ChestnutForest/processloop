/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * Phase expansion mirrors how upstream instantiates a Templates/*.xml
 * process definition as child nodes when it is assigned to a hierarchy
 * node, as analysed from src/net/sourceforge/processdash/hier/
 * DashHierarchy.java at upstream commit
 * bf5a4d63aff08410f79840001c816b37392e5001 (Process Dashboard 2.7.6,
 * 2026-05-28). See docs/phase1/units/prt-b2-hierarchy.md for the mapping.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

/**
 * プロセス定義の割り当てとフェーズ展開。
 *
 * `ProcessDefinition` は B-3（プロセス定義の読み込み）から受け取る
 * （docs/phase1/units/prt-b3-process.md 4章「B-2 との差し替え」）。
 */

import { hierarchy } from '../persistence';
import type { ProcessDefinition } from '../process';
import { requireNodeByPath } from './node';
import { toTreeNode } from './tree';
import type { TreeNode } from './types';

/** 定義が持つフェーズを、対象ノードの子として定義の順に作成する（FR-HIER-001.410 `.420`）。 */
async function expandPhases(nodeId: number, definition: ProcessDefinition): Promise<void> {
  for (const [index, phase] of definition.phases.entries()) {
    await hierarchy.create({
      parentId: nodeId,
      name: phase.name,
      phaseType: phase.type,
      sortOrder: index,
    });
  }
}

/**
 * プロセス定義を割り当てる（FR-HIER-001.320 `.410` `.420`）。
 * 初回の割り当てを想定する。既存のフェーズを消したい場合は `reassign` を使う。
 */
export async function assign(path: string, definition: ProcessDefinition): Promise<TreeNode> {
  const node = await requireNodeByPath(path);
  const updated = await hierarchy.update(node.id, { templateId: definition.id });
  await expandPhases(updated.id, definition);
  return toTreeNode(updated);
}

/**
 * 既にプロセス定義が割り当てられているノードに、別の定義を割り当て直す（FR-HIER-001.330）。
 * 既存の子（フェーズ）をすべて削除してから、新しい定義のフェーズを展開し直す。
 *
 * ⚠️ 削除する子に時間ログが記録されていても、ここでは確認を求めない。
 * 確認（`.340` `.350`）は呼び出し側が `node.inspectRemoval` 相当の情報を
 * 提示し、同意を得たうえで本関数を呼ぶ前提とする。
 */
export async function reassign(path: string, definition: ProcessDefinition): Promise<TreeNode> {
  const node = await requireNodeByPath(path);

  const existingPhases = await hierarchy.findChildren(node.id);
  for (const phase of existingPhases) {
    await hierarchy.remove(phase.id);
  }

  const updated = await hierarchy.update(node.id, { templateId: definition.id });
  await expandPhases(updated.id, definition);
  return toTreeNode(updated);
}

/** フェーズのノードには子を追加できない（FR-HIER-001.430）。画面が操作を出すかの判定に使う。 */
export async function canAddChild(path: string): Promise<boolean> {
  const node = await requireNodeByPath(path);
  return node.phaseType === null;
}

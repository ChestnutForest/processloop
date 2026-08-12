/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * The node-mutation rules (name validation, sibling uniqueness, phase
 * protection) are derived from the behaviour of
 * src/net/sourceforge/processdash/hier/HierarchyAlterer.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001 (Process Dashboard 2.7.6,
 * 2026-05-28). The upstream's deferred `PendingDataChange` application is
 * deliberately not ported; B-9's database transactions serve the same
 * purpose. See docs/phase1/units/prt-b2-hierarchy.md for the mapping.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

/**
 * ノードの追加・改名・削除。
 *
 * `inspectRemoval` と `removeConfirmed` をあえて分けている（FR-HIER-001.340 `.350`）。
 * 1つの関数にすると、画面側が確認を省略できてしまう。
 */

import { hierarchy, timeLog, NodeNotFoundError, type HierarchyNode } from '../persistence';
import { listDescendants, toTreeNode } from './tree';
import { InvalidNameError, PhaseNodeError, type RemovalImpact, type TreeNode } from './types';

const MAX_NAME_LENGTH = 200;

/** ノード名を検証する（FR-HIER-001.10 `.30`）。前後の空白を除いた値を返す。 */
function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidNameError(name);
  }
  // パスの区切り文字 `/` を名前に含めるとパスの分解が壊れる。移植元も同じ制約を
  // 持つと考えられるが、DashHierarchy.java の該当箇所が本環境では参照できず未確認
  // （PRT-B2 1章）。制約自体は要求仕様どおり課す。
  if (trimmed.includes('/')) {
    throw new InvalidNameError(name);
  }
  return trimmed;
}

/**
 * path からノードを取得する。見つからなければ `NodeNotFoundError` を投げる。
 *
 * B-9 の `NodeNotFoundError` は数値の `id` で識別するが、path 解決の失敗には
 * 対応する `id` が存在しない。自動採番は1から始まるため、実在しない値として
 * `0` を用いる。
 */
export async function requireNodeByPath(path: string): Promise<HierarchyNode> {
  const node = await hierarchy.findByPath(path);
  if (node === null) throw new NodeNotFoundError(0);
  return node;
}

/** 親を持たない最上位のノードを作る（FR-HIER-001.110 `.120`）。 */
export async function addRoot(name: string): Promise<TreeNode> {
  const node = await hierarchy.create({ parentId: null, name: normalizeName(name) });
  return toTreeNode(node);
}

/**
 * 指定した親の配下に子ノードを追加する（FR-HIER-001.210 `.220`）。
 * 既存の子ノードの末尾に並ぶよう、常に `sortOrder` を末尾へ割り当てる。
 */
export async function addChild(parentPath: string, name: string): Promise<TreeNode> {
  const parent = await requireNodeByPath(parentPath);
  if (parent.phaseType !== null) throw new PhaseNodeError(parentPath);

  const siblings = await hierarchy.findChildren(parent.id);
  const sortOrder = siblings.reduce((max, sibling) => Math.max(max, sibling.sortOrder), -1) + 1;

  const node = await hierarchy.create({ parentId: parent.id, name: normalizeName(name), sortOrder });
  return toTreeNode(node);
}

/**
 * ノード名を変更する（FR-HIER-001.520）。配下すべての path の付け直しは
 * B-9 の `hierarchy.update` が単一トランザクションで行うため、ここでは呼ぶだけでよい。
 */
export async function rename(path: string, newName: string): Promise<TreeNode> {
  const node = await requireNodeByPath(path);
  const updated = await hierarchy.update(node.id, { name: normalizeName(newName) });
  return toTreeNode(updated);
}

/**
 * ノードを削除した場合の影響を調べる（FR-HIER-001.340）。削除は実行しない。
 * 対象ノードと配下すべての件数・時間ログを合算して返す。
 */
export async function inspectRemoval(path: string): Promise<RemovalImpact> {
  const node = await requireNodeByPath(path);
  const descendants = await listDescendants(path);
  const targetIds = [node.id, ...descendants.map((descendant) => descendant.id)];

  let timeLogCount = 0;
  let totalDelta = 0;
  let totalInterrupt = 0;
  for (const id of targetIds) {
    const [count, summary] = await Promise.all([timeLog.countByNode(id), timeLog.sumByNode(id)]);
    timeLogCount += count;
    totalDelta += summary.delta;
    totalInterrupt += summary.interrupt;
  }

  return { nodeCount: targetIds.length, timeLogCount, totalDelta, totalInterrupt };
}

/**
 * 確認を得たうえでノードを削除する（FR-HIER-001.350）。配下のノードと、
 * それらに紐づく時間ログは B-9（`onDelete: Cascade`）が追従して削除する。
 */
export async function removeConfirmed(path: string): Promise<void> {
  const node = await requireNodeByPath(path);
  await hierarchy.remove(node.id);
}

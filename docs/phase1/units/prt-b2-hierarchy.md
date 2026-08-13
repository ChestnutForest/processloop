---
schema_version: 1
id: PRT-B2
unit: B-2
title: 階層のドメインロジック
status: draft
requirements:
  - FR-HIER-001
milestone: M1
estimated_loc: 400
actual_loc: 379
source:
  upstream_sha: bf5a4d63aff08410f79840001c816b37392e5001
  files:
    - src/net/sourceforge/processdash/hier/DashHierarchy.java
    - src/net/sourceforge/processdash/hier/HierarchyAlterer.java
    - src/net/sourceforge/processdash/hier/PropertyKey.java
  analysis_refs:
    - ANA-B2
---

# 移植仕様書: B-2 階層のドメインロジック

要求 `FR-HIER-001`（仕様17件）を実現する層。
永続化層（B-9）の上に置き、業務規則の判定と複数リポジトリの調整を担う。

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/req/fr-hier-001.md
```

---

## 1. 移植元の解析

### 対象

| ファイル | 行数 | 本ユニットで見る範囲 |
|---|---|---|
| `hier/DashHierarchy.java` | 1,353 | 階層の走査、パスの組み立て |
| `hier/HierarchyAlterer.java` | 631 | ノードの追加・削除・改名 |
| `hier/PropertyKey.java` | 161 | パスの表現と分解 |

### 移植元の構造

移植元は階層を `Prop` のツリーとして持ち、`PropertyKey` でパスを表現する。
ノードの操作は `HierarchyAlterer` に集約されており、
**変更のたびに `PendingDataChange` を積んで一括適用する**設計になっている。

⚠️ この遅延適用の仕組みは移植しない。データベースのトランザクションが同じ役割を果たす。

### プロセス定義との関係

ノードは `templateID` でプロセス定義を参照する（`PSP2` など）。
定義は `Templates/PSP-template.xml` にあり、フェーズの一覧を持つ。

**フェーズはノードとして階層に展開される。** 移植元では、プロセスを割り当てた時点で
その定義が持つフェーズが子ノードとして作られる。

### ⚠️ 未確認の事項

**階層の深さの上限**が移植元にあるかは確認できていない。
`DashHierarchy.java` を読む本ユニットで確認し、存在すれば同じ値を採用する。
存在しなければ上限を設けない（要求仕様の判断どおり）。

---

## 2. 移植設計

### B-9 との責務の分担

| 層 | 責務 | 具体例 |
|---|---|---|
| **B-2（本ユニット）** | 業務規則の判定、複数リポジトリの調整 | 削除前に記録の有無を確かめる |
| B-9（永続化層） | Prisma の呼び出し、型の変換 | `hierarchy.remove(id)` |

**B-2 は Prisma を直接呼ばない。** `@prisma/client` の import が現れたら設計違反である。

### 既に使える永続化層の API

```typescript
import { hierarchy, timeLog } from '../persistence';

hierarchy.findAll / findByPath / findChildren / create / update / updatePathsUnder / remove
timeLog.findByNode / findUnderPath / countByNode / sumByNode / create
```

⚠️ **`countByNode` と `sumByNode` は本ユニットのために用意した。**
削除前の確認（`FR-HIER-001.340`）で件数と合計時間を示すのに使う。

### ディレクトリ構成

```
packages/core/src/hierarchy/
├─ types.ts        入出力の型、エラー型
├─ tree.ts         階層の組み立てと走査
├─ node.ts         ノードの追加・改名・削除
├─ process.ts      プロセス定義の割り当てとフェーズ展開
└─ index.ts        公開する関数のまとめ
```

**B-3（プロセス定義の読み込み）とは分ける。** 本ユニットは
「読み込まれた定義を受け取って展開する」までを担い、
`PSP-template.xml` の解析は B-3 の責務とする。

### 型設計

```typescript
/** 画面に渡す階層。子を再帰的に含む。 */
export interface TreeNode {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly templateId: string | null;
  readonly phaseType: PhaseType | null;
  readonly children: readonly TreeNode[];
}

/** 削除の影響。確認を求める前に返す。 */
export interface RemovalImpact {
  readonly nodeCount: number;
  readonly timeLogCount: number;
  readonly totalDelta: number;
  readonly totalInterrupt: number;
}

/** プロセス定義は B-3 が公開する型を使用する。 */
import type { ProcessDefinition } from '../process';
```

⚠️ **`RemovalImpact` が本ユニットの要である。** 削除を実行せず、
何が失われるかだけを返す。呼び出し側（画面）が確認を得てから
削除の関数を呼ぶ、という二段構えにする。

### 関数の構成

#### `tree.ts`

| 関数 | 引数 | 戻り値 | 対応する仕様 |
|---|---|---|---|
| `buildTree` | — | `TreeNode[]` | `FR-HIER-001.510` |
| `findNode` | `path: string` | `TreeNode \| null` | — |
| `listDescendants` | `path: string` | `TreeNode[]` | `FR-HIER-001.520` |

**`buildTree` は平坦な配列を木に組み立てる。** `hierarchy.findAll()` が返す
`HierarchyNode[]` を `parentId` で結び、`sortOrder` で並べる。

#### `node.ts`

| 関数 | 引数 | 戻り値 | 対応する仕様 |
|---|---|---|---|
| `addRoot` | `name: string` | `TreeNode` | `.110` `.120` |
| `addChild` | `parentPath, name` | `TreeNode` | `.210` `.220` |
| `rename` | `path, newName` | `TreeNode` | `.520` |
| **`inspectRemoval`** | `path: string` | `RemovalImpact` | **`.340`** |
| **`removeConfirmed`** | `path: string` | `void` | **`.350`** |

**`inspectRemoval` と `removeConfirmed` を分ける理由**は、
確認を挟むためである。1つの関数にすると、画面側が確認を省略できてしまう。

```typescript
// 画面側の使い方
const impact = await inspectRemoval('/MyProject/Design');
if (impact.timeLogCount > 0) {
  // 「N件の記録（合計M分）が失われます」と表示して確認を求める
}
await removeConfirmed('/MyProject/Design');
```

#### `process.ts`

| 関数 | 引数 | 戻り値 | 対応する仕様 |
|---|---|---|---|
| `assign` | `path, definition` | `TreeNode` | `.320` `.410` `.420` |
| `reassign` | `path, definition` | `TreeNode` | `.330` |
| `canAddChild` | `path: string` | `boolean` | `.430` |

**`canAddChild` は画面が操作を出すかを決めるのに使う**（`FR-HIER-001.430`）。
フェーズのノードには子を追加できない。

### 名前の正規化

`FR-HIER-001.30` により、前後の空白を除去してから保存する。
**B-2 で行う。** 永続化層に業務規則を持たせない。

```typescript
const normalized = name.trim();
if (normalized.length === 0 || normalized.length > 200) {
  throw new InvalidNameError(name);
}
```

⚠️ **パスの区切り文字 `/` を名前に含められない。** 含めるとパスの分解が壊れる。
移植元も同じ制約を持つと考えられるが、⚠️ **未確認**である。
本ユニットで `DashHierarchy.java` を読む際に確認する。

### 改名時のパス再計算

`FR-HIER-001.520` により、配下すべての `path` を付け直す。

B-9 の `updatePathsUnder` が単一トランザクションで行うため、
**B-2 は呼ぶだけでよい**。

⚠️ ただし `TimeLogEntry` の `path` も更新される点に注意する。
B-9 の実績では、この処理（`cascadePathRename`）が見積りを大きく超えた。

### エラーの扱い

| 状況 | エラー型 | 対応する仕様 |
|---|---|---|
| 名前が空、または200文字超 | `InvalidNameError` | `.10` |
| 同じ親の下に同名が存在 | `DuplicateNameError`（B-9 から再送出） | `.20` |
| 対象のノードが存在しない | `NodeNotFoundError`（B-9 から再送出） | — |
| フェーズに子を追加しようとした | `PhaseNodeError` | `.430` |
| 名前に `/` を含む | `InvalidNameError` | — |

**B-9 のエラーはそのまま通す。** 変換して意味を失わせない。

---

## 3. 単体テスト仕様

### 検証方法

B-9 と同じ構成を使う。`vitest.global-setup.ts` がスキーマを1回投入し、
各テストは `beforeEach` でテーブルを消す。

⚠️ **ゴールデンファイルは作らない。** 移植元のドメインロジックは
アプリケーション全体の初期化を要し、単独実行できない。

### テストケース

#### `tree.ts`（5件）

| # | ケース | 期待 |
|---|---|---|
| 1 | 平坦な配列から木を組み立てる | 親子関係が復元される |
| 2 | 兄弟の並び順 | `sortOrder` の昇順になる |
| 3 | 最上位が複数ある | すべて根として返る |
| 4 | 存在しないパスを探す | `null` が返る |
| 5 | 子孫を列挙する | 深い階層も含めて返る |

#### `node.ts`（9件）

| # | ケース | 期待 | 仕様 |
|---|---|---|---|
| 6 | 最上位を作る | `parentId` が `null` | `.110` |
| 7 | 子を作る | パスが連結される | `.210` |
| 8 | 名前の前後に空白 | 除去される | `.30` |
| 9 | 空の名前 | `InvalidNameError` | `.10` |
| 10 | 201文字の名前 | `InvalidNameError` | `.10` |
| 11 | 名前に `/` を含む | `InvalidNameError` | — |
| 12 | 同じ親の下に同名 | `DuplicateNameError` | `.20` |
| 13 | 改名すると配下のパスが変わる | 子孫すべてが更新される | `.520` |
| 14 | 改名で時間ログのパスも変わる | `TimeLogEntry.path` が更新される | `.520` |

#### 削除の確認（5件）

| # | ケース | 期待 | 仕様 |
|---|---|---|---|
| 15 | 記録のないノードを調べる | `timeLogCount` が 0 | `.340` |
| 16 | 記録のあるノードを調べる | 件数と合計時間が返る | `.340` |
| 17 | 子孫の記録も集計される | 配下すべてが合算される | `.340` |
| 18 | `inspectRemoval` は削除しない | ノードが残る | `.340` |
| 19 | `removeConfirmed` で削除する | ノードと記録が消える | `.350` |

#### `process.ts`（6件）

| # | ケース | 期待 | 仕様 |
|---|---|---|---|
| 20 | プロセスを割り当てる | `templateId` が保存される | `.320` |
| 21 | フェーズが展開される | 定義の順に子が作られる | `.410` |
| 22 | フェーズ種別が保存される | `phaseType` が入る | `.420` |
| 23 | 別の定義に変える | 既存のフェーズが消えて作り直される | `.330` |
| 24 | フェーズに子を追加できるか | `canAddChild` が `false` | `.430` |
| 25 | 通常のノードは子を追加できる | `canAddChild` が `true` | `.430` |

**合計25件**を予定する。

---

## 4. トレーサビリティ

| 工程 | ID | 成果物 |
|---|---|---|
| 解析 | `ANA-B2` | `architecture-analysis.md` |
| 要求 | `FR-HIER-001` | `docs/phase1/req/fr-hier-001.md` |
| アーキテクチャ | — | `arc-architecture.md` 第2章・第3章 |
| **プログラム設計** | **`PRT-B2`** | **本書** |
| 実装 | `SRC-B2` | `packages/core/src/hierarchy/` |
| 単体テスト | `UT-B2` | `packages/core/src/hierarchy/*.test.ts` |
| 結合テスト | `IT-02` | ドメインロジック ↔ リポジトリ層 |

### 依存

| 対象 | 関係 |
|---|---|
| B-9 永続化層 | **前提**。実装済み |
| B-3 プロセス定義 | `ProcessDefinition` と PSP2 定義を受け取る。**実装済み** |
| B-4 時間ログ | `timeLog.create` を呼ぶ側。本ユニットは読むのみ |
| C 画面 | 本ユニットを呼ぶ |

**B-3 完成時に差し替え済み。** `ProcessDefinition` は `../process` から取得し、
テストでは `findDefinition('PSP2')` が返す定義を使用する。

---

## 5. 実績記録

| 項目 | 値 |
|---|---|
| 見積り行数 | **400** |
| 実績行数 | **379** |
| 見積り日 | 2026-08-12 |
| 完了日 | ⬜ 未記入 |
| 所要時間 | ⬜ 未記入 |
| 欠陥 | ⬜ 未記入 |

⚠️ **完了日・所要時間・欠陥は手動で記入しない。** ADR-0002 により devlog から遡及抽出する
（B-9 と同じ扱い。`docs/phase1/units/prt-b9-persistence.md` 5章）。

### 見積りの内訳

⚠️ **B-9 の乖離（250→517、2.07倍）を踏まえて見積もる。**

| ファイル | 見積り行数 | 実績行数 | 根拠 |
|---|---|---|---|
| `types.ts` | 70 | 60 | 型4つ、エラー型2つ、ヘッダ15行 |
| `tree.ts` | 80 | 79 | 関数3つ。木の組み立てに再帰 |
| `node.ts` | 130 | 123 | 関数5つ。検証と `RemovalImpact` の集計 |
| `process.ts` | 90 | 99 | 関数3つ。フェーズ展開の反復 |
| `index.ts` | 20 | 18 | 公開のまとめ |
| 補助 | 10 | 0 | テスト用の定数などは B-9 の `test-support.ts` を再利用し、新規には作らなかった |
| **合計** | **400** | **379** | |

### B-9 から学んだこと

| 教訓 | 本ユニットでの反映 |
|---|---|
| 関数の数だけで見積もると外れる | 各関数の処理内容から行数を積む |
| ヘッダとコメントを数えていなかった | 1ファイルあたり15行を加算済み |
| 計画外のファイルが3つ増えた | 補助として10行を計上 |
| 1機能が見積りを大きく超えた | `RemovalImpact` の集計を重めに見た |

⚠️ **`node.ts` を130行と重く見積もった**のは、B-9 で `cascadePathRename` が
突出した経験による。削除の影響集計も、子孫の走査と合算を伴う。

---

## 関連資料

**要求仕様**

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/req/fr-hier-001.md
```

**永続化層の移植仕様書**（本ユニットが呼ぶ API）

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/units/prt-b9-persistence.md
```

**アーキテクチャ仕様書**

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/arc-architecture.md
```



---
schema_version: 1
id: PRT-B9
unit: B-9
title: 永続化層
status: draft
requirements:
  - NFR-DATA-001
milestone: M1
estimated_loc: 250
actual_loc: 517
source:
  upstream_sha: bf5a4d63aff08410f79840001c816b37392e5001
  files:
    - src/net/sourceforge/processdash/hier/DashHierarchy.java
    - src/net/sourceforge/processdash/log/time/TimeLogIOConstants.java
  analysis_refs:
    - ANA-B9
---

# 移植仕様書: B-9 永続化層

M1 の依存の起点となるユニット。`hier`（B-2）と `log/time`（B-4）はいずれも
本ユニットが定めるスキーマとリポジトリ層に依存する。

対応する要求は `NFR-DATA-001`。

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/req/nfr-data-001.md
```

---

## 1. 移植元の解析

### 対象

| ファイル | 行数 | 本ユニットで見る範囲 |
|---|---|---|
| `hier/DashHierarchy.java` | 1,353 | `saveXML` / `loadXML` の入出力形式 |
| `log/time/TimeLogIOConstants.java` | — | 属性名の定数定義 |

上流SHA は `bf5a4d63aff08410f79840001c816b37392e5001`（Process Dashboard 2.7.6）。

### 移植元のファイル形式

移植元は4系統のファイルにデータを分けている。本ユニットが対応するのは前2つである。

| ファイル | 形式 | 単位 |
|---|---|---|
| **`state`** | XML。`<node>` の入れ子 | 全体で1つ |
| **`timelog.xml`** | XML。属性ベース | 全体で1つ |
| `*.def` | 旧はタブ区切り、新は XML | ノードごとに連番 |
| `*.dat` | 独自形式。計算式を含む | ノードごとに連番 |

⚠️ **時間ログだけが全ノード分を1ファイルにまとめている。** 欠陥ログとデータ定義は
ノードごとに `0.def` `1.def` と連番で分かれる。この非対称性は移植先では消え、
すべてテーブルになる。

### `state` の `<node>` 属性

`DashHierarchy.java` に定数として定義されている11種。

```
name / nodeID / templateID / dataFile / defectLog /
selected / href / constraints / imaginary / imaginaryUnless / ID
```

`maybePrintAttribute` は値が存在する場合のみ出力するため、**ノードごとに属性の数が異なる**。

### `timelog.xml` の `time` 属性

`TimeLogIOConstants.java` に定義。

| 属性 | 意味 |
|---|---|
| `id` | エントリの識別子 |
| `path` | 階層パス |
| `start` | 計測開始時刻 |
| **`delta`** | **経過時間（分）** |
| **`interrupt`** | **中断時間（分）** |
| `comment` | コメント |
| `flag` | 同期用メタデータ |

**`delta` と `interrupt` を別属性にするのが本質である。** PSP は中断を除いた
正味時間を測る方法論であり、この分離が方法論上の必然になっている。

### 全データを結ぶキー

移植元は **`path`（階層パス）**ですべてを結んでいる。
`/MyProject/Design` の形式で、時間ログも欠陥ログもデータ定義も `path` を持つ。

⚠️ 文字列の一致だけで結んでいるため、**ノード名を変えるとリンクが切れる**。

---

## 2. 移植設計

### 移植しないもの

| 項目 | 理由 |
|---|---|
| `dataFile` / `defectLog` 属性 | 連番ファイルの割り当て。移植先では外部キーで結ぶ |
| `imaginary` / `imaginaryUnless` | PSP0 から PSP3 の切り替えは第1.5期以降 |
| `constraints` | フェーズ順序の制約。運用で足りる |
| `href` | HTML への参照。移植先では画面が対応する |
| `flag`（時間ログ） | チーム同期用。第2期 |
| `.dat` の読み書き | 計算式エンジンに依存。M3 |

### ディレクトリ構成

```
packages/core/src/persistence/
├─ client.ts          Prisma クライアントの生成と共有
├─ types.ts           ドメイン型の定義
├─ hierarchy.ts       HierarchyNode のリポジトリ
├─ time-log.ts        TimeLogEntry のリポジトリ
└─ index.ts           公開する関数のまとめ
```

`prisma/schema.prisma` はリポジトリ直下に置く（Prisma の既定）。

### 型設計

**Prisma が生成する型をそのまま外へ出さない。** ドメイン型に変換して返す。

```typescript
// types.ts
export interface HierarchyNode {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly templateId: string | null;
  readonly phaseType: PhaseType | null;
  readonly parentId: number | null;
  readonly sortOrder: number;
}

export type PhaseType =
  | 'plan' | 'hld' | 'hldr' | 'dld' | 'dldr'
  | 'code' | 'cr' | 'comp' | 'ut' | 'it' | 'st' | 'at' | 'pl' | 'pm';

export interface TimeLogEntry {
  readonly id: number;
  readonly nodeId: number;
  readonly path: string;
  readonly start: Date;
  /** 中断を除いた正味時間（分）。 */
  readonly delta: number;
  /** 中断時間（分）。 */
  readonly interrupt: number;
  readonly comment: string | null;
}
```

**変換する理由**は3つある。

第1に、`packages/core` の利用側が Prisma に依存しなくなる。
第2に、M3 で値の取得元を計算式エンジンへ差し替えるとき、型が変わらない。
第3に、`phaseType` を文字列のユニオン型に絞り込める。

⚠️ Prisma のモデルでは `phaseType` を `String?` としている。列挙型にすると
移植元がフェーズ種別を追加したときマイグレーションが要るためである。
**型の絞り込みは変換の時点で行う。**

### 関数の構成

#### `hierarchy.ts`

| 関数 | 引数 | 戻り値 | 対応する仕様 |
|---|---|---|---|
| `findAll` | — | `HierarchyNode[]` | `NFR-DATA-001.210` |
| `findByPath` | `path: string` | `HierarchyNode \| null` | `.130` |
| `findChildren` | `parentId: number \| null` | `HierarchyNode[]` | `.310` |
| `create` | `input: CreateNodeInput` | `HierarchyNode` | `.10` |
| `update` | `id, input` | `HierarchyNode` | `.10` |
| `updatePathsUnder` | `id, oldPath, newPath` | `number` | `.310` |
| `remove` | `id: number` | `void` | `.10` |

**`updatePathsUnder` が要注意である。** ノード名を変えると配下すべての `path` を
付け直す必要があり、`TimeLogEntry` の `path` にも波及する。
**単一のトランザクションで行う。**

#### `time-log.ts`

| 関数 | 引数 | 戻り値 | 対応する仕様 |
|---|---|---|---|
| `findByNode` | `nodeId: number` | `TimeLogEntry[]` | `NFR-DATA-001.320` |
| `findUnderPath` | `path: string` | `TimeLogEntry[]` | `.320` |
| `countByNode` | `nodeId: number` | `number` | `FR-HIER-001.340` |
| `sumByNode` | `nodeId: number` | `{ delta, interrupt }` | `FR-HIER-001.340` |
| `create` | `input: CreateEntryInput` | `TimeLogEntry` | `.20` |

**`countByNode` と `sumByNode` を設ける理由**は、フェーズ削除時の確認
（`FR-HIER-001.340`）で件数と合計時間を示す必要があるためである。

#### `client.ts`

Prisma クライアントを1つ生成して共有する。

```typescript
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

export function getClient(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function disconnect(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
```

⚠️ **開発中の再読み込みで接続が増える問題**が Next.js で知られている。
第1期では `packages/core` 側で1つに保つ方式を採り、必要になれば
`globalThis` を用いる方式へ変える。

### エラーの扱い

Prisma の例外をそのまま外へ出さず、意味のある型に変換する（ARC 9.1）。

```typescript
export class DuplicateNameError extends Error {
  constructor(readonly parentId: number | null, readonly name: string) {
    super(`同じ親の下に同名のノードが存在する: ${name}`);
    this.name = 'DuplicateNameError';
  }
}

export class NodeNotFoundError extends Error { … }
```

| Prisma の例外 | 変換先 | 対応する仕様 |
|---|---|---|
| `P2002`（一意制約違反） | `DuplicateNameError` | `FR-HIER-001.20` |
| `P2025`（対象が存在しない） | `NodeNotFoundError` | `NFR-DATA-001.230` |
| その他 | そのまま投げる | — |

### マイグレーション

Prisma Migrate を用いる。初回は次で作る。

```powershell
pnpm prisma migrate dev --name init
```

⚠️ **M1 完成の時点から実データが入る。** ドッグフーディングによりこの開発自体の
記録が蓄積されるため、列の削除や改名は慎重に判断する（ARC 5.4）。

---

## 3. 単体テスト仕様

### ゴールデンファイルは作らない

⚠️ **A-1 とは検証方法が異なる。**

A-1（プリプロセッサ）は `CppFilter.main()` を単独実行できたため、
移植元の出力を正解データにできた。しかし永続化層は移植元の
ファイル形式を読み書きする層であり、**単独では実行できない**。

第1期では既存データの移行機能を作らないため、
**移植元との入出力の一致を検証する必要がない**。
代わりにリポジトリ層の振る舞いを単体テストで検証する。

### テスト環境

全テストファイルでSQLiteの`packages/core/prisma/test.db`を共有する。
`prisma db push`のCLI起動には時間がかかるため、Vitestの`globalSetup`から
実行全体で1回だけスキーマを投入する。各テストの`beforeEach`では全テーブルの行だけを削除する。

```typescript
process.env.DATABASE_URL = 'file:./test.db';
```

共有DBへの同時操作を避けるため、`vitest.config.ts`の`fileParallelism`を`false`にして
テストファイルを逐次実行する。構成と実行方法の詳細は[テストガイド](../../testing-guide.md)を参照する。

### テストケース

#### `hierarchy.ts`

| # | ケース | 期待 | 対応する仕様 |
|---|---|---|---|
| 1 | 最上位のノードを作る | `parentId` が `null` で作られる | `FR-HIER-001.110` |
| 2 | 子ノードを作る | 親の配下に作られ、`path` が連結される | `FR-HIER-001.510` |
| 3 | 同じ親の下に同名を作る | `DuplicateNameError` を投げる | `FR-HIER-001.20` |
| 4 | 別の親の下に同名を作る | 成功する | `FR-HIER-001.20` |
| 5 | 名前の前後に空白を含める | 除去して保存される | `FR-HIER-001.30` |
| 6 | ノード名を変える | 配下すべての `path` が付け直される | `FR-HIER-001.520` |
| 7 | 存在しない ID を更新する | `NodeNotFoundError` を投げる | `NFR-DATA-001.230` |
| 8 | 子を持つノードを削除する | 配下も削除される | — |
| 9 | 兄弟の並び順を保つ | `sortOrder` の昇順で返る | `FR-HIER-001.220` |

#### `time-log.ts`

| # | ケース | 期待 | 対応する仕様 |
|---|---|---|---|
| 10 | 記録を作る | `delta` と `interrupt` が保存される | `FR-TIME-001.510` |
| 11 | `interrupt` を省く | 既定値 0 になる | — |
| 12 | ノードに紐づく記録を取る | 対象ノードの分だけ返る | `NFR-DATA-001.320` |
| 13 | パス配下の記録を取る | 子孫の分も含めて返る | `FR-SUM-001.120` |
| 14 | 件数と合計を取る | 正しい件数と合計時間が返る | `FR-HIER-001.340` |
| 15 | 記録のないノードで合計を取る | 0 が返る | `FR-SUM-001.320` |
| 16 | ノードを削除する | 紐づく記録も削除される | `FR-HIER-001.350` |

#### 永続性

| # | ケース | 期待 | 対応する仕様 |
|---|---|---|---|
| 17 | 書き出した後に接続を切り、再接続する | 内容が保たれている | `NFR-DATA-001.110` |
| 18 | データベースのファイルがない状態で開く | 新規に作られる | `NFR-DATA-001.220` |

**合計18件**を予定する。

---

## 4. トレーサビリティ

| 工程 | ID | 成果物 |
|---|---|---|
| 解析 | `ANA-B9` | `architecture-analysis.md`（永続化の4系統） |
| 要求 | `NFR-DATA-001` | `docs/phase1/req/nfr-data-001.md` |
| アーキテクチャ | — | `arc-architecture.md` 第3章・第5章 |
| **プログラム設計** | **`PRT-B9`** | **本書** |
| 実装 | `SRC-B9` | `packages/core/src/persistence/` |
| 単体テスト | `UT-B9` | `packages/core/src/persistence/*.test.ts` |
| 結合テスト | `IT-01` | リポジトリ層 ↔ SQLite |

### 関連する他の要求

`NFR-DATA-001` 以外の要求からも本ユニットの関数を呼ぶ。

| 要求 | 呼ぶ関数 |
|---|---|
| `FR-HIER-001` | `hierarchy.*` すべて、`timeLog.countByNode` `sumByNode` |
| `FR-TIME-001` | `timeLog.create` |
| `FR-SUM-001` | `timeLog.findUnderPath` |

---

## 5. 実績記録

| 項目 | 値 |
|---|---|
| 見積り行数 | **250** |
| 実績行数 | **517** |
| 見積り日 | 2026-08-11 |
| 完了日 | ⬜ 未記入 |
| 所要時間 | ⬜ 未記入 |
| 欠陥 | ⬜ 未記入 |

⚠️ **完了日・所要時間・欠陥は手動で記入しない。** ADR-0002 により devlog から遡及抽出する。

### 見積りの内訳

| ファイル | 見積り行数 | 実績行数 |
|---|---|---|
| `prisma/schema.prisma` | 60 | 50 |
| `client.ts` | 20 | 28 |
| `types.ts` | 50 | 98 |
| `hierarchy.ts` | 80 | 228 |
| `time-log.ts` | 40 | 97 |
| `index.ts` | 10 | 16 |

⚠️ **テストコードは行数に含めない。** A-1 でも実装315行に対しテストは別に数えた。

完了時に実績を記入し、`docs/psp-data/size-log.csv` にも追加する。

```
https://github.com/ChestnutForest/processloop/blob/main/docs/psp-data/README.md
```

---

## 関連資料

**要求仕様**

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/req/nfr-data-001.md
```

**アーキテクチャ仕様書**（第3章のスキーマ、第5章の永続化）

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/arc-architecture.md
```

**移植元の解析**（永続化の4系統）

```
https://github.com/ChestnutForest/processloop/blob/main/docs/architecture-analysis.md
```

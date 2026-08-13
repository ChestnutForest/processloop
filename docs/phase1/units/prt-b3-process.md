---
schema_version: 1
id: PRT-B3
unit: B-3
title: プロセス定義の読み込み
status: draft
requirements:
  - FR-HIER-001
milestone: M1
estimated_loc: 200
actual_loc: 207
source:
  upstream_sha: bf5a4d63aff08410f79840001c816b37392e5001
  files:
    - Templates/PSP-template.xml
    - src/net/sourceforge/processdash/process/PhaseUtil.java
  analysis_refs:
    - ANA-B3
---

# 移植仕様書: B-3 プロセス定義の読み込み

`ProcessDefinition` を供給する層。B-2 の `process.assign` が引数に取る型を作る。

要求 `FR-HIER-001` の仕様 `.310`（定義の一覧を表示）`.410`（フェーズの展開）
`.420`（フェーズ種別の保存）に対応する。

---

## 1. 移植元の解析

詳細は [ana-b3.md](../../analysis/ana-b3.md) を参照。

```
https://github.com/ChestnutForest/processloop/blob/main/docs/analysis/ana-b3.md
```

本ユニットの設計に関わる点は次の5つである。

**1. 定義は静的である。** `PSP-template.xml` は上流のリリースごとに固定され、
実行時に変わらない。

**2. `<phase>` の出現順が実行順になる。** 並び順に意味がある。

**3. フェーズ種別は4分類。** `PhaseUtil.java` に appraisal / failure /
overhead / development の集合が定義されている。

**4. 判定は大文字小文字を区別しない。** 比較の前に小文字化する。

**5. どの分類にも属さない種別がありうる。** `PhaseUtil` は「その他」の集合を持たず、
4つの判定がすべて false を返す場合がある。

---

## 2. 移植設計

### ★ XML を実行時に解析しない

**PSP2 の定義を TypeScript の定数として持つ。**

| 案 | 判断 |
|---|---|
| 実行時に XML を解析 | ❌ `fast-xml-parser` の依存が増える。定義は静的で変わらない |
| **定数として持つ** | ✅ **採用。** 依存なし、型が付く、テストが速い |

⚠️ **上流が更新されたときの追随**が課題になる。
`Templates/PSP-template.xml` を読んで手で写す手順を、本書の第6節に残す。

### M1 で扱う範囲

**PSP2 の1種類のみ。** B-2 の移植仕様書で決めた方針に従う。

ただし**複数の定義を保持できる形**にし、PSP0/PSP1/PSP3 への対応は第1.5期に回す。

### ディレクトリ構成

```
packages/core/src/process/
├─ types.ts        ProcessDefinition と PhaseDefinition
├─ definitions.ts  PSP2 の定義データ（移植元からの転記）
├─ phase-type.ts   フェーズ種別の分類
└─ index.ts        公開する関数のまとめ
```

⚠️ **B-2 の `types.ts` に `ProcessDefinition` を仮置きしている。**
本ユニット完成後、B-2 側はこちらを import するように差し替える。

### 型設計

```typescript
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

/** PhaseUtil の4分類。どれにも属さない種別は 'other'。 */
export type PhaseCategory =
  | 'appraisal' | 'failure' | 'overhead' | 'development' | 'other';
```

⚠️ **`PhaseType` は B-9 の `persistence/types.ts` にある。** 再定義せず import する。

### 定義データ

`ana-b3.md` の第4節から転記する。**順序を変えない。**

```typescript
export const PSP2: ProcessDefinition = {
  id: 'PSP2',
  name: 'PSP2',
  hasDefectLog: true,
  phases: [
    { name: 'Planning',      type: 'plan' },
    { name: 'Design',        type: 'dld'  },
    { name: 'Design Review', type: 'dldr' },
    { name: 'Code',          type: 'code' },
    { name: 'Code Review',   type: 'cr'   },
    { name: 'Compile',       type: 'comp' },
    { name: 'Test',          type: 'ut'   },
    { name: 'Postmortem',    type: 'pm'   },
  ],
};
```

⚠️ **フェーズ名は英語のまま持つ。** 移植元の `name` が階層のノード名になり、
`state` の互換性に関わる。表示の日本語化は i18n で行う（`NFR-I18N-001`）。

### フェーズ種別の分類

`PhaseUtil.java` の4集合をそのまま移す。

```typescript
const APPRAISAL = ['appraisal','review','insp','reqinsp',
                   'hldr','hldrinsp','dldr','dldinsp','cr','codeinsp'];
const FAILURE   = ['failure','comp','ut','it','st','at','pl'];
const OVERHEAD  = ['overhead','mgmt','strat','plan','pm'];
const DEVELOPMENT = ['develop','req','stp','itp','td','hld','dld','code','doc'];
```

⚠️ **小文字化してから判定する**（移植元と同じ）。

### 関数の構成

| 関数 | 引数 | 戻り値 | 対応する仕様 |
|---|---|---|---|
| `listDefinitions` | — | `ProcessDefinition[]` | `FR-HIER-001.310` |
| `findDefinition` | `id: string` | `ProcessDefinition \| null` | `.320` |
| `classifyPhase` | `type: PhaseType` | `PhaseCategory` | `.420` |
| `isAppraisal` | `type: PhaseType` | `boolean` | M3 で使う |
| `isFailure` | `type: PhaseType` | `boolean` | M3 で使う |

⚠️ `isAppraisal` と `isFailure` は M1 では使わないが、
**M3 の歩留まり計算で必要になる**ため今のうちに作る。分類の実装が同じであるため。

---

## 3. 単体テスト仕様

### 検証方法

**データベースを使わない。** 純粋な関数のみで、B-9 の永続化層に依存しない。
`vitest.global-setup.ts` の対象外になる。

⚠️ ゴールデンファイルは作らない。移植元の `TemplateLoader` は
アプリケーション全体の初期化を要し、単独実行できない。

### テストケース

#### `definitions.ts`（4件）

| # | ケース | 期待 |
|---|---|---|
| 1 | 定義の一覧を取る | PSP2 が1件返る |
| 2 | ID で探す | PSP2 が返る |
| 3 | 存在しない ID で探す | `null` が返る |
| 4 | PSP2 のフェーズ数と順序 | 8件が定義の順で返る |

#### `phase-type.ts`（8件）

| # | ケース | 期待 |
|---|---|---|
| 5 | `dldr` を分類する | `appraisal` |
| 6 | `cr` を分類する | `appraisal` |
| 7 | `comp` を分類する | `failure` |
| 8 | `ut` を分類する | `failure` |
| 9 | `plan` を分類する | `overhead` |
| 10 | `code` を分類する | `development` |
| 11 | 大文字で渡す（`DLDR`） | `appraisal`。小文字化される |
| 12 | 未知の種別を渡す | `other` |

⚠️ **11番が重要である。** 移植元が `toLowerCase()` してから判定する仕様を引き継ぐ。

⚠️ **12番も落とさない。** `PhaseUtil` は「その他」を持たず4つとも false を返すため、
移植先では `other` として明示する。

#### PSP2 の全フェーズ（1件）

| # | ケース | 期待 |
|---|---|---|
| 13 | 8フェーズすべてを分類する | 順に overhead, development, appraisal, development, appraisal, failure, failure, overhead |

**合計13件**を予定する。

---

## 4. トレーサビリティ

| 工程 | ID | 成果物 |
|---|---|---|
| 解析 | `ANA-B3` | `docs/analysis/ana-b3.md` |
| 要求 | `FR-HIER-001` | `docs/phase1/req/fr-hier-001.md` |
| アーキテクチャ | — | `arc-architecture.md` 第2章 |
| **プログラム設計** | **`PRT-B3`** | **本書** |
| 実装 | `SRC-B3` | `packages/core/src/process/` |
| 単体テスト | `UT-B3` | `packages/core/src/process/*.test.ts` |

### 依存

| 対象 | 関係 |
|---|---|
| B-9 永続化層 | `PhaseType` を import する |
| B-2 階層 | **本ユニットを呼ぶ側**。完成後に差し替えが要る |
| M3 計算式エンジン | `isAppraisal` `isFailure` を使う |

### ⚠️ B-2 との差し替え

B-2 は現在 `ProcessDefinition` を自前で定義している。本ユニット完成後、
**B-2 の型定義を削除し、`../process` から import する**。

| 対象 | 作業 |
|---|---|
| `hierarchy/types.ts` | `ProcessDefinition` `PhaseDefinition` を削除 |
| `hierarchy/process.ts` | `../process` から import |
| `hierarchy/process.test.ts` | 定数の PSP2 を `findDefinition('PSP2')` に置換 |

⚠️ この差し替えは本ユニットの作業に含める。**実績行数にも計上する。**

---

## 5. 実績記録

| 項目 | 値 |
|---|---|
| 見積り行数 | **200** |
| 実績行数 | **207**（1.04倍） |
| 見積り日 | 2026-08-12 |
| 完了日 | ⬜ 未記入 |
| 所要時間 | ⬜ 未記入 |
| 欠陥 | ⬜ 未記入 |

⚠️ **完了日・所要時間・欠陥は手動で記入しない。** ADR-0002 により devlog から遡及抽出する
（B-9・B-2 と同じ扱い）。

### 見積りの内訳

`types.ts` 〜 `index.ts` は `wc -l`。B-2 の差し替えは
`git diff --numstat` の insertions + deletions（PSP の「追加＋変更行数」に合わせる。
`hierarchy/process.test.ts` は対象外）。

| ファイル | 見積り行数 | 実績行数 | 根拠 |
|---|---|---|---|
| `types.ts` | 40 | 28 | 型3つ、ヘッダ15行 |
| `definitions.ts` | 55 | 53 | PSP2 の8フェーズ、ヘッダ15行 |
| `phase-type.ts` | 60 | 75 | 配列4つ（計40要素）、判定5関数 |
| `index.ts` | 15 | 14 | 公開のまとめ |
| B-2 の差し替え | 30 | 37 | `hierarchy/types.ts` 12行削除、`hierarchy/process.ts` 4行追加・21行削除 |
| **合計** | **200** | **207** | |

### 見積りの根拠

A-1（1.05倍）、B-9（2.07倍）、B-2（0.95倍）の実績を踏まえる。

⚠️ **B-3 は最も外れにくい**と見ている。定義データの転記が中心で、
分岐や再帰を含まないためである。B-9 が外れたのは `cascadePathRename` の
再帰処理が原因であり、本ユニットに相当する処理はない。

**実績は1.04倍**で、この見立てどおりとなった。`phase-type.ts` は配列の要素を
複数行に分けて書いたため見積りをやや超え（60→75）、`types.ts` は逆に
見積りより短く収まった（40→28）。B-2 の差し替えは見積り（30）とほぼ一致した（37）。

---

## 6. 上流が更新されたときの追随

定義を定数で持つため、上流の変更が自動では反映されない。**手順を残す。**

```bash
git clone --depth 1 https://github.com/dtuma/processdash.git
cd processdash && git checkout <新しいSHA>
awk '/<template name="PSP2" /,/<\/template>/' Templates/PSP-template.xml
```

`<phase>` の `name` と `type` を `definitions.ts` に転記し、
Front Matter の `upstream_sha` を更新する。

⚠️ `PhaseUtil.java` の4集合も変わりうる。同時に確認する。

---

## 関連資料

**解析レポート**

```
https://github.com/ChestnutForest/processloop/blob/main/docs/analysis/ana-b3.md
```

**要求仕様**

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/req/fr-hier-001.md
```

**B-2 の移植仕様書**（差し替えの対象）

```
https://github.com/ChestnutForest/processloop/blob/main/docs/phase1/units/prt-b2-hierarchy.md
```

---
schema_version: 1
id: ANA-B3
unit: B-3
title: プロセス定義の読み込み
upstream_sha: bf5a4d63aff08410f79840001c816b37392e5001
files:
  - Templates/PSP-template.xml
  - src/net/sourceforge/processdash/process/PhaseUtil.java
  - src/net/sourceforge/processdash/hier/DashHierarchy.java
  - src/net/sourceforge/processdash/templates/TemplateLoader.java
---

# 解析: B-3 プロセス定義の読み込み

移植元がプロセス定義をどう表現し、どう読み込むかを実際のソースから記録する。

---

## 1. 対象と読んだ範囲

| ファイル | 全体 | 読んだ範囲 | 理由 |
|---|---|---|---|
| `PhaseUtil.java` | 88行 | **全体** | 短く、分類の定義がすべてここにある |
| `Templates/PSP-template.xml` | 348行 | `<template>` の一覧と PSP2 の全体 | 定義の実体 |
| `DashHierarchy.java` | 1,353行 | 430〜490行 | 要素名と属性名の定数 |
| `TemplateLoader.java` | 1,619行 | 1,390〜1,420行、公開メソッド一覧 | 解析の入口の特定 |

⚠️ `TemplateLoader.java` の大半は JAR の探索、外部リソースの取得、
未署名アドオンの拒否といったデスクトップ固有の処理であり、**読んでいない**。

---

## 2. 要素名と属性名の定数

**`DashHierarchy.java` に定義されている。** `TemplateLoader` はこれを参照する。

```java
public static final String TEMPLATE_NODE_NAME = "template";
public static final String PHASE_NODE_NAME    = "phase";
public static final String NAME_ATTR          = "name";
public static final String ID_ATTR            = "ID";
```

⚠️ **`ID` は大文字である。** 小文字の `id` も別用途で存在するため、混同しない。

---

## 3. プロセス定義の構造

### `<template>` に現れる属性

`PSP-template.xml` の12個の `<template>` から実際に確認した。

| 属性 | 例 | 意味 |
|---|---|---|
| `name` | `PSP2` | 表示名 |
| `ID` | `PSP2` | 識別子。`state` の `templateID` に対応 |
| `defectLog` | `true` | 欠陥ログを持つか |
| `usesRollup` | `PSP` | ロールアップの参照先 |
| `dataFile` | `psp2/dataFile.txt` | 計算式の定義ファイル |
| `htmlID` | `top` | 既定で開く HTML |
| `imaginaryUnless` | `pspProc` | 条件付きで省略可能 |
| `constraints` | `{Design Inspection(3){Code Inspection(-2)` | フェーズ順序の制約 |
| `defineRollup` | `no` | ロールアップを定義するか |
| `imaginary` | `true` | 省略可能なテンプレート |
| `href` | `none` | HTML への参照 |

### 定義されているテンプレート（12個）

```
PSP0 / PSP0.1 / PSP1 / PSP1.1 / PSP2 / PSP2.1 / PSP3 / PSP3cycle
Design Review / Code Review
PSP Data Rollup Prototype / Rollup PSP Data
```

⚠️ `Design Review` と `Code Review` は `dataFile="none"` `href="none"` を持ち、
**フェーズを持たない**。単独のテンプレートではなく、他から参照される部品である。

### `<phase>` の属性

```xml
<phase name="Planning"      htmlID="plan" type="plan"/>
<phase name="Design"        htmlID="dev"  type="dld"/>
```

| 属性 | 必須 | 意味 |
|---|---|---|
| `name` | ✅ | フェーズ名。階層のノード名になる |
| `type` | ✅ | フェーズ種別。分類に使う |
| `htmlID` | | 対応する HTML の ID |

---

## 4. PSP2 のフェーズ構成

M1 で扱う唯一の定義。**実際の XML から転記した。**

| # | `name` | `type` | 分類 |
|---|---|---|---|
| 1 | Planning | `plan` | overhead |
| 2 | Design | `dld` | development |
| 3 | Design Review | `dldr` | **appraisal** |
| 4 | Code | `code` | development |
| 5 | Code Review | `cr` | **appraisal** |
| 6 | Compile | `comp` | **failure** |
| 7 | Test | `ut` | **failure** |
| 8 | Postmortem | `pm` | overhead |

`<phase>` の出現順がそのまま実行順になる。

---

## 5. フェーズ種別の分類

`PhaseUtil.java` の全体を読んだ。**4分類が定義されている。**

```java
appraisalPhaseTypes   = { "appraisal", "review", "insp", "reqinsp",
                          "hldr", "hldrinsp", "dldr", "dldinsp", "cr", "codeinsp" }
failurePhaseTypes     = { "failure", "comp", "ut", "it", "st", "at", "pl" }
overheadPhaseTypes    = { "overhead", "mgmt", "strat", "plan", "pm" }
developmentPhaseTypes = { "develop", "req", "stp", "itp", "td",
                          "hld", "dld", "code", "doc" }
```

### 判定の仕様

```java
public boolean contains(String phaseType) {
    return phaseTypeSet.contains(phaseType.toLowerCase());
}
```

⚠️ **大文字小文字を区別しない。** 判定の前に小文字化する。
定義側の配列は「すべて小文字であること」がコメントで要求されている。

⚠️ **4分類は排他だが、どれにも属さない種別がありうる。**
`PhaseUtil` は「その他」を表す集合を持たず、4つの `isXxx` がすべて false を返す。

### 公開されている判定関数

```java
isAppraisalPhaseType / isFailurePhaseType
isDevelopmentPhaseType / isOverheadPhaseType
```

---

## 6. 読み込みの流れ

`TemplateLoader` は次の順に処理する。

```
1. テンプレートの探索先を集める（JAR、ディレクトリ、外部リソース）
2. 各 XML を DOM で解析する
3. getElementsByTagName("template") で定義を取り出す
4. ID ごとに HTML の対応表（scriptMaps）を作る
5. 階層のテンプレート辞書に登録する
```

### 移植に関わる部分

**3が本質である。** DOM で `<template>` を列挙し、
その配下の `<phase>` を順に読むだけの処理になっている。

⚠️ 1と4はデスクトップ固有である。JAR の探索も、
HTML スクリプトの対応づけも、Web 版では不要になる。

---

## 7. 移植しないもの

| 対象 | 理由 |
|---|---|
| JAR からのテンプレート探索 | 配布形態が違う |
| `scriptMaps`（HTML の対応表） | 画面は React で作り直す |
| 外部リソースからの MCF 取得 | チーム機能。第2期 |
| 未署名アドオンの拒否 | 拡張機構を持たない |
| `usesRollup` / `defineRollup` | ロールアップは第2期 |
| `imaginary` / `imaginaryUnless` | PSP0〜PSP3 の切り替え。第1.5期以降 |
| `constraints` | フェーズ順序の強制。運用で足りる |
| `dataFile` | 計算式エンジン（M3）で扱う |
| `htmlID` / `href` | 画面の対応づけが不要 |

---

## 8. ⚠️ 未確認の事項

| 項目 | なぜ確認しなかったか | いつ確認するか |
|---|---|---|
| `constraints` の文法 | 第1期で移植しないため | 第1.5期に順序制約を扱うとき |
| `imaginaryUnless` の判定条件 | 同上 | PSP0〜PSP3 対応時 |
| `dataFile` と定義の結び付き | 計算式エンジンの範囲 | M3 |
| PSP0/PSP1/PSP3 のフェーズ構成 | M1 は PSP2 のみ | 第1.5期 |
| `Design Review` テンプレートの用途 | フェーズを持たず、参照関係が不明 | 必要が生じたとき |
| テンプレートの読み込み順序の依存 | 単一ファイルしか扱わないため | 複数定義に対応するとき |

---

## 9. 移植への示唆

**定義は静的である。** PSP-template.xml は上流のリリースごとに固定され、
実行時に変わらない。したがって XML を実行時に解析する必要がない。

⚠️ ただし**上流が更新されたときの追随**は考える必要がある。
JSON へ変換する場合、変換の手順を記録しておかないと再現できない。

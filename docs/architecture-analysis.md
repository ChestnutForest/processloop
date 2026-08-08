# Process Dashboard プログラム構造 解析報告

作成日: 2026-07-20
対象: Process Dashboard（https://www.processdash.com/ ）
上流ピン: コミット `bf5a4d63aff08410f79840001c816b37392e5001`（Process Dashboard 2.7.6、2026-05-28）
ライセンス: GNU General Public License version 3 以降
著作権: Copyright (C) 1998-2025 Tuma Solutions, LLC

本書は Processloop（Next.js 移植版）の設計判断の根拠として、移植元の構造を実測にもとづき整理したものである。

---

## 目次

1. 全体規模
2. パッケージ構成と役割
3. 計算式エンジン（5層パイプライン）
4. データ永続化の4系統
5. プロセス定義とテンプレート機構
6. i18n（多言語対応）の実態
7. UI とロジックの分離度
8. ライセンス構造（4層）
9. 移植スコープの決定
10. 調査カバレッジと未解明領域

---

## 1. 全体規模

### 実測値

| 指標 | 値 |
|---|---|
| Java ファイル数 | **2,006** |
| Java 行数 | **399,364** |

### 計測値の変遷について

調査初期には「2,195ファイル / 450,180行」という数値を記録した。後の精査で 2,006ファイル / 399,364行 に修正している。差分の原因は、初期計測に生成コード（SableCC が生成するパーサ）やビルド生成物が含まれていたためと考えられる。**本書では後者（2,006 / 399,364）を採用する**。

### 主要パッケージの規模（第1期スコープ）

| パッケージ | ファイル数 | 行数 |
|---|---|---|
| ev（出来高管理） | 132 | 43,824 |
| util（ユーティリティ） | 127 | 24,109 |
| data（計算エンジン） | 171 | 21,702 |
| log（時間・欠陥ログ） | 100 | 19,142 |
| hier（階層構造） | 48 | 10,339 |
| tool/probe（見積り） | 26 | 5,670 |
| process（プロセス定義） | 24 | 4,394 |
| templates（テンプレート） | 11 | 3,865 |
| i18n | 12 | 1,489 |
| **合計** | **651** | **134,534** |

### スコープ外の主要パッケージ

| パッケージ | ファイル数 | 行数 | 扱い |
|---|---|---|---|
| teamdash（WBS Editor） | 387 | 85,634 | 第4期で判断 |
| ui（Swing UI） | 301 | 53,669 | **移植しない** |
| team（チーム機能） | 119 | 34,444 | 第2期 |
| l10n-tool（翻訳ツール） | 99 | 30,728 | **移植しない**（next-intl で代替） |
| tool/bridge | 87 | 17,806 | 第3期 |
| tool/export | 86 | 14,109 | 第2期 |
| tool/diff（LOCカウンタ） | 80 | 12,060 | 第3期 |
| net（通信） | 59 | 10,697 | 第2期 |
| tool/redact（匿名化） | 74 | 6,346 | 任意 |
| tool/perm（権限） | 22 | 5,076 | 第2期 |
| その他 | — | 約20,000 | — |

**Web 化により約11万行が不要**になる（Swing UI 53,669行、ui/lib 23,005行、l10n-tool 30,728行、util/lock 1,209行など）。

---

## 2. パッケージ構成と役割

### 依存の方向

```
ui （Swing）           ← 移植しない
  ↓
ev / tool/probe        ← 出来高管理・見積り
  ↓
hier / log / process   ← 階層・計測・プロセス定義
  ↓
data                   ← 計算式エンジン（中核）
  ↓
util                   ← ユーティリティ
```

**`data` が全体の中核**であり、他のほぼすべてが依存する。逆に `data` は `util` 以外にほとんど依存しない。この構造が、移植を `data` から始められる根拠になっている。

### 各パッケージの役割

| パッケージ | 役割 |
|---|---|
| **data** | 計算式の解析・評価・依存追跡。データ値の型システム |
| **hier** | プロジェクト階層（WBS）の表現と操作 |
| **log/time** | 作業時間の計測と記録 |
| **log/defects** | 欠陥の記録 |
| **process** | プロセス定義の読み込みと、動的なマクロ生成 |
| **templates** | テンプレートファイル（.dat, .link 等）の読み込み |
| **ev** | 出来高管理（Earned Value）。計画対実績、予測 |
| **tool/probe** | PROBE 見積り（回帰分析による規模・時間推定） |
| **util** | 文字列・XML・日付・統計などの汎用処理 |

---

## 3. 計算式エンジン（5層パイプライン）

移植において最も重要な発見が、**独自マクロ層が1つではなく5層ある**という点である。

### 5層の構成

```
入力: Templates/psp2/dataFile.txt など（92ファイル・7,627行）
  ↓
【層1】ステージ0-a: プリプロセッサ（util/CppFilter.java 358行）
       #define / #undef / #ifdef / #ifndef / #else / #endif を処理
  ↓
【層2】ステージ0-b: 動的マクロ生成（process/TemplateAutoData.java 423行）
       PSP-template.xml のフェーズ一覧から FOR_EACH_PHASE 等を生成
  ↓
【層3】ステージ2: パーサ（data/compiler/grammar.txt 283行）
       SableCC が文法定義からパーサを自動生成
  ↓
【層4】ステージ3: 評価器（data/compiler 直下 1,680行）
       構文木を評価
  ↓
【層5】ステージ5: DataRepository（data/repository 6,978行）
       値の保持と依存追跡・自動再計算
```

**プリプロセッサ単体では `dataFile.txt` を処理できない。** 4段のパイプラインが必要である。

### ★ パーサは手書きではない

`data/compiler/grammar.txt`（283行）が存在し、`build.xml` で `sablecc.jar` を実行している。つまり**パーサは SableCC というパーサジェネレータが文法定義から生成**している。

この発見の意味は大きい。**移植すべきは生成された数千行のパーサではなく、283行の文法定義**である。TypeScript 側では Peggy などに書き直せば、パーサ本体は自動生成される。

### 文法の構造

`grammar.txt` 283行の内訳。

```
Package        (1行)
Helpers        (4〜89行)    文字クラス定義
Tokens         (90〜145行)  字句定義
Ignored Tokens (146〜151行)
Productions    (152〜283行) 構文規則 28規則
```

演算子の優先順位は7段階に展開されている。

| レベル | 演算子 |
|---|---|
| level7 | `\|\|`（論理和） |
| level6 | `&&`（論理積） |
| level5 | `==` `!=` `<` `<=` `>` `>=` |
| level4 | `&` `&/`（文字列連結） |
| level3 | `+` `-` |
| level2 | `*` `/` |
| level1 | `!` `-`（単項） |

**⚠️ PEG（Peggy）は左再帰を扱えない。** `level3_expr = level3_expr addop level2_expr` のような規則は、反復構造に書き換える必要がある。

### プリプロセッサの仕様（実装により確定）

**対応ディレクティブ7種**

```
#if  #ifdef  #ifndef  #else  #endif  #define  #undef
```

**⚠️ 重要な制約**

- `#if` と `#elif` は**未対応**（上流のソースコメントに明記）
- `#include` は**この層では扱わない**（式の文法側の `include_directive` で処理）
- コメントは除去しない

**展開アルゴリズム**

1. `#define` を正規表現の置換ルールに変換して辞書に保持
2. 1行に対し、展開が起きなくなるまで反復適用
3. 一度適用したマクロは候補から除去（再帰展開の無限ループ防止）
4. 展開が発生したら候補を再構築して再試行

**出力の挙動**

- ディレクティブ行は**空行として残る**（行数が保たれる）
- 関数マクロの引数パターンは `[^(,)]*`（**引数に括弧・カンマを含められない**）
- 行継続 `\` は解決され、**展開結果は1行に連結される**

### 動的マクロ生成（層2）の仕様

`TemplateAutoData.java` が `PSP-template.xml` のフェーズ一覧から `#define` を組み立てる。

```java
defineIterMacro("FOR_EACH_PHASE",       phases.all);
defineIterMacro("FOR_EACH_APPR_PHASE",  phases.appraisal);
defineIterMacro("FOR_EACH_FAIL_PHASE",  phases.failure);
defineIterMacro("FOR_EACH_YIELD_PHASE", phases.yield);
```

**⚠️ 依存関係**: `yield` は `failure` が存在する場合のみ定義される。

その他に注入される `#define`。

```
TEMPLATE_ID, USES_ROLLUP_ID, DEFINE_ROLLUP_ID,
PROCESS_HAS_SIZE, PROCESS_HAS_DEFECTS, PROCESS_HAS_PHASES,
PROCESS_HAS_FAILURE, PROCESS_HAS_YIELD, PROCESS_HAS_APPRAISAL,
LAST_FAILURE_PHASE, Size
```

### DataRepository の依存追跡（層5）

**★ 現代の Signals と同一設計**であることが判明した。

`SubscribingExpressionContext.java`（98行）の実装。

```java
public SimpleData get(String dataName) {
    if (!currentSubscriptions.contains(dataName)) {
        data.addActiveDataListener(dataName, listener, listenerName, false);
        currentSubscriptions.add(nameListenedTo);
    }
    ...
}
```

**式の評価中に値を読むと、その場で自動的に依存として購読登録される。** これは `@preact/signals-core` や MobX の `computed` と完全に同じ思想である。Process Dashboard は2000年代初頭にこれを Java で手作りしていた。

**DataRepository 4,306行の責務内訳**

| 責務 | 推定行数 | 移植方針 |
|---|---|---|
| 値の読み書き | 約600 | 移植 |
| **依存追跡・通知** | **約1,500** | **ライブラリで代替** |
| ファイル入出力 | 約800 | Prisma に置換 |
| 名前解決・階層 | 約500 | 移植 |
| リネーム処理 | 約300 | 第1期では優先度低 |
| **整合性管理** | **約400** | **batch() で代替** |
| ダンプ・デバッグ | 約200 | 移植不要 |

`startInconsistency` / `finishInconsistency`（一括更新中は再計算を止める仕組み）は、Signals の `batch()` にそのまま対応する。

---

## 4. データ永続化の4系統

### 全体像

```
データディレクトリ/
├─ state          階層構造（XML・<node> 入れ子）
├─ 0.dat, 1.dat…  ノードごとのデータ定義（連番）
├─ global.dat     全体で共有されるデータ定義
├─ 0.def, 1.def…  ノードごとの欠陥ログ（連番）
└─ timelog.xml    時間ログ（全ノード分をまとめて1ファイル）
```

**すべてが `path`（階層パス）で結び付く**構造である。

### state ファイル（階層構造）

Java のシリアライズではなく**素直な XML**。`DashHierarchy.saveXML()` が `<node>` 要素を入れ子で書き出す。

**属性11種**

```
name, nodeID, templateID, dataFile, defectLog,
selected, href, constraints, imaginary, imaginaryUnless, ID
```

`maybePrintAttribute` は値が存在する場合のみ出力するため、**ノードごとに属性の数が異なる**。

**重要**: `templateID` が `PSP-template.xml` の `ID` 属性に対応する。ノードがどのプロセス（PSP0/PSP2 等）に属するかがここで決まる。

### timelog.xml（時間ログ）

`log/time/TimeLogIOConstants.java` に定数として定義。

| 属性 | 意味 |
|---|---|
| id | エントリID |
| path | 階層パス |
| start | 開始時刻 |
| **delta** | **経過時間（分）** |
| **interrupt** | **中断時間（分）** |
| comment | コメント |
| flag | 同期用メタデータ |

**`interrupt` が独立した属性**である点が本質的である。PSP は中断を除いた正味の作業時間を測る方法論だからである。

**非対称性**: 時間ログだけは全ノード分が1ファイルにまとまり、`.dat` と `.def` はノードごとに分かれる。

### 欠陥ログ（旧タブ区切り＋新XML）

`Defect.java` の `toString` は8項目をタブ区切りで連結する。

```
number, defect_type, phase_injected, phase_removed,
fix_time, fix_defect, description, date
```

**XML が選ばれる条件**（`needsXmlSaveFormat`）

```java
return fix_count != 1 || fix_pending
        || (injected != null && injected.phaseID != null)
        || (removed  != null && removed.phaseID  != null);
```

旧形式には `fix_count` と `fix_pending` の列が存在せず、フェーズも名前しか持てない。**新機能を表現できない場合に XML へ切り替わる**設計である。

移植では**新形式の XML のみ対応すれば足りる**。

### .dat ファイル（データ定義）

**単純な連番**である。

```java
protected String getNextDF() {
    return "" + (nextDataFileNumber++) + getFilenameSuffix() + ".dat";
}
```

起動時にディレクトリを走査し、最大番号+1 から採番する。`.def` も同じ仕組み。

### ダンプ形式（検証への利用可否）

| 形式 | 出力内容 | ゴールデン用途 |
|---|---|---|
| DUMP_STYLE_TEXT | CSV | — |
| **DUMP_STYLE_DATA** | **`名前==値`（計算結果）** | **✅ ステージ5の検証に使える** |
| DUMP_STYLE_CALC | 計算式そのもの | ❌ 使えない |

`DUMP_STYLE_CALC` は `getValue()` を呼ぶため計算式が出力される。検証に必要なのは計算結果なので目的が合わない。また `dumpRepository` はリポジトリの完全な初期化を要するため、`CppFilter` のような単独実行ができない。

---

## 5. プロセス定義とテンプレート機構

### PSP-template.xml（348行）

**属性20種**（出現数つき）

| 属性 | 出現数 | 意味 |
|---|---|---|
| name | 87 | テンプレート名・フェーズ名 |
| **type** | **73** | **フェーズ種別（最重要）** |
| ID | 58 | 識別子。`TEMPLATE_ID` の元 |
| htmlID | 51 | 対応する HTML の ID |
| href | 50 | HTML ファイルのパス |
| title | 39 | 表示名 |
| inPackage | 37 | 所属パッケージ |
| imaginary | 16 | 省略可能なフェーズか |
| dataFile | 13 | データ定義ファイルのパス |
| version | 11 | バージョン |
| id | 11 | 小文字の識別子（`ID` とは別用途） |
| constraints | 11 | フェーズ順序の制約 |
| category | 11 | 分類 |
| imaginaryUnless | 8 | 条件付きで省略可能 |
| usesRollup | 7 | ロールアップを使うか |
| defectLog | 7 | 欠陥ログを持つか |
| defineRollup | 3 | ロールアップを定義 |
| rollupDataFile | 1 | ロールアップ用データファイル |
| requires | 1 | 依存 |
| autoData | 1 | 自動データ生成の指定 |

### ★ フェーズ分類（PSP の品質分析の中核）

`process/PhaseUtil.java` に定義。

```java
appraisalPhaseTypes = { "appraisal", "review", "insp", "reqinsp",
                        "hldr", "hldrinsp", "dldr", "cr", ... }
failurePhaseTypes   = { "failure", "comp", "ut", "it", "st", "at", "pl" }
```

| 種別 | 意味 | 該当する type |
|---|---|---|
| **appraisal（評価）** | 欠陥を**見つける**工程 | `dldr`（設計レビュー）、`cr`（コードレビュー）、`hldr` |
| **failure（失敗）** | 欠陥が**表面化する**工程 | `comp`（コンパイル）、`ut`（単体テスト）、`it`、`st`、`at` |
| その他 | — | `plan`、`dld`、`code`、`pm`、`hld` |

「評価フェーズで見つけた欠陥」と「失敗フェーズで見つけた欠陥」の比率から、レビューの有効性を測る。

### 定義されているテンプレート

```
PSP0, PSP0.1, PSP1, PSP1.1, PSP2, PSP2.1, PSP3, PSP3cycle,
Design Review, Code Review,
PSP Data Rollup Prototype, Rollup PSP Data
```

`imaginary="true"` は「PSP0 では実施しないが上位プロセスで有効になる」フェーズを表す。PSP2 でレビューが導入される、という段階的な学習構造を表現している。

### ★ TSP のプロセス定義は存在しない

`Templates/` 配下の全 XML（8ファイル）を確認したが、**TSP という語を含む定義ファイルは0件**である。

```
Dash-template.xml       Git-template.xml       Import-template.xml
PSP-template.xml        Redact-template.xml    SCR-template.xml
l10nTool-template.xml   pspForEng-template.xml
```

代わりに `Templates/team/` に**中立的な名前のカスタムプロセス定義**がある。

**Universal.xml**（汎用テンプレート）

```xml
<custom-process name="Universal" abbr="Univ">
    <phase longName="Planning"      type="PLAN" />
    <phase longName="Action"        type="develop" />
    <phase longName="Creation"      type="develop" />
    <phase longName="Inspection"    type="appraisal" />
    <phase longName="Validation"    type="failure" />
    <phase longName="Retrospective" type="PM" />
    <phase longName="Miscellaneous" type="overhead" />
    <sizeMetric name="Pages" />
    <sizeMetric name="Words" />
    <sizeMetric name="Story Points" />
</custom-process>
```

**PDSSD.xml**（Software System Development の例）も同様に中立的な名称である。

生成機構は `team/mcf` パッケージ（16ファイル / 3,564行）。MCF は Metrics Collection Framework の略と推測される。

**この構造が意味すること**

| | PSP | TSP |
|---|---|---|
| GPL ソースでの提供 | **プロセス定義が同梱** | **定義を作る機構のみ** |
| フェーズ | PSP0〜PSP3 で固定 | 利用者が定義 |
| 規模メトリクス | LOC 中心 | 任意（Pages / Story Points 等） |

`Universal.xml` の `type` 属性は PSP と共通（`appraisal` / `failure` / `PM` / `overhead`）である。**フェーズ分類と計算エンジンは PSP とチームプロセスで共通に使える。**

### テンプレート資産の規模

| 種別 | ファイル数 | 行数 | 調査状況 |
|---|---|---|---|
| `.txt`（dataFile） | 92 | 7,627 | PSP分61ファイルのみ確認 |
| `.xml`（定義） | 39 | 4,948 | PSP-template.xml のみ精読 |
| `.shtm`（レポート） | 131 | 9,419 | ❌ 未分類 |
| `.js` | 29 | 11,719 | ❌ 未調査 |
| `.link` | 291 | 690 | 書式のみ確認 |

**`.dat` に約1.2万行の計算式資産**が詰まっている。PSP0.1 / PSP1 / PSP2 の違いは、これらの差分で表現されている。**計算式エンジンをそのまま移植する（案A）根拠**がここにある。エンジンがなければ、この資産をすべてコードに書き直すことになる。

---

## 6. i18n（多言語対応）の実態

### 日本語リソースは実在した

事前調査では「未確認」としていたが、**22ファイル・1,347キーの日本語訳が実在**した。全11言語中3番目の充実度である。

### 網羅率の分布（48.9%）

| リソース | 網羅率 |
|---|---|
| `(Resources)` | 95% |
| **`ProcessDashboard`（本体UI）** | **20.1%** |

**ユーザーが最初に触る部分ほど未訳が多い**という厄介な分布である。

### 移植方針

`l10n-tool`（99ファイル / 30,728行）は Java 独自の翻訳支援ツールであり、**next-intl で完全に代替できる**。`i18n` パッケージ（12ファイル / 1,489行）も移植不要。

既存の日本語訳1,347キーは、**資産として next-intl のメッセージファイルに変換できる**。

---

## 7. UI とロジックの分離度

移植の難易度を左右する要素として、Swing への依存度を実測した。

| パッケージ | Swing 依存ファイル数 | 割合 |
|---|---|---|
| **data** | **1 / 171** | **0.6%** |
| ev | 22 / 132 | 16.7% |
| log | 26 / 100 | 26.0% |
| hier（直下） | 2 / 17 | 11.8% |
| hier（ui 含む） | 20 / 48 | 41.7% |
| process | 1 / 16 | 6.3% |
| templates | 2 / 8 | 25.0% |

**`data` はほぼ完全に UI 非依存**である。これが「バックエンドを別建てせず `packages/core` に統合する」判断の根拠になった。

### ev の内訳（当初43,825行 → 実質16,428行）

| 区分 | ファイル数 | 行数 | 扱い |
|---|---|---|---|
| 直下（コアロジック） | 52 | 20,893 | 必要（更に分割可） |
| `ev/ci`（信頼区間） | 22 | 2,841 | 任意 |
| `ev/ui`（Swing 画面） | 58 | 20,090 | **74%が破棄対象** |

`ev/ui` の20,090行のうち**14,814行が Swing 依存**。特に `TaskScheduleDialog` は単体4,284行あるが、これは Swing の画面実装であり React で作り直す。

一方 `EVReport.java`（2,303行）と `EVWeekReport.java`（1,732行）は **Swing に依存せず HTML を生成**するロジックであり、React 化の際の仕様書として最も価値がある。

---

## 8. ライセンス構造（4層）

Process Dashboard の配布物は、性質の異なる4つの層から成る。

| 層 | 内容 | ライセンス |
|---|---|---|
| **1. 本体コード** | Java ソース全体 | **GPLv3 以降** |
| **2. CMU 特別許諾素材** | PSP/TSP のスクリプト・記入フォーム | 個人利用限定・派生には SEI の書面許可が必要 |
| **3. CC BY 4.0 教材** | 2018年版 PSP/TSP 教材 | CC BY 4.0（出典表示で利用可） |
| **4. サービスマーク** | PSP、TSP、Personal/Team Software Process | CMU のサービスマーク |

### ★ 重要な発見

**GitHub の GPL ソースには、層2（CMU 特別許諾素材）が同梱されていない。** それらは別配布物である。

この事実により、**フォーク・改名・移植に障害がない**ことが確定した。

### GPLv3 セクション7の追加許諾

上流には通常の GPLv3 にない追加許諾（Tuma Solutions 製モジュールとの結合を許す条項）が付いている。

- Java 1,978ファイル中 **1,922ファイル（97.2%）**のヘッダに通知
- 文言のバリエーションは**0件**（完全に統一）
- 通知が無い56ファイルは**第三者由来のライセンスを持つ傾向**

### 第三者著作物

第1期スコープ639ファイルを走査した結果。

| ファイル | 行数 | ライセンス | 第1期での扱い |
|---|---|---|---|
| **util/StringUtils.java** | 637 | **LGPL 2.1 以降**（Justin P. McCarthy） | ⚠️ 使用中。**移植せず標準機能で代替** |
| util/FastDateFormat.java | 1,748 | Apache License 2.0 | date-fns で代替 |
| util/Diff.java | 828 | LGPL | 第1期で未使用 |
| util/ClientHttpRequest.java | 564 | パブリックドメイン | 第1期で未使用 |

**⚠️ 走査方法の教訓**: ライセンス名で検索すると、著作権者名のみ記載しているファイルを見逃す。実際に2件が後から判明した。

| ファイル | 著作権者 |
|---|---|
| util/FileProperties.java | Justin P. McCarthy |
| util/ThreadMonitor.java | Sun Microsystems, Inc.（2004） |

### サービスマークの出現

| 種別 | 件数 |
|---|---|
| HTML / SHTM 内 | 377 |
| `.properties`（UI文言） | 104 |
| Java コード内の文字列 | 82 |
| **XML プロセス定義の ID / name** | **23** |
| Java クラス名 | 12 |
| Templates のディレクトリ名 | 11 |
| **合計** | **609** |

第1期スコープの Java に限ると**89箇所（15%）**のみ。クラス名12件はすべて `ui/web/psp/` 配下であり、React 再設計により引き継ぐ必要がない。

**⚠️ 最も判断が要る箇所**は `ID="PSP0"` 〜 `ID="PSP3cycle"` である。これは表示文字列ではなく**データの識別子**であり、`state` の `templateID` と `#define TEMPLATE_ID` に波及する。変更するとデータ構造全体に影響する。

---

## 9. 移植スコープの決定

### 第1期スコープ

| 基準 | 内容 |
|---|---|
| 目的 | 個人の開発プロセスを計測・改善する |
| 含む | PSP 機能 ＋ PROBE ＋ EV |
| 除く | TSP・チーム機能・周辺ツール |

### 規模と圧縮率

| 段階 | 行数 |
|---|---|
| 元の全体 | 399,364 |
| 第1期スコープ | 134,534（33.7%） |
| うち移植対象 | 約 40,000 |
| **TypeScript 実装後** | **7,200〜9,800** |

圧縮が効く要因は3つある。

1. **UI の破棄** — Swing 実装は React で作り直す
2. **既存ライブラリの活用** — FastDateFormat 1,748行 → date-fns、Base64 1,458行 → 標準機能
3. **言語の簡潔さ** — Java の冗長さ（getter/setter、型宣言）が TypeScript では圧縮される

### 主要な設計判断

| 判断 | 結論 | 根拠 |
|---|---|---|
| 計算式エンジン | **案A（エンジンごと移植）** | Templates に1.2万行の計算式資産 |
| バックエンド | **別建てしない** | `data` の Swing 依存が0.6% |
| DataRepository | **案ii（Signals ライブラリ）** | 元が同一設計思想。約1,900行を委譲 |
| パーサ | **Peggy** | 文法283行が既存。PEG に1対1で移せる |
| 検証方法 | **ゴールデンファイル** | `CppFilter.main()` が単独実行可能 |
| モノレポ | **pnpm workspaces** | 幽霊依存を構造的に防ぐ |
| DB | **SQLite + Prisma** | 個人利用に十分 |

---

## 10. 調査カバレッジと未解明領域

### 深度別のカバレッジ

| 深度 | 内容 | 規模 |
|---|---|---|
| **1. 精読** | メソッド単位で読解 | 約2,500行（**0.6%**） |
| **2. 構造分析** | 行数・依存・Swing結合・ライセンス走査 | 134,534行（**33.7%**） |
| **3. 表層計測** | 行数のみ | 264,830行（66.3%） |
| **4. 未着手** | 存在確認のみ | installer、個別JAR |

精読は全体の0.6%にすぎないが、**この範囲が移植方針の主要な判断をすべて決定づけた**。

### 精読したファイル

| ファイル | 行数 | 得られた成果 |
|---|---|---|
| util/CppFilter.java | 358 | プリプロセッサ仕様・単独実行を実証 |
| data/compiler/grammar.txt | 283 | 28規則・7段階の優先順位 |
| Templates/PSP-template.xml | 348 | 全20属性・フェーズ分類 |
| process/TemplateAutoData.java | 423 | `FOR_EACH_PHASE` の生成機構 |
| data/repository/SubscribingExpressionContext.java | 98 | **Signals と同一設計と判明** |
| data/repository/DataRepository.java | （約200行分） | 責務内訳・ダンプ形式 |
| hier/DashHierarchy.java | （約150行分） | state が XML・`.dat` 連番規則 |
| log/defects/Defect.java | （主要部） | `needsXmlSaveFormat` の4条件 |
| log/time/TimeLogIOConstants.java | （全体） | 時間ログの XML 書式 |
| process/PhaseUtil.java | （主要部） | appraisal/failure 分類 |
| README-license.txt | 32 | セクション7追加許諾 |

### 未解明領域

**カテゴリ1: 第1期の実装に必要（実装時に埋まる）**

- `DataRepository.java` の残り約4,100行
- `compiler/function` 57個 4,180行の個別実装
- `data` 直下の値型21ファイル 1,925行の型階層
- `TemplateLoader.java` 1,619行の内訳
- `Templates/*.txt` の PSP 以外31ファイル（5,116行）
- `Templates/*.xml` の PSP-template 以外38ファイル（4,600行）

**カテゴリ2: 完全に未調査**

- `Templates/*.js` 29ファイル 11,719行 — **独自ロジックが埋まっている可能性**
- `.shtm` 131ファイル 9,419行の分類

**カテゴリ3: ライセンス（継続確認）**

- `lib/*.jar` 36個の個別ライセンス
- `teamdash/license/` の内容
- ⚠️ 追加許諾の派生物での効力（法的判断）
- ⚠️ 内部識別子でのサービスマーク使用（法的判断）

**カテゴリ4: 実装時に検証**

- Signals の循環検出が元の挙動と一致するか
- Peggy での左再帰書き換えが28規則すべてで通るか
- `StringUtils` の固有処理のうち LGPL 由来の範囲

### 既存テストの分布

元のリポジトリの `test/` は40ファイル / 6,906行。

| パッケージ | テスト数 |
|---|---|
| log | 17 |
| util | 13 |
| tool | 5 |
| templates | 1 |
| security | 1 |
| **data** | **0** |

**`data`（計算エンジン）にテストが1件も存在しない。** これがゴールデンファイル方式を採用した直接の理由である。参照できるテストがないため、元の実装を動かして出力そのものを基準にする必要があった。

---

## 付録: 移植ステージと対応表

| ステージ | 移植元 | 行数 | 移植後 | 状態 |
|---|---|---|---|---|
| **0-a** | util/CppFilter.java | 358 | **315** | **✅ 完了** |
| 0-b | process/TemplateAutoData.java | 423 | 250〜350 | 未着手 |
| 1 | data 直下（値の型） | 1,925 | 約600 | 未着手 |
| 2 | data/compiler/grammar.txt | 283 | 約470 | 未着手 |
| 3 | data/compiler（評価器） | 1,680 | 約800 | 未着手 |
| 4 | compiler/function | 4,180 | 約1,200 | 未着手 |
| 5 | data/repository | 6,978 | 1,200〜1,500 | 未着手 |
| — | util（使用59クラス） | 11,990 | 1,900〜2,400 | 未着手 |
| — | hier / process / templates | 18,598 | 3,000〜4,000 | 未着手 |
| — | log（時間・欠陥） | 7,398 | 約1,500 | 未着手 |
| — | tool/probe | 5,670 | 約1,200 | 未着手 |
| — | ev（EV-1〜EV-3） | 16,428 | 約3,000 | 未着手 |
| — | 永続化層 | — | 約830 | 未着手 |
| — | Templates 変換 | — | 800〜1,000 | 未着手 |

---

## 参考: 本書の根拠となる調査報告

個別の詳細は次の報告書に記録している（プロジェクト外の作業成果）。

```
phase0-report.md          初期の規模調査
scope-report.md           第1期スコープの確定
ev-split-report.md        ev パッケージの分割
stack-decision.md         技術スタックの決定
formula-engine-plan.md    計算式エンジンの移植計画
preprocessor-report.md    5層パイプラインの発見
util-classification.md    util 127ファイルの分類
persistence-report.md     永続化の調査
a1-a2-report.md           ゴールデン生成の実証・PSP-template.xml
b1-b4-report.md           永続化の詳細4点
c1-c2-c5-report.md        ライセンス走査・npm依存
c3-c4-report.md           追加許諾・サービスマーク
d1-d2-e3-e4-report.md     DataRepository・パーサ・パッケージ内部
coverage-report.md        調査カバレッジ
roadmap.md                開発ロードマップ
psp-tsp-roadmap.md        PSP と TSP の対比
```

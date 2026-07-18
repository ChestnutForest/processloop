# i18n 棚卸し表（Phase 0 / 変換前の調査）

移植元 Process Dashboard の翻訳リソースを調査して記録するシート。
**ここでは調査と記録だけを行い、ソース変換はまだ行わない。**

## 背景（調査済みの事実）

- Process Dashboard は Java 標準の仕組み（`ResourceBundle` + `.properties`）で i18n されており、
  文字列がコードから分離済み。→ JSON への機械的変換がしやすい。
- 翻訳編集用に **Localization Tool** を同梱（`C → Tools → Localization Tool`）。
  OS の言語設定が英語だとこのメニューは出ない＝**OS ロケールで表示言語が決まる設計**。
- i18n の網羅度にはムラがある。WBS Editor がバージョン 2.4 でようやく対応した経緯があり、
  **キー化されていない英語ベタ書きが残っている前提**で調べること。
- **日本語リソースの同梱は未確認**。存在しない前提で計画する（あれば加点）。

## 調査手順

1. 配布物を `reference/legacy-java/` に展開する（**読み取り専用。改変しない**）。
2. `*.properties` を全件列挙する。
3. ロケール接尾辞（`_ja` / `_es` など）付きファイルの有無と数を数える。
4. 英語の元ファイル（接尾辞なし）とキー数を比較し、**網羅率**を出す。
5. 各ファイルがどの**ライセンス層**に属するかを分類する（下記）。
6. ベタ書き英語（`.properties` に無い画面文言）を洗い出す。

### 参考コマンド（PowerShell）

```powershell
# properties ファイルの一覧と件数
Get-ChildItem -Recurse -Filter *.properties reference\legacy-java | Select-Object FullName

# ロケール付きファイルだけ抽出
Get-ChildItem -Recurse -Filter *_??.properties reference\legacy-java

# 日本語リソースの有無
Get-ChildItem -Recurse -Filter *_ja.properties reference\legacy-java
```

## ★ ライセンス層の切り分け（最重要）

i18n 作業でも、UI 文字列と PSP/TSP コンテンツの文言を**必ず分けて扱う**。

| 層 | 内容 | i18n 作業での扱い |
|---|---|---|
| 第1層 GPLv3 | 本体アプリの UI 文字列 | 翻訳・移植してよい |
| 第2層 CMU 特別許諾 | PSP/TSP のスクリプト・フォーム文言 | **翻訳・改変に書面許可が必要。原則そのまま移植しない** |
| 第3層 CC BY 4.0 | 2018年版 PSP/TSP 教材 | 出典表示付きで利用可（差し替え供給源） |
| 第4層 サービスマーク | PSP / TSP 等の名称 | 製品名・ブランドに使わない |

## 棚卸し表（記入する）

| # | ファイル | 層 | キー数 | ja の有無 | 移植方針 | 備考 |
|---|---|---|---|---|---|---|
| 1 | （例）resources/Templates.properties | 第1層 | | 無 | JSON化 | |
| 2 | （例）PSP スクリプト関連 | 第2層 | | 無 | 移植しない→置換/許可/除外 | ⚠️要確認 |
| 3 | | | | | | |

## ベタ書き英語の洗い出し

| # | 場所（ファイル/画面） | 文言 | 対応 |
|---|---|---|---|
| 1 | | | キー化して en.json に追加 |

## 変換方針（実施は次フェーズ）

- `.properties` → `i18n/messages/en.json` へ変換。キー名は**意味ベース**に再設計する
  （元のキーをそのまま流用せず、`nav.dashboard` のような構造化キーにする）。
- 日本語は `ja.json` に新規作成。**既存の日本語リソースは期待しない**。
- 変換スクリプトを書く場合も、**対象は第1層のみ**に限定する。

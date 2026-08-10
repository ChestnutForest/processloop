---
schema_version: 1
id: FR-XXXX-000
category: XXXX
category_name: カテゴリの日本語名
title: 要求の要約を動詞形で書く
type: functional
priority: must
status: draft
domains:            # IPA の6技術領域。該当なしは [none]
  - behavior
  - screen
  - data_model
parent: null
children: []
unit: B-0
spec_count: 0
source:
  upstream_sha: bf5a4d63aff08410f79840001c816b37392e5001
  files:
    - src/net/sourceforge/processdash/xxx/Xxx.java
  analysis_refs:
    - ANA-B0
depends_on: []
test_refs: []
---

# FR-XXXX-000 要求の要約を動詞形で書く

## 要求

<!--
ソフトウェアの振る舞いを、目的語と動詞を交互に連ねて記述する。

  「〜を〜して、〜を〜して、… 〜を〜する。」

イベントに始まり、入力処理 → 変換処理 → 出力処理を経て止まるまでを範囲とする。
動詞は必ず動詞形で書く（「表示」ではなく「表示する」）。

★ 動詞を数えること。8個以上なら要求を分割する。
   分割の型: 時系列分割 / 構成分割 / 状態分割 / 共通分割
-->

## 理由

<!--
この要求が必要になった背景を書く。
「業務を効率化するため」のような一般論は理由にならない。
その要求に特有の理由を書く。

移植では次が理由になりやすい。
- 移植元がその挙動を持つ根拠（PSP の方法論上の必然性など）
- 既存データとの互換性
- この開発自体を PSP で計測するという方針（ADR-0001）
-->

## 説明

<!--
要求の補足。次を書くとよい。
- 移植元との差異と、その判断理由
- 移植しない部分と、その理由
- データの範囲（上限・下限・正常値と異常値の基準）

図を載せる場合は「描画される図 ＋ 折りたたんだソース」の2段構成にする。
4連バッククォートだけで囲むと GitHub がコード例として表示し、図が描画されない。
書き方は diagram-guide.md を参照。

    ```mermaid
    stateDiagram-v2
        [*] --> 状態A
    ```

    <details>
    <summary>ソースを見る</summary>

    （ここに4連バッククォートで囲んだ同じ内容）

    </details>
-->

## 仕様

<!--
要求に含まれる「動詞と目的語のペア」ごとに仕様グループを立てる。
仕様 ID は 10 刻み。グループが変わるところで百の位を繰り上げる。

仕様は次の3条件を満たす粒度にする。
- 要求から導出される
- 設計をイメージできる
- 検証をイメージできる

避ける表現:
- 「等」「etc」    → 確定できることは全て書く
- 否定表現         → else は何かを必ず考える
- ペースト作文     → 条件が複数なら表にする
-->

### <仕様グループ名>

- [ ] **FR-XXXX-000.10** 仕様を記述する。
- [ ] **FR-XXXX-000.20** 仕様を記述する。

### <別の仕様グループ名>

- [ ] **FR-XXXX-000.110** 仕様を記述する。

## 関連資料

- 解析: `../../analysis/xxx-report.md`
- 移植元: `src/net/sourceforge/processdash/xxx/Xxx.java` @`bf5a4d6`
- API: `../api/openapi.yaml`

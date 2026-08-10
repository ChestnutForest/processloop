# Processloop

Process Dashboard（GPLv3）のフォークを、Java/Swing から Next.js へ移植するプロジェクト。
英語・日本語の多言語対応を行う。

移植元: https://github.com/dtuma/processdash
上流ピン: `bf5a4d63aff08410f79840001c816b37392e5001`（Process Dashboard 2.7.6、2026-05-28）

---

## ライセンス

本プロジェクトは **GNU General Public License version 3 以降** で提供される。

- 全文は [LICENSE](LICENSE) を参照
- 帰属、GPLv3 セクション7の追加許諾、変更履歴、サービスマークの扱いは [NOTICE](NOTICE) を参照

移植元の著作権は Copyright (C) 1998-2025 Tuma Solutions, LLC に帰属する。

### サービスマークについて

PSP、TSP、Personal Software Process、Team Software Process はカーネギーメロン大学のサービスマークである。
本プロジェクトは同大学およびソフトウェア工学研究所とは提携していない。
これらの名称は方法論を指す記述的用法としてのみ使用し、製品名やブランドとしては使用しない。

---

## 現在の状態

**移植の実装フェーズ。計算式エンジンの第1層が完成している。**

| 項目 | 状態 |
|---|---|
| 移植着手前の調査 | 完了（構造調査 33.7%、主要な設計判断はすべて確定） |
| 開発環境 | 完了（Node 24 / pnpm ワークスペース / Vitest） |
| **A-1（プリプロセッサ）** | **完了**（TypeScript 315行、テスト22件） |
| M1（データ収集の最小構成） | 未着手（次の作業） |
| frontend | 未初期化（M1 に含む） |
| 開発プロセスの定義 | 議論中（[成果物提案](docs/deliverables-proposal.md) 参照） |
| 要求仕様の記法 | 確定（USDM ＋ IPA 6技術領域。[記法定義](docs/phase1/req/README.md)） |
| 実装順序 | 確定（データ収集先行。[ADR-0001](docs/adr/adr-0001-data-collection-first.md)） |
| PSP 計測データ | A-1 を遡及登録済み。以降は M1 完成後に記録（[ADR-0002](docs/adr/adr-0002-measurement-recording.md)） |

第1期スコープは「個人利用の PSP 機能 ＋ PROBE ＋ EV」で、実装見積りは **19,000〜21,000行**（18ユニットの積み上げ）。
現在1ユニットが完了している。

---

## リポジトリ構成

```
processloop/
├─ packages/core/        UI 非依存のドメインロジック（移植の主戦場）
│   └─ src/preprocessor/ A-1: プリプロセッサ（実装済み）
├─ frontend/             Next.js アプリケーション（未初期化）
├─ i18n/                 多言語メッセージ（en / ja）
├─ docs/                 設計・移植メモ
│   ├─ phase1/req/                要求仕様（USDM・1要求1ファイル）
│   │   ├─ README.md              記法と ID 体系の定義
│   │   ├─ _template.md           新規作成の雛形
│   │   ├─ _schema/               Front Matter の JSON Schema
│   │   ├─ fr-time-001.md         要求の実例
│   │   ├─ review-checklist.md    レビュー観点30項目
│   │   ├─ diagram-guide.md       図表の書き方（工程成果物ごと）
│   │   └─ ipa-integration-proposal.md  IPA ガイド統合の設計と経緯
│   ├─ references.md              根拠とした一次情報の URL 一覧
│   ├─ architecture-analysis.md   移植元のプログラム構造 解析報告
│   ├─ deliverables-proposal.md   フェーズ別 成果物提案（議論中）
│   ├─ dogfooding-roadmap.md      実装順序（M1〜M6）
│   ├─ adr/                       アーキテクチャ決定記録
│   │   ├─ adr-0001-data-collection-first.md
│   │   ├─ adr-0002-measurement-recording.md
│   │   └─ adr-0003-diagram-notation.md
│   ├─ psp-data/                  この開発自体の PSP 計測データ
│   │   ├─ size-log.csv           成果物規模（PROBE の入力）
│   │   ├─ defect-log.csv         欠陥（混入・発見・分類）
│   │   └─ time-log.csv           作業時間（M1 完成後に記録開始）
│   └─ history/                   開発経緯の記録
│       └─ prompt-history.md      全プロンプト・回答の時系列一覧
├─ reference/legacy-java/ 移植元 Java の参照資料（Git 追跡対象外）
│   └─ README.md          上流ピン・取り扱い原則・ライセンス注意
├─ LICENSE                GPLv3 全文
├─ NOTICE                 帰属・追加許諾・サービスマーク
└─ package.json           pnpm ワークスペースのルート
```

### `packages/core` を分離している理由

移植元の `data` パッケージは171ファイル中1ファイルしか Swing に依存しておらず（0.6%）、
ロジックと UI が既に分離されている。その構造を保つことで、テストが書きやすく、
将来チーム機能で負荷が増えたら独立サーバへ切り出す選択肢も残せる。

### `reference/legacy-java` について

移植元の Java ソースを置く場所。**`README.md` を除いて Git の追跡対象外**である。
上流全体は141MB あるため、リポジトリには含めず、コミットSHA の記録で再現性を確保している。

---

## 開発環境

| 項目 | バージョン |
|---|---|
| Node.js | 24（`.nvmrc` で指定） |
| pnpm | 10.15.0（`packageManager` で固定） |
| TypeScript | strict ＋ `noUncheckedIndexedAccess` |
| テスト | Vitest |
| JDK | 11 以上（ゴールデンファイル生成に使用） |

### セットアップ

```bash
pnpm install
pnpm typecheck
pnpm test
```

### 主なスクリプト

| コマンド | 内容 |
|---|---|
| `pnpm build` | 全ワークスペースのビルド |
| `pnpm test` | 全ワークスペースのテスト |
| `pnpm typecheck` | 型チェック |
| `pnpm lint` | 静的解析 |
| `pnpm dev` | frontend の開発サーバ（未初期化のため現時点では使用不可） |

---

## 移植の進め方

### 検証方法：ゴールデンファイル

移植元の `data` パッケージにはテストが1件も存在しない。
そこで**元の Java 実装を実際に動かし、その出力を正解データとする**方式を採用している。

```
packages/core/src/preprocessor/__fixtures__/
├─ test1.txt / test1.expected    関数マクロと条件分岐
├─ test2.txt / test2.expected    行継続を含むマクロ展開
└─ test3.txt / test3.expected    #undef による定義の取り消し
```

生成手順は [reference/legacy-java/README.md](reference/legacy-java/README.md) を参照。
`CppFilter` は6ファイルのみでコンパイルでき、ant によるフルビルドは不要である。

### 移植単位

第1期の移植対象を18ユニットに分けている（A群7・B群10・C群1）。

**A群：計算式エンジン**

| ID | 内容 | 移植元 | 状態 |
|---|---|---|---|
| A-1 | プリプロセッサ | `util/CppFilter.java` | ✅ 完了 |
| A-2 | 動的マクロ生成 | `process/TemplateAutoData.java` | 未着手 |
| A-3 | 値の型システム | `data` 直下 | 未着手 |
| A-4 | パーサ（Peggy） | `data/compiler/grammar.txt` | 未着手 |
| A-5 | 評価器 | `data/compiler` | 未着手 |
| A-6 | 組み込み関数 | `compiler/function` | 未着手 |
| A-7 | DataRepository | `data/repository` | 未着手 |

**B群：機能モジュール**（util、hier、process/templates、時間ログ、欠陥ログ、
PROBE、EV計算、EVレポート、永続化層、Templates変換の10ユニット）

**C群：画面**（階層・タイマー・欠陥ログ・PROBE・サマリの5画面で1ユニット）

計算式エンジンの構造は [docs/architecture-analysis.md](docs/architecture-analysis.md)、
ユニットの内訳と成果物の定義は
[docs/deliverables-proposal.md](docs/deliverables-proposal.md) を参照。

---

### 開発プロセス（議論中）

工程と成果物の対応、トレーサビリティマトリクスによる進捗管理の方式を検討している。
現時点の案は [docs/deliverables-proposal.md](docs/deliverables-proposal.md) にまとめており、
確定前のため未決事項を含む。

```
移植元の解析 → 要求定義 → アーキテクチャ設計 → プログラム設計 → 実装
             → 単体テスト → 結合テスト → 総合テスト → デプロイ
```

移植プロジェクトでは要求の源泉が移植元の挙動になるため、全工程の上流に解析が入る。

要求仕様は **USDM**（Universal Specification Describing Manner）で記述する。
要求・理由・説明・仕様グループ・仕様を階層構造で表し、要求には必ず理由を添える。
Excel を前提とする USDM の様式を、Markdown + YAML Front Matter に写している。
記法と ID 体系は [docs/phase1/req/README.md](docs/phase1/req/README.md) を参照。
図表は Mermaid に統一している（[ADR-0003](docs/adr/adr-0003-diagram-notation.md)）。

あわせて、IPA「機能要件の合意形成ガイド」（2010）が定める6技術領域を
網羅性の軸として USDM に取り込んでいる。USDM が要求から仕様への縦の構造を与え、
6技術領域が記述漏れを検出する横の軸として働く。
詳細は [ipa-integration-proposal.md](docs/phase1/req/ipa-integration-proposal.md) を参照。

### 実装順序

**データ収集先行**とする（2026-07-20 決定）。18ユニットを6マイルストーンで進める。

| M | 内容 | 規模 | 到達点 |
|---|---|---|---|
| **M1** | 永続化・階層・時間ログ・最小UI | 約2,650行 | **時間を記録できる** |
| M2 | 欠陥ログ | 約1,000行 | PSP の3大生データが揃う |
| M3 | 計算エンジン | 約8,700行 | 派生指標が自動計算される |
| M4 | PROBE | 約1,200行 | 蓄積データで見積もれる |
| M5 | EV | 約3,000行 | 計画対実績・完了予測 |
| M6 | 仕上げ・デプロイ | 約2,000行 | 第1期完了 |

計算エンジンを後回しにできるのは、**生データの記録がエンジンから独立している**ためである。
この順序により、M1 の時点からこの移植プロジェクト自体を PSP で計測できる。
PROBE は過去の「見積り規模 vs 実績規模」に回帰分析をかける手法であり、
履歴データがなければ検証できない。

決定の経緯は [docs/adr/adr-0001-data-collection-first.md](docs/adr/adr-0001-data-collection-first.md)、
詳細は [docs/dogfooding-roadmap.md](docs/dogfooding-roadmap.md) を参照。

---

## ロードマップ

| 期 | 内容 | 実装規模 |
|---|---|---|
| **第1期** | 個人の PSP 機能（計測・改善）＋ PROBE ＋ EV | 19,000〜21,000行 |
| 第1.5期 | 実用性の底上げ（データ移行、確率的予測など） | 2,000〜3,000行 |
| 第2期 | 汎用チームプロセス機能 | 8,000〜12,000行 |
| 第3期 | 高度なチーム機能 | 5,000行〜 |

第2期を「TSP」と呼ばないのは、上流の GPLv3 ソースに TSP のプロセス定義が存在せず、
汎用のカスタムプロセス生成機構のみが提供されているためである。詳細は解析報告を参照。

---

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/phase1/req/README.md](docs/phase1/req/README.md) | 要求仕様の記法（USDM）。ID 体系、Front Matter の項目、要求と仕様の書き方、避けるべき表現 |
| [docs/phase1/req/ipa-integration-proposal.md](docs/phase1/req/ipa-integration-proposal.md) | IPA「機能要件の合意形成ガイド」の6技術領域を USDM に統合した設計と、決定の経緯 |
| [docs/phase1/req/review-checklist.md](docs/phase1/req/review-checklist.md) | 要求仕様のレビュー観点30項目。合意成熟度の移行時に使う |
| [docs/phase1/req/diagram-guide.md](docs/phase1/req/diagram-guide.md) | 図表の書き方。工程成果物ごとに Mermaid と Markdown 表を使い分ける |
| [docs/references.md](docs/references.md) | 根拠とした一次情報。USDM の小冊子、IPA 機能要件の合意形成ガイド全7編、発注者ビューガイドラインの系譜、使用条件 |
| [docs/architecture-analysis.md](docs/architecture-analysis.md) | 移植元のプログラム構造の解析。計算式エンジンの5層構造、永続化の4系統、ライセンス構造、調査カバレッジ |
| [docs/deliverables-proposal.md](docs/deliverables-proposal.md) | **議論中。** フェーズごとに作成するドキュメント・コード・リソースの提案。18ユニットの定義、工程ゲート、トレーサビリティマトリクスの構造 |
| [docs/dogfooding-roadmap.md](docs/dogfooding-roadmap.md) | 実装順序（確定）。M1〜M6 の内容、手動記録の様式、開発工程と PSP フェーズの対応 |
| [docs/adr/](docs/adr/) | アーキテクチャ決定記録。背景・決定・検討した代替案・影響を残す |
| [docs/psp-data/](docs/psp-data/) | この開発自体の PSP 計測データ。規模・欠陥・作業時間。完成後に Processloop へ投入する |
| [docs/history/prompt-history.md](docs/history/prompt-history.md) | 開発経緯の時系列記録 |
| [reference/legacy-java/README.md](reference/legacy-java/README.md) | 移植元の取り扱い、上流ピン、ゴールデンファイル生成手順 |
| [NOTICE](NOTICE) | 帰属、追加許諾、変更履歴、サービスマーク |

---

## 貢献について

現時点では個人プロジェクトとして進めている。
GPLv3 の条件のもと、フォークや改変は自由に行える。

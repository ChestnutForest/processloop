# Processloop — AI 開発エージェント向けの指示

Process Dashboard（GPLv3、Java/Swing）を Next.js へ移植するプロジェクト。
本書はプロジェクト固有の規約をまとめる。**推測せず、ここに書かれた方針に従うこと。**

---

## 1. 最優先の3点

### 移植元の挙動を勝手に変えない

要求の源泉は移植元の実装である。挙動を変える場合、**必ず理由を記録する**。

移植元にない制約を追加しない。既存データの移行時（第1.5期）に
読み込めないデータが生じる恐れがある。

### 第三者ライセンスのコードを移植しない

移植元には GPLv3 以外のファイルが混在する。**取り込む前にヘッダを確認する。**

| ファイル | ライセンス | 対応 |
|---|---|---|
| `util/StringUtils.java` | LGPL 2.1 | 移植せず標準機能で代替 |
| `util/FastDateFormat.java` | Apache 2.0 | date-fns で代替 |
| `util/FileProperties.java` | 第三者著作物 | 確認が要る |
| `util/ThreadMonitor.java` | Sun Microsystems | 確認が要る |

⚠️ **ライセンス名だけを検索すると見落とす。** 著作権者が Tuma Solutions 以外の
ファイルも確認する。実際に2件を後から発見した経緯がある。

### 文字コードは BOM なし UTF-8、改行は LF

ファイル生成時に BOM を付けない。PowerShell を使う場合、
`>` は UTF-16LE、`Set-Content -Encoding UTF8` は BOM 付きになるため使わない。

```powershell
[System.IO.File]::WriteAllLines("path", $lines)
```

⚠️ 過去にゴールデンファイルを壊した事例がある。

---

## 2. 環境

| 項目 | 値 |
|---|---|
| Node.js | 24（`.nvmrc`） |
| パッケージマネージャ | pnpm 10.15.0（ワークスペース） |
| TypeScript | strict ＋ `noUncheckedIndexedAccess` ＋ `exactOptionalPropertyTypes` |
| テスト | Vitest |
| シェル | Windows PowerShell 5.1 |

### 依存の追加

```powershell
pnpm add -D -w <パッケージ>     # ルート
pnpm --filter @processloop/core add <パッケージ>
```

⚠️ **AGPL のパッケージを採用しない。** GPLv3 はネットワーク越しの利用だけでは
ソース提供義務が発動しないが、AGPL を取り込むとこの前提が崩れる。

### 検証

```powershell
pnpm typecheck          # 型検査
pnpm test               # Vitest
pnpm validate:mermaid   # Mermaid の構文
```

**作業の完了前に typecheck と test を通す。**

---

## 3. リポジトリの構成

```
packages/core/          UI 非依存のドメイン層
  src/preprocessor/     A-1 プリプロセッサ（実装済み）
frontend/               Next.js（未初期化）
i18n/messages/          en.json / ja.json
docs/
  adr/                  決定記録
  phase1/
    arc-architecture.md アーキテクチャ仕様書
    req/                要求仕様（USDM）
    units/              移植仕様書
  psp-data/             この開発自体の PSP 計測
reference/legacy-java/  移植元の参照資料（Git 追跡外）
scripts/                検証スクリプト
```

### `packages/core` は frontend に依存しない

React や Next.js の import が `packages/core` に現れたら設計違反である。

---

## 4. 作業の順序

実装の前に設計文書を読む。**推測で書かない。**

```
要求仕様（docs/phase1/req/）
  → アーキテクチャ仕様書（docs/phase1/arc-architecture.md）
  → 移植仕様書（docs/phase1/units/prt-*.md）
  → 実装
```

移植仕様書には、移植元の解析・型設計・関数構成・テストケースが書かれている。
**着手前に必ず読む。**

### 実装後に記録すること

移植仕様書の第5節（実績記録）に実績行数を記入する。
⚠️ **テストコードは行数に含めない。**

この開発自体を PSP で計測する方針（ADR-0001）による。
実績は `docs/psp-data/size-log.csv` にも追加する。

---

## 5. 確定済みの設計判断

変更する場合は理由を示すこと。経緯は ADR にある。

| 判断 | 根拠 |
|---|---|
| 実装順序はデータ収集先行 | ADR-0001。PROBE が履歴データを要するため |
| 手動での PSP 記録はしない | ADR-0002。devlog から遡及抽出する |
| 作図は Mermaid に統一 | ADR-0003。発注者が存在せず Git 差分の価値が高い |
| 計算結果を保存しない | 実測値のみ保存し、派生指標は都度計算する |
| Prisma の型を外へ出さない | ドメイン型に変換する。M3 での差し替えに備える |
| 計算式エンジンは M3 | M1・M2 は TypeScript で直接集計する |

---

## 6. コードの書き方

### 移植したファイルのヘッダ

```typescript
/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * Ported from src/net/sourceforge/processdash/util/CppFilter.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001 (2.7.6, 2026-05-28).
 *
 * GNU General Public License version 3 or later. See LICENSE.
 */
```

**移植元のファイル名と上流SHA を必ず書く。** 代替した部分があれば理由も添える。

### コメント

日本語で書く。移植元の制約を引き継いだ箇所は、**その旨を明記する**。

```typescript
// 引数パターンは移植元と同じく [^(,)] とする。
// つまり引数に括弧やカンマを含められない（上流の制約を引き継ぐ）。
```

### 型

`any` を使わない。`unknown` から絞り込む。

配列アクセスは `noUncheckedIndexedAccess` により `undefined` を含むため、
`?? ''` や `?.` で明示的に扱う。

---

## 7. テスト

### ゴールデンファイル

移植元を実行して得た出力を正解データとする。
`packages/core/src/<unit>/__fixtures__/` に置く。

⚠️ **すべてのユニットで作れるわけではない。** 移植元が単独実行できる場合に限る。
永続化層のように単独実行できない層では、通常の単体テストで検証する。

### テストの粒度

| 種別 | 対象 |
|---|---|
| 単体 | 1つのユニット内の関数 |
| 結合 | 層をまたいだ呼び出し |
| 総合 | 利用者の操作（Playwright） |

---

## 8. Git

### コミットメッセージ

Conventional Commits。**件名と本文を分ける。**

```
docs(req): add the i18n and licence requirements

The i18n one exists because the upstream ships 1347 translated Japanese
keys and dropping them would be a regression.
```

| 部分 | 上限 |
|---|---|
| 件名 | 50字程度。命令形 |
| 本文 | **2〜3文。50語を超えない** |
| 1文 | 20語程度 |

**英語で書く。** 差分やコミットした文書に書いてあることを繰り返さない。
答えるべきは「なぜ今これを書いたのか」であって「何を書いたのか」ではない。

### 型

`feat` / `fix` / `docs` / `refactor` / `test` / `chore`

### README の同期

`README.md` 以外の md を追加・変更したら、**同じコミットで README も更新する。**

ルート README には3箇所ある。

- 現在の状態
- リポジトリ構成
- ドキュメント一覧

⚠️ 1箇所だけ直して他を忘れる誤りが起きやすい。

---

## 9. 用語

`docs/phase1/req/overview.md` の用語集に従う。**表記を揺らさない。**

| 用語 | 意味 |
|---|---|
| 正味時間 | 中断を除いた実際の作業時間 |
| 混入フェーズ / 除去フェーズ | 欠陥が作り込まれた工程 / 発見された工程 |
| 評価フェーズ / 失敗フェーズ | レビュー等 / コンパイルやテスト |
| ユニット | 移植の作業単位（A群7・B群10・C群1） |
| M1〜M6 | 実装のマイルストーン |

⚠️ **PSP と TSP はカーネギーメロン大学のサービスマークである。**
方法論を指す記述的用法にとどめ、製品名やブランドとして使わない。

---

## 10. 迷ったとき

| 状況 | 対応 |
|---|---|
| 移植元の仕様が不明 | 推測せず、確認事項として記録して先に進む |
| 設計文書に書かれていない | 質問する。勝手に決めない |
| 移植元と違う実装にしたい | 理由を移植仕様書に記録してから行う |
| ライセンスが判断できない | 取り込まず、代替を探す |

**推測で埋めるより、不明と記録する方が価値がある。**
後から確認できるが、誤った推測は気づかれずに残る。

# docs/psp-data — この開発自体の PSP 計測データ

Processloop の移植作業を PSP（Personal Software Process、個人ソフトウェアプロセス）で
計測した記録である。完成後、Processloop 自身に投入してドッグフーディングの素材とする。

方針の背景は [ADR-0001](../adr/adr-0001-data-collection-first.md) と
[ADR-0002](../adr/adr-0002-measurement-recording.md) を参照。

---

## 記録の方針

**手動での逐次記録は行わない。**

| 時期 | 記録方法 |
|---|---|
| A-1（完了済み） | devlog から遡及抽出して登録済み |
| M1 完成まで | **記録しない。** devlog の作成を継続する |
| M1 完成後 | devlog から遡及抽出して一括投入 → 以降は Processloop の UI で記録 |

devlog（`docs/history/` および NotebookLM）は「つまずき→解決の記録」「調査・実測の記録」を
含んでおり、欠陥と規模のデータを後から抽出できる。

⚠️ **作業時間は devlog に記録されていない**ため、M1 完成までの期間は時間データが欠損する。
PROBE の主入力は規模データであるため、この欠損は PROBE の検証を妨げない。

---

## ファイルの様式

CSV の列は Prisma スキーマに対応させており、そのまま一括投入できる。

### `size-log.csv` — 成果物規模

```csv
unit,estimated_loc,actual_loc,est_date,complete_date,note
```

| 列 | 内容 |
|---|---|
| `unit` | 移植ユニット（A-1 〜 C） |
| `estimated_loc` | 見積り行数 |
| `actual_loc` | 実績行数 |
| `est_date` | 見積りを行った日 |
| `complete_date` | 完了日 |

**PROBE の入力**になる。見積りと実績の組が蓄積されると、線形回帰で見積り精度が上がる。

### `defect-log.csv` — 欠陥

```csv
unit,found_phase,injected_phase,type,fix_min,description
```

| 列 | 内容 |
|---|---|
| `injected_phase` | 欠陥が**混入した**工程 |
| `found_phase` | 欠陥が**発見された**工程 |
| `type` | PSP 標準の欠陥タイプ（下記10種） |
| `fix_min` | 修正に要した時間（分）。**記録がなければ空欄** |

混入と発見の対応から、レビューの有効性や工程ごとの品質が分析できる。

**PSP 標準の欠陥タイプ**

| コード | 内容 |
|---|---|
| 10 Documentation | 文書の誤り |
| 20 Syntax | 構文・綴り |
| 30 Build/Package | ビルド・パッケージ |
| 40 Assignment | 宣言・スコープ |
| 50 Interface | 手続き・API の使い方 |
| 60 Checking | エラー処理・検証 |
| 70 Data | データ構造 |
| 80 Function | ロジック・アルゴリズム |
| 90 System | 構成・タイミング |
| 100 Environment | 開発環境・ツール |

### `time-log.csv` — 作業時間

```csv
unit,phase,date,start,end,delta_min,interrupt_min,comment
```

| 列 | 内容 |
|---|---|
| `delta_min` | **中断を除いた正味の作業時間（分）** |
| `interrupt_min` | 中断していた時間（分） |

移植元の `timelog.xml` が `delta` と `interrupt` を別属性として持つ設計を踏襲している。
PSP は中断を除いた正味時間を測る方法論であるため、この分離が本質的である。

**現時点ではヘッダのみ**。M1 完成後に Processloop の UI から記録される。

---

## 開発工程と PSP フェーズの対応

`phase` 列には次の値を使う。開発工程が PSP フェーズにほぼそのまま対応する。

| Processloop の工程 | PSP フェーズ | 種別 |
|---|---|---|
| 解析 | Planning | plan |
| 設計 | Design | dld |
| 実装 | Code | code |
| 型チェック（`pnpm typecheck`） | Compile | comp（failure） |
| 単体テスト | Test | ut（failure） |
| 事後分析 | Postmortem | pm |

`pnpm typecheck` が PSP の Compile に対応するため、型エラーは
「コンパイル時に発見された欠陥」として記録できる。

---

## 記録済みのデータ

### A-1 プリプロセッサ

| 項目 | 値 |
|---|---|
| 見積り | 250〜350行（中央値300を採用） |
| 実績 | **315行** |
| 欠陥 | 4件 |
| 作業時間 | ⚠️ **記録なし** |

見積りが範囲の中央付近に収まっている。PROBE の1件目のデータとなる。

**欠陥4件の内訳**

| 混入 | 発見 | タイプ |
|---|---|---|
| 実装 | 単体テスト | 80 Function（BOM でゴールデンが壊れた） |
| 実装 | 実装 | 100 Environment（`@types/node` の不一致） |
| 実装 | 実装 | 20 Syntax（`package.json` の構文エラー） |
| 設計 | 実装 | 50 Interface（相対パスの階層数の誤り） |

修正時間は devlog に記録がないため空欄としている。
**推測値を入れると PSP の分析が歪むため、捏造しない。**

---

## ファイルの取り扱い

**BOM なし UTF-8、改行 LF** で保存する。

PowerShell 5.1 で編集する場合、`Set-Content -Encoding UTF8` は BOM を付け、
リダイレクト `>` は UTF-16LE になるため使用しない。

```powershell
# 追記する場合
[System.IO.File]::AppendAllText("time-log.csv", "$line`n", [System.Text.UTF8Encoding]::new($false))
```

VS Code で直接編集するのが最も安全である。

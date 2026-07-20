# reference/legacy-java — 移植元の参照資料

このフォルダには、移植元である Process Dashboard の Java ソースを配置します。

**このフォルダの中身は、`README.md` を除いて Git の追跡対象外です**（リポジトリ直下の `.gitignore` を参照）。
各自がローカルに配置してください。

---

## 上流のピン留め（移植の基準点）

移植の判断は、次の一点に固定されたソースにもとづいています。

| 項目 | 値 |
|---|---|
| リポジトリ | https://github.com/dtuma/processdash |
| **コミット** | **`bf5a4d63aff08410f79840001c816b37392e5001`** |
| バージョン | Process Dashboard 2.7.6 |
| 日付 | 2026-05-28 |
| ライセンス | GNU General Public License version 3 以降 |
| 著作権 | Copyright (C) 1998-2025 Tuma Solutions, LLC |

コミットSHA は改変できないため、**この記録だけで同じ状態を完全に復元できます**。

### 復元手順

```powershell
cd reference\legacy-java
git clone https://github.com/dtuma/processdash.git
cd processdash
git checkout bf5a4d63aff08410f79840001c816b37392e5001
```

容量は約141MB です。全体が必要ない場合は、下記のリファレンス zip（段階別に切り出したもの）を使ってください。

---

## 段階別リファレンス

実装ステージごとに、必要な Java ソースだけを切り出した zip を配置します。

| フォルダ | 対応ステージ | 状態 |
|---|---|---|
| `processloop-ref-stage1/` | 0-a プリプロセッサ／0-b 動的マクロ生成／2 パーサ文法 | 配置済み |
| `processloop-ref-stage2/` | 1 値の型／3 評価器／4 組み込み関数 | 未配置 |
| `processloop-ref-stage3/` | 5 DataRepository／util | 未配置 |
| `processloop-ref-stage4/` | hier／process／log | 未配置 |
| `processloop-ref-stage5/` | tool/probe／ev／レポート | 未配置 |

配置済みの各フォルダには `README.md` があり、そのステージの仕様と実装上の注意をまとめています。

**移植を始める前に、対象ステージの README を必ず読んでください。**
たとえば `processloop-ref-stage1/README.md` には、次のような間違えやすい点を記載しています。

- `#include` はプリプロセッサ層では扱わない（式の文法側で処理される）
- ディレクティブ行は削除されず、空行として残る
- 行継続のバックスラッシュを含むマクロは、展開結果が1行に連結される
- `yield` は `failure` が存在する場合のみ定義される

---

## 取り扱いの原則

### 1. 参照専用。改変しないこと

ここのファイルは**移植の基準**です。書き換えると、比較の根拠が失われます。
移植先のコードは `packages/core/src/` に書いてください。

### 2. Git にコミットしないこと

`.gitignore` で除外済みですが、`git add -f` などで強制追加しないでください。
理由は容量（全体で141MB）と、リポジトリの役割を明確に保つためです。

### 3. ゴールデンファイルは `packages/core` 側にコピーを置く

Java 版が生成した正解データは、テストから参照するため次の場所にもコピーします。

```
packages/core/src/preprocessor/__fixtures__/
```

**`reference/` 側が原本、`__fixtures__` 側がテスト用の作業コピー**という役割分担です。
`__fixtures__` はテストフィクスチャなので、通常どおり Git で追跡します。

---

## ゴールデンファイルの生成方法

移植の検証に使う正解データは、Java 版を実行して作ります。**ant によるフルビルドは不要**です。

### 前提
- JDK（Java 11 で動作確認済み。1.7 以上なら動くはず）

### 手順

#### 1. コンパイル（初回のみ）

```powershell
cd processloop-ref-stage1
New-Item -ItemType Directory -Path work\src\net\sourceforge\processdash\util, work\out -Force
Copy-Item java\util\*.java work\src\net\sourceforge\processdash\util\
cd work
javac -d out src\net\sourceforge\processdash\util\*.java
```

`work/` は一時フォルダです。`.gitignore` の対象なので、不要になったら削除して構いません。

> **補足**: コンパイル時に「未チェックまたは安全ではない操作」という注意が出ますが、
> 2003年頃のコードがジェネリクスを使っていないためで、エラーではありません。
> 日本語が文字化けする場合は、`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` を先に実行してください。

#### 2. ゴールデンファイルの生成

**⚠️ リダイレクト（`>`）を使わないでください。**
Windows PowerShell 5.1 の `>` は `Out-File` の別名で、**既定が UTF-16LE** です。
そのまま書き出すと、Vitest が UTF-8 として読んだときに BOM とヌルバイトが混ざり、
原因の分かりにくい不一致を起こします。

.NET のメソッドを直接呼ぶのが確実です（**BOM なし UTF-8、改行は LF** で書き出されます）。

```powershell
# 入力ファイル名と出力ファイル名は実際のものに置き換えてください
$out = java -cp out net.sourceforge.processdash.util.CppFilter ..\golden\test3.txt
[System.IO.File]::WriteAllLines("$PWD\..\golden\test3.expected", $out)
```

> PowerShell 6 以降なら `| Out-File -Encoding utf8NoBOM 出力先` でも構いません。
> ただし 5.1 には `utf8NoBOM` が存在しないため、上記の方法を推奨します。

#### 3. テスト側へ同期する（★忘れやすい）

**ゴールデンを追加・再生成したら、必ず `__fixtures__` 側にもコピーしてください。**
両者がずれると、テストが古い期待値を参照し続け、実装が正しいのに落ちる（またはその逆）状態になります。

```powershell
Copy-Item ..\golden\* ..\..\..\packages\core\src\preprocessor\__fixtures__\ -Force
```

同期できたか確認するには、次のコマンドで差分を見ます。

```powershell
Compare-Object `
  (Get-ChildItem ..\golden -File | Select-Object -ExpandProperty Name) `
  (Get-ChildItem ..\..\..\packages\core\src\preprocessor\__fixtures__ -File | Select-Object -ExpandProperty Name)
```

何も出力されなければ、ファイル構成が一致しています。

---

## ライセンス上の注意

### 全体
このフォルダの Java ソースは **GPLv3 以降**で提供されています。移植先のコードも GPLv3 で提供する必要があります。
各ファイルのライセンスヘッダと著作権表示は**保持してください**。

### GPLv3 以外が混在するファイル

第1期スコープ639ファイルを走査した結果、次の4件が GPLv3 以外でした。

| ファイル | ライセンス | 第1期での扱い |
|---|---|---|
| **util/StringUtils.java** | **LGPL 2.1 以降**（Copyright (C) 2000 Justin P. McCarthy） | ⚠️ **移植せず JavaScript 標準機能で代替** |
| util/FastDateFormat.java | Apache License 2.0（Apache Software Foundation） | 移植せず date-fns で代替 |
| util/Diff.java | LGPL | 第1期では未使用 |
| util/ClientHttpRequest.java | パブリックドメイン | 第1期では未使用 |

**⚠️ `StringUtils.java` は `CppFilter` の依存に含まれます**（コンパイルには必要）。
ただし**移植はしないでください**。`CppFilter` が使うのは `findAndReplace` 程度であり、
`String.prototype.replaceAll` で代替できます。

### 追加で判明した第三者著作物

ライセンス名を書かず著作権者名のみ記載しているファイルが2件あります。

| ファイル | 著作権者 |
|---|---|
| util/FileProperties.java | Justin P. McCarthy |
| util/ThreadMonitor.java | Sun Microsystems, Inc.（2004） |

**移植対象を広げる際は、各ファイルのヘッダを目視で確認してください。**
ライセンス名だけを検索すると、これらを見逃します。

### GPLv3 セクション7の追加許諾

上流には通常の GPLv3 にない追加許諾（Tuma Solutions 製モジュールとの結合を許す条項）が付いています。
Java 1,978ファイル中1,922ファイル（97.2%）のヘッダに通知があります。

原文はリポジトリ直下の `NOTICE` に転記済みです。

⚠️ 本記載は法的助言ではありません。判断に迷う場合は一次ライセンス文の確認と、
必要に応じて専門家への相談をおすすめします。

---

## サービスマークについて

PSP、TSP、Personal Software Process、Team Software Process はカーネギーメロン大学のサービスマークです。
本プロジェクトは同大学およびソフトウェア工学研究所とは提携していません。

これらの名称は、移植元が支援していた方法論を指す**記述的用法**としてのみ使用し、
Processloop の製品名やブランドとしては使用しません。

なお、上流の GPLv3 ソースにはカーネギーメロン大学の特別許諾素材（PSP/TSP のスクリプトと記入フォーム）は
**含まれていません**。それらは別配布物です。

---
schema_version: 1
id: CON-LICENSE-001
category: LICENSE
category_name: ライセンス順守
title: GPLv3 を維持して移植元の帰属を保持する
type: constraint
priority: must
status: reviewed
domains:
  - none
parent: null
children: []
unit: C
spec_count: 12
source:
  upstream_sha: bf5a4d63aff08410f79840001c816b37392e5001
  files:
    - README-license.txt
    - src/net/sourceforge/processdash/util/StringUtils.java
  analysis_refs:
    - ANA-LICENSE
depends_on: []
test_refs: []
---

# CON-LICENSE-001 GPLv3 を維持して移植元の帰属を保持する

## 要求

移植元のソースを取り込むときは、そのファイルのライセンスを確認し、
GPLv3 と両立しないものを除外して、取り込んだファイルの著作権表示を移植先に引き継ぎ、
移植先の全体を GPLv3 以降で提供する。

<!-- 動詞: 確認する / 除外する / 引き継ぐ / 提供する = 4個 -->

## 理由

移植元 Process Dashboard は GNU General Public License version 3 以降で提供されている。
GPLv3 は派生物にも同じライセンスでの提供を求めるため、**移植先が GPLv3 を選ばない選択肢はない**。

加えて、移植元には GPLv3 以外のライセンスを持つファイルが混在している。
第1期スコープ639ファイルを走査した結果、4件が該当した。
確認せずに取り込むと、気づかないうちにライセンス違反を生じる。

とりわけ `util/StringUtils.java` は LGPL 2.1 でありながら参照73回と最多であり、
プリプロセッサのコンパイルにも必要になる。**見落としやすい位置にある**。

## 説明

### `domains` が `none` である理由

本要求は IPA が定める6技術領域（システム振舞い、画面、データモデル、
外部インタフェース、バッチ、帳票）のいずれにも該当しない。
機能ではなく、開発全体にかかる制約だからである。

そのため `domains` に `none` を指定する。**該当なしと判断したことの明示**であり、
宣言し忘れとは区別される。

### 移植元に混在する非 GPLv3 のファイル

第1期スコープを走査して判明したもの。

| ファイル | 行数 | ライセンス | 扱い |
|---|---|---|---|
| **util/StringUtils.java** | 637 | **LGPL 2.1 以降**（Justin P. McCarthy） | ⚠️ 移植せず標準機能で代替 |
| util/FastDateFormat.java | 1,748 | Apache License 2.0 | date-fns で代替 |
| util/Diff.java | 828 | LGPL | 第1期で未使用 |
| util/ClientHttpRequest.java | 564 | パブリックドメイン | 第1期で未使用 |

### ⚠️ 走査方法の注意

**ライセンス名だけを検索すると見落とす。** 実際に2件を後から発見した。

| ファイル | 著作権者 |
|---|---|
| util/FileProperties.java | Justin P. McCarthy |
| util/ThreadMonitor.java | Sun Microsystems, Inc.（2004） |

いずれもライセンス名を書かず著作権者名のみを記載していた。
**著作権者が Tuma Solutions 以外のファイルも確認する必要がある。**

### GPLv3 セクション7の追加許諾

移植元には通常の GPLv3 にない追加許諾が付いている。
Java 1,978ファイル中1,922ファイル（97.2%）のヘッダに通知がある。

原文はリポジトリ直下の `NOTICE` に転記済みである。

⚠️ **派生物でこの追加許諾がどこまで有効かは法的判断を要する。**
現時点の対応は「上流が与えた権利を下流から奪わない」という安全側の措置にとどまる。

### サービスマーク

PSP、TSP、Personal Software Process、Team Software Process は
カーネギーメロン大学のサービスマークである。

| 用法 | 可否 |
|---|---|
| 方法論を指す記述的用法 | 使用する |
| 製品名・ブランド | **使用しない**（製品名は Processloop） |

⚠️ 内部識別子（`templateId: "PSP2"` など）での使用が許容されるかは法的判断を要する。
移植元の `state` ファイルと `#define TEMPLATE_ID` に波及するため、変更すると影響が大きい。

### npm 依存のライセンス

現在52パッケージすべてが GPLv3 と両立する。

| ライセンス | 数 |
|---|---|
| MIT | 47 |
| Apache-2.0 | 2 |
| ISC | 2 |
| BSD-3-Clause | 1 |
| **AGPL** | **0** |

**AGPL がゼロであることが重要である。** GPLv3 は AGPL と異なり、
ネットワーク越しの利用だけではソース提供義務が発動しない。
AGPL のパッケージを1つでも取り込むと、この前提が崩れる。

⚠️ Prisma は Apache-2.0 である。GPLv3 とは両立するが GPLv2 とは両立しない。
上流の指定が「GPLv3 or any later version」であるため問題は生じない。

## 仕様

### <ライセンスの確認>

- [ ] **CON-LICENSE-001.10** 移植元のファイルを取り込む前に、そのファイルの先頭30行を目視で確認する。
- [ ] **CON-LICENSE-001.20** ライセンス名だけでなく、著作権者が Tuma Solutions 以外であるかも確認する。
- [ ] **CON-LICENSE-001.30** npm パッケージを追加する前に、そのライセンスを確認する。
- [ ] **CON-LICENSE-001.40** 依存を追加した後、全依存のライセンス一覧を取得して AGPL が含まれないことを確認する。

### <両立しないものの除外>

- [ ] **CON-LICENSE-001.110** LGPL のファイルは移植せず、標準機能または GPLv3 と両立するライブラリで代替する。
- [ ] **CON-LICENSE-001.120** Apache License 2.0 のファイルは移植せず、既存のライブラリで代替する。
- [ ] **CON-LICENSE-001.130** AGPL のパッケージは採用しない。

### <著作権表示の引き継ぎ>

- [ ] **CON-LICENSE-001.210** 移植したファイルの冒頭に、移植元の著作権表示と移植元ファイル名を記載する。
- [ ] **CON-LICENSE-001.220** 移植元の上流コミット SHA を併せて記載する。
- [ ] **CON-LICENSE-001.230** 代替した部分がある場合、代替した理由を記載する。

### <GPLv3 での提供>

- [ ] **CON-LICENSE-001.310** リポジトリ直下に GPLv3 の全文を配置する。
- [ ] **CON-LICENSE-001.320** リポジトリ直下の `NOTICE` に、帰属・追加許諾の原文・変更履歴・サービスマークの扱いを記載する。

## 関連資料

- 概要: [overview.md](overview.md)
- ライセンス構造の解析: [architecture-analysis.md](../../architecture-analysis.md)

```
https://github.com/ChestnutForest/processloop/blob/main/docs/architecture-analysis.md
```

- 移植元の取り扱い: [reference/legacy-java/README.md](../../../reference/legacy-java/README.md)

```
https://github.com/ChestnutForest/processloop/blob/main/reference/legacy-java/README.md
```

- 帰属と追加許諾: `NOTICE`

```
https://github.com/ChestnutForest/processloop/blob/main/NOTICE
```

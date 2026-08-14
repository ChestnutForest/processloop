# テストガイド

Processloopのテストを実行・追加・調査するときの共通ガイドである。
テスト戦略の正本は[アーキテクチャ仕様書](phase1/arc-architecture.md)第8章、
機能ごとのテスト条件と期待結果は各移植仕様書（`docs/phase1/units/prt-*.md`）とする。
本書は、そこで採用したVitestの実行方法と、テストが保証する概念を説明する。

## 1. Vitest

### 1.1 役割

Vitestは、TypeScript／JavaScript向けのテストフレームワークである。
Processloopでは、UI非依存の`packages/core`にある単体テストと結合テストに使う。
総合テスト（E2E）はPlaywrightの担当であり、Vitestの対象にはしない。

主に次のAPIを使う。

| API | 役割 |
|---|---|
| `describe` | 関連するテストケースをグループ化する |
| `it` | 1件のテストケースを定義する |
| `expect` | 実際の値や例外を期待値と比較する |
| `beforeEach` | 各テストケースの前に初期状態を作る |
| `afterAll` | そのファイルの全テスト終了後に接続などを解放する |

VitestはTypeScriptをテスト実行用に変換するが、完全な型検査の代わりにはならない。
テストとは別に`tsc --noEmit`による`typecheck`を実行する。

### 1.2 コマンドの実行経路

リポジトリルートの`package.json`と`packages/core/package.json`により、次の順で実行される。

```text
corepack pnpm test
  -> ルート: pnpm -r test
  -> @processloop/core: vitest run
```

`corepack`はルートの`packageManager`で固定したpnpmを選ぶ。
`pnpm -r`は、テストスクリプトを持つワークスペースパッケージを再帰的に実行する。
`vitest run`は検出したテストを1回実行し、成功または失敗の終了コードを返して終了する。

用途別のコマンドは次のとおりである。

```powershell
# 全ワークスペースのテストを1回実行する
corepack pnpm test

# packages/coreを監視し、変更に関係するテストを再実行する
corepack pnpm --filter @processloop/core test:watch

# 特定のテストファイルだけを実行する
corepack pnpm --filter @processloop/core exec vitest run src/persistence/time-session.test.ts

# 名前に一致するテストだけを実行する
corepack pnpm --filter @processloop/core exec vitest run -t "古いversion"

# 各テストケースを詳しく表示する
corepack pnpm --filter @processloop/core exec vitest run --reporter=verbose
```

### 1.3 テストファイルの構造

Vitestは`*.test.ts`を検出する。典型的なテストは次の形になる。

```typescript
import { describe, expect, it } from 'vitest';

describe('対象となる機能', () => {
  it('条件と期待結果', () => {
    const actual = 1 + 1;
    expect(actual).toBe(2);
  });
});
```

テスト名には、可能な範囲で「どの条件で何を期待するか」を書く。
仕様上のIDがある場合は、`IT-B4-04`のように名前へ含め、移植仕様書から追跡できるようにする。

### 1.4 `packages/core`の実行環境

`packages/core/vitest.config.ts`は`environment`を指定していないため、標準のNode環境で実行する。
`packages/core`はUI非依存なので、DOMやReactを用意する必要はない。

永続化テストは1つのSQLiteファイル`packages/core/prisma/test.db`を共有する。
実行全体と各ケースの初期化範囲を分けている。

| タイミング | 処理 | 実装場所 |
|---|---|---|
| Vitest実行全体で1回 | 既存のテストDBを削除し、`prisma db push`でスキーマを投入する | `vitest.global-setup.ts`、`test-support.ts` |
| 各テストケースの前 | 全テーブルの行を削除し、ケース間の状態を分離する | 各永続化テストの`beforeEach` |
| 各テストファイルの後 | Prismaの接続を閉じる | 各永続化テストの`afterAll` |

`prisma db push`はCLI起動に時間がかかるため、ケースごとには実行しない。
共有DBに対するテスト同士の干渉を防ぐため、`fileParallelism: false`でテストファイルを逐次実行する。
テストケース自体も、明示的に`concurrent`を指定しない限り順番に実行する。

### 1.5 実行結果の読み方

B-4第2段階完了時（2026-08-14）の代表的な出力は次のように読む。

```text
RUN  v3.x.x C:/Users/.../processloop/packages/core
✓ src/persistence/time-session.test.ts (8 tests) 393ms

Test Files  12 passed (12)
Tests       99 passed (99)
```

- `RUN`は実際に解決されたVitestのバージョンと実行ディレクトリを示す。
- ファイル行の`8 tests`は、そのファイルで収集されたテストケース数である。
- `12 passed (12)`は、検出した12ファイルがすべて成功したことを示す。
- `99 passed (99)`は、検出した99ケースがすべて成功したことを示す。
- 失敗がなければコマンドは終了コード0を返す。

時間の内訳は次の意味を持つ。

| 項目 | 内容 |
|---|---|
| `transform` | TypeScriptを実行用に変換する |
| `setup` | テスト用セットアップを処理する |
| `collect` | テストファイルを読み込み、`describe`と`it`を収集する |
| `tests` | テスト本体を実行する |
| `environment` | Nodeなどのテスト環境を用意する |
| `prepare` | ワーカーなどの実行準備を行う |
| `Duration` | プロセス起動、グローバルセットアップ、終了処理を含む全体時間 |

内訳はすべてのオーバーヘッドを単純合計した値ではないため、`Duration`とは一致しないことがある。
DBファイル作成や`prisma db push`を含む初回セットアップは、純粋な関数テストより長くなる。

### 1.6 時刻に依存するテスト

実時間の経過を待つテストは遅く、不安定になる。B-4では`Clock`を注入し、
テスト用の`MutableClock`を任意のミリ秒だけ進める。

```typescript
class MutableClock implements Clock {
  constructor(private millis: number) {}

  now(): Date {
    return new Date(this.millis);
  }

  advance(millis: number): void {
    this.millis += millis;
  }
}
```

これにより、待ち時間なしで「60秒経過」などを再現でき、実行時刻に左右されない結果を得られる。

## 2. テストの粒度

テストファイルの配置だけで単体・結合を分類しない。何を接続して検証しているかで判断する。

| 種別 | Processloopでの例 |
|---|---|
| 単体テスト | 丸め、状態遷移、階層操作など、1ユニット内の入力と出力 |
| 結合テスト | ドメイン状態遷移、Prismaリポジトリ、SQLiteを接続した復元やトランザクション |
| 総合テスト | ブラウザから利用者の一連の操作を行うPlaywrightテスト |

`persistence/time-session.test.ts`は`src`配下にあるが、実際のSQLiteへ読み書きし、
層をまたぐため、内容としては結合テストを含む。

## 3. 楽観ロックテスト

### 3.1 楽観ロックが防ぐ問題

楽観ロックは、古い画面や遅れて届いた要求が最新状態を上書きする「更新の消失」を防ぐ。
読み込み時にはDB行をロックせず、レコードの`version`を更新条件に含めて競合を検出する。

2つの画面が同じ`version=5`を読み込んだ場合を考える。

```text
画面A: version 5で中断を要求 -> 更新成功、DBはversion 6
画面B: version 5で終了を要求 -> 更新対象0件、競合として拒否
```

概念上の更新条件は次のとおりである。

```sql
UPDATE ActiveTimeSession
SET state = 'paused', version = 6
WHERE id = 1 AND version = 5;
```

DBの最新バージョンが6なら、古い`version=5`に一致する行はない。
Processloopは更新件数が1件でなければ最新状態を読み直し、`VersionConflictError`を返す。
状態が一度変化して元の値に戻っていてもversionは進むため、途中の更新を見落とさない。

### 3.2 悲観ロックとの違い

| 楽観ロック | 悲観ロック |
|---|---|
| 読み込み中はDB行をロックしない | 読み込み時点でDB行をロックする |
| 更新時にversionを比較する | 他の更新をロック解除まで待たせる |
| 競合が少なく、要求間隔が長いWeb操作に向く | 短時間に競合が多いDB処理に向く |

ブラウザは同じ画面を長時間開く可能性がある。その間DBロックを保持せず、
操作時に古さを検出できる楽観ロックを採用する。

### 3.3 テストが証明すること

`persistence/time-session.test.ts`では、開始時のversionで中断してDBのversionを進めた後、
意図的に開始時の古いversionで再開を要求する。

```text
1. セッションを開始し、versionを保持する
2. そのversionで中断し、最新versionを進める
3. 開始時の古いversionで再開する
4. VersionConflictErrorになることを確認する
5. DBの最新versionとpaused状態が保たれていることを確認する
```

このテストは処理を物理的に同時実行しない。競合の本質である「要求のversionがDBより古い状態」を
決定的に作ることで、タイミングに依存せず競合検出の契約を検証する。
実負荷での待機時間や多数クライアントの競合率までは、このテストの保証範囲ではない。

## 4. 原子性テスト

### 4.1 原子性が防ぐ問題

原子性は、複数のDB操作を「すべて成功」または「すべて失敗」のどちらかにする性質である。
B-4の停止処理では、正式ログの作成と未終了セッションの削除を一体として扱う。

| 結果 | 正式ログ | 未終了セッション |
|---|---|---|
| 停止成功 | あり | なし |
| 停止失敗 | なし | あり（処理前の状態） |
| 禁止する途中状態 | なし | なし |

途中状態を許すと、セッションだけ消えて正式ログも残らず、計測時間を失う。

### 4.2 トランザクション

`stopSession`はPrismaの`$transaction`内で、期待versionのセッションを削除してから
正式ログを作成する。概念上は次の処理になる。

```sql
BEGIN TRANSACTION;

DELETE FROM ActiveTimeSession
WHERE id = 1 AND version = :expectedVersion;

INSERT INTO TimeLogEntry (...);

COMMIT;
```

INSERTなどが失敗して例外が発生すると、Prismaはトランザクションをロールバックする。
削除を先に実行していても未コミットなので、その削除も取り消される。

ノード切替では、旧セッションの削除、旧ログの作成、新セッションの作成を同じ
トランザクションに含める。どれか1つが失敗した場合は、切替前の状態へ戻す。

### 4.3 障害注入によるテスト

正常系でログ作成とセッション削除を確認するだけでは、トランザクションのロールバックは証明できない。
`IT-B4-04`はSQLiteトリガーを一時的に作り、`TimeLogEntry`へのINSERTを必ず失敗させる。

```sql
CREATE TRIGGER fail_time_log_insert
BEFORE INSERT ON TimeLogEntry
BEGIN
  SELECT RAISE(ABORT, 'forced time-log failure');
END;
```

テストの流れは次のとおりである。

```text
1. 未終了セッションを作る
2. トランザクション内でセッションを削除する
3. トリガーにより正式ログのINSERTを失敗させる
4. stopSessionが例外になることを確認する
5. セッションが復元でき、正式ログが0件であることを確認する
```

先に行った削除が取り消されているため、複数操作の原子性を確認できる。
トリガーは`finally`で削除し、テストが途中で失敗しても後続ケースに影響を残さない。
このテストはDBエラー時のロールバックを保証するが、プロセス強制終了やディスク障害そのものを
再現する耐障害試験ではない。

## 5. 楽観ロックと原子性の組合せ

2つの仕組みは代替関係ではなく、異なる境界を守る。

| 問い | 仕組み |
|---|---|
| その要求は最新状態を読んだ利用者から来たか | versionによる楽観ロック |
| 複数のDB操作をどこまで一体として確定するか | トランザクションによる原子性 |

B-4の停止処理は、次の順で両方を使う。

```text
停止要求（expectedVersionを受け取る）
  -> versionが一致しない: 競合エラー、DBを変更しない
  -> versionが一致する: トランザクションを開始
       -> ログ作成とセッション削除が成功: コミット
       -> どちらかが失敗: ロールバック
```

楽観ロックだけでは、古い更新は防げても複数操作の途中失敗を防げない。
トランザクションだけでは、途中状態は防げても古い画面からの要求を判別できない。
両方を組み合わせて、競合と途中失敗の双方から未終了セッションを守る。

## 6. テスト追加時の確認事項

- 仕様の条件と期待結果がテスト名から分かるか。
- 単体・結合・総合のどの境界を検証するか明確か。
- 実時間、実行順序、前のケースのDB状態へ依存していないか。
- 失敗を期待するテストで、例外だけでなく失敗後の保存状態も確認しているか。
- 一時的なトリガーやDB接続を、失敗時にも確実に解放しているか。
- `corepack pnpm typecheck`と`corepack pnpm test`の両方が成功するか。

## 関連資料

- [アーキテクチャ仕様書 第8章](phase1/arc-architecture.md#8-テスト方式)
- [B-4 時間ログ移植仕様書](phase1/units/prt-b4-time-log.md#6-単体結合テスト仕様)
- [B-9 永続化層移植仕様書](phase1/units/prt-b9-persistence.md#3-単体テスト仕様)
- [`packages/core/vitest.config.ts`](../packages/core/vitest.config.ts)
- [`packages/core/vitest.global-setup.ts`](../packages/core/vitest.global-setup.ts)
- [`persistence/time-session.test.ts`](../packages/core/src/persistence/time-session.test.ts)

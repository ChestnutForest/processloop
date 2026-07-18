# i18n スターター（next-intl 想定）

このフォルダの `.txt` ファイルは、**`frontend` を初期化した後に**拡張子を戻してコピーするための雛形です。
今はまだ `frontend` が空なので、ビルド対象に入らないよう `.txt` にしてあります。

## 適用手順（frontend 初期化後）

1. `cd frontend && npm install next-intl`
2. 下表のとおりコピーして、`.txt` を外す

| このフォルダ | コピー先 |
|---|---|
| `routing.ts.txt`    | `frontend/src/i18n/routing.ts` |
| `request.ts.txt`    | `frontend/src/i18n/request.ts` |
| `middleware.ts.txt` | `frontend/src/middleware.ts` |
| `next.config.ts.txt`| `frontend/next.config.ts`（既存に統合） |
| `layout.tsx.txt`    | `frontend/src/app/[locale]/layout.tsx` |
| `LocaleSwitcher.tsx.txt` | `frontend/src/components/LocaleSwitcher.tsx` |

3. 翻訳リソースを参照させる
   - 既定では `frontend/messages/{locale}.json` を読みます。
   - リポジトリ直下の `i18n/messages/` を単一の情報源にしたい場合は、
     `request.ts` の読み込みパスを `../../i18n/messages/` に向けるか、
     ビルド前に `frontend/messages/` へコピーするスクリプトを用意してください。

## 方針

- **ソースロケールは `en`**。キーはまず `en.json` に定義し、`ja.json` へ翻訳する。
- **未訳キーは `en` にフォールバック**させ、画面が壊れないようにする。
- キー名は**意味ベース**（`nav.dashboard`）にし、英語の文言そのもの（`Dashboard`）をキーにしない。
- 日付・数値・通貨は素の文字列連結をせず、`next-intl` のフォーマッタを使う。

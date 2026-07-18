# processloop

Process Dashboard (GPLv3) を基にした派生プロジェクト。Java/Swing 版を Next.js 環境へ移植する。

**名前の由来**: process(計画→計測→実装→テスト→リリース→運用→改善) + loop(改善のループを回す)

## ライセンス / 帰属
- 本プロジェクトは GPLv3 の Process Dashboard (https://www.processdash.com/) を基にした派生物であり、GPLv3 で提供する。
- PSP / TSP はカーネギーメロン大学のサービスマーク。本プロジェクトは CMU と非提携・非公認。
- 詳細は NOTICE を参照。

## 構成
- frontend/  : Next.js アプリ (UI) ※未初期化
- backend/   : API サービス ※未初期化
- i18n/      : 多言語対応 (en / ja)。messages/ が翻訳リソース、starter/ が設定雛形
- docs/      : 設計・移植メモ
- reference/legacy-java/ : 移植元 Java の参照専用 ※まだ変換しない

## 状態
初期準備フェーズ。Java→Next.js のソース変換は未実施。
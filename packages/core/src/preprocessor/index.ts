/**
 * C言語風プリプロセッサ（元: util/CppFilter.java 相当）
 *
 * 対応予定ディレクティブ:
 *   #if #ifdef #ifndef #else #endif #define #undef
 *
 * 注意: #include はこの層では扱わない（元実装では式の文法側で処理される）。
 */

/** 実装は次フェーズ。まずは足場のみ。 */
export function expandMacros(line: string): string {
  return line;
}

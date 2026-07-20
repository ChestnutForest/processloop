/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard - Data Automation Tool for high-maturity
 * processes, Copyright (C) 2001-2003 Tuma Solutions, LLC.
 * https://github.com/dtuma/processdash
 *
 * Ported from src/net/sourceforge/processdash/util/CppFilter.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001
 * (Process Dashboard 2.7.6, 2026-05-28).
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 *
 * NOTE: The upstream implementation depends on StringUtils.java, which is
 * licensed under the LGPL and authored by a third party. That file is
 * deliberately NOT ported; its uses are replaced with standard JavaScript
 * string operations.
 */

/**
 * C言語風プリプロセッサ。
 *
 * 対応するディレクティブは #define, #undef, #ifdef, #ifndef, #else, #endif。
 *
 * 移植元の仕様上の制約をそのまま引き継ぐ。
 * - `#if` と `#elif` は対応しない（上流も未対応）
 * - `#include` は扱わない（上流では式の文法側で処理される）
 * - コメントは除去しない
 *
 * 出力は入力と同じ行数を保つ。ディレクティブ行は空行として残る。
 */

/** マクロ1件の展開規則。 */
interface Macro {
  /** マクロ名。 */
  readonly name: string;
  /** 行に対して適用する正規表現。 */
  readonly pattern: RegExp;
  /** 置換文字列。引数付きマクロでは $1, $2… を含む。 */
  readonly replacement: string;
}

/**
 * 正規表現のメタ文字をエスケープする。
 *
 * 移植元は Perl5Util.regexpQuote を使うが、ここでは標準機能で実装する。
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 置換文字列中の `$` をエスケープする。
 *
 * String.replace は置換文字列中の `$` を特殊扱いするため、マクロ定義に
 * 含まれる `$` をそのまま出力するには `$$` にする必要がある。
 * ただし引数参照の `$1`, `$2`… は保持しなければならない。
 */
function escapeDollarsExceptGroups(text: string): string {
  return text.replace(/\$(?!\d)/g, '$$$$');
}

/**
 * 行末の改行がバックスラッシュでエスケープされているか判定する。
 *
 * 末尾のバックスラッシュが奇数個のときにエスケープとみなす。
 * 偶数個ならバックスラッシュ自体のエスケープなので継続しない。
 */
export function newlineIsEscaped(line: string): boolean {
  if (!line.endsWith('\\')) return false;

  let count = 0;
  for (let i = line.length - 1; i >= 0 && line[i] === '\\'; i--) {
    count++;
  }
  return count % 2 === 1;
}

export class CppPreprocessor {
  /** 定義済みマクロ。挿入順を保つため Map を使う。 */
  private readonly macros = new Map<string, Macro>();

  /** #ifdef の入れ子状態。各要素は「その時点で出力を抑止していたか」。 */
  private readonly ifStack: boolean[] = [];

  /** 現在出力を抑止しているか。 */
  private suppressing = false;

  /**
   * 入力全体を処理して出力を返す。
   *
   * @param source 入力テキスト
   * @returns 展開後のテキスト。行数は入力と一致する
   */
  process(source: string): string {
    const lines = source.split('\n');
    const output: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // 行継続を含む #define は、後続行を連結してから処理する。
      // 移植元の borrowedNewlineCount に相当する処理で、消費した行を
      // 空行で補って行数を保つ。
      if (!this.suppressing && line.startsWith('#define')) {
        let joined = line;
        let borrowed = 0;
        while (newlineIsEscaped(joined) && i + 1 < lines.length) {
          joined = joined.slice(0, -1) + (lines[++i] ?? '');
          borrowed++;
        }
        this.processDefine(joined);
        output.push('');
        for (let n = 0; n < borrowed; n++) output.push('');
        continue;
      }

      output.push(this.processLine(line));
    }

    return output.join('\n');
  }

  /** 1行を処理する。ディレクティブなら空文字を返す。 */
  private processLine(line: string): string {
    // #if 系は抑止中でも状態遷移が必要なので先に判定する
    if (line.startsWith('#if')) {
      this.processIf(line);
      return '';
    }
    if (line.startsWith('#endif')) {
      this.processEndif();
      return '';
    }
    if (line.startsWith('#else')) {
      this.processElse();
      return '';
    }
    if (this.suppressing) return '';

    if (line.startsWith('#undef')) {
      this.processUndef(line);
      return '';
    }
    if (line.startsWith('#define')) {
      this.processDefine(line);
      return '';
    }
    return this.expandMacros(line);
  }

  /**
   * #ifdef / #ifndef を処理する。
   *
   * 外側の #if が既に抑止している場合、内側の #if は抑止を解除できない。
   */
  private processIf(line: string): void {
    let newState = this.suppressing;

    if (!this.suppressing) {
      let identifier: string | undefined;
      let reverse = false;

      if (line.startsWith('#ifndef')) {
        identifier = this.getIdentifier(line.slice('#ifndef'.length));
        reverse = true;
      } else if (line.startsWith('#ifdef')) {
        identifier = this.getIdentifier(line.slice('#ifdef'.length));
      }
      // #if と #elif は上流も未対応

      if (identifier !== undefined) {
        newState = !this.macros.has(identifier);
        if (reverse) newState = !newState;
      }
    }

    this.ifStack.push(this.suppressing);
    this.suppressing = newState;
  }

  private processEndif(): void {
    this.suppressing = this.ifStack.pop() ?? false;
  }

  /**
   * #else を処理する。
   *
   * 外側が抑止中（スタック最上位が true）の場合は反転しない。
   */
  private processElse(): void {
    const outer = this.ifStack[this.ifStack.length - 1];
    if (this.ifStack.length === 0 || outer === false) {
      this.suppressing = !this.suppressing;
    }
  }

  private processUndef(line: string): void {
    const identifier = this.getIdentifier(line.slice('#undef'.length));
    if (identifier !== undefined) this.macros.delete(identifier);
  }

  /** 先頭の空白を飛ばして識別子を1つ取り出す。 */
  private getIdentifier(rest: string): string | undefined {
    const match = /^\s*(\S+)/.exec(rest);
    return match?.[1];
  }

  /**
   * #define を処理し、展開規則を登録する。
   *
   * マクロ名に `(` が含まれる場合は引数付きマクロとして扱い、
   * `)` が現れるまでをマクロ名として読み進める。
   */
  private processDefine(line: string): void {
    const rest = line.slice('#define'.length);

    const nameMatch = /^\s*([^\s(]+(?:\([^)]*\))?)/.exec(rest);
    if (nameMatch === null) return;

    // 移植元は StringUtils.findAndReplace で空白とタブを除去している。
    // LGPL のため移植せず、標準の replaceAll で代替する
    const rawName = nameMatch[1] ?? '';
    const macroSpec = rawName.replaceAll(' ', '').replaceAll('\t', '');

    // 定義本体。省略時は "1"
    const afterName = rest.slice(nameMatch[0].length);
    const body = afterName.replace(/^[ \t]+/, '');
    const definition = body.length > 0 ? body : '1';

    const openParen = macroSpec.indexOf('(');

    if (openParen === -1) {
      this.macros.set(macroSpec, {
        name: macroSpec,
        pattern: new RegExp(`\\b${escapeRegExp(macroSpec)}\\b`, 'g'),
        replacement: escapeDollarsExceptGroups(definition),
      });
      return;
    }

    // 引数付きマクロ
    const name = macroSpec.slice(0, openParen);
    const argSection = macroSpec.slice(openParen + 1).replace(/\)$/, '');
    const args = argSection.length > 0 ? argSection.split(',') : [];

    // 定義本体の仮引数を $1, $2… に置き換える
    let replacement = escapeDollarsExceptGroups(definition);
    args.forEach((arg, index) => {
      const argName = arg.trim();
      if (argName.length === 0) return;
      replacement = replacement.replace(
        new RegExp(`\\b${escapeRegExp(argName)}\\b`, 'g'),
        `$${index + 1}`,
      );
    });

    // 引数パターンは移植元と同じく [^(,)]* とする。
    // つまり引数に括弧やカンマを含められない（上流の制約を引き継ぐ）
    const argPattern = args.map(() => '([^(,)]*)').join(',');
    const pattern = new RegExp(
      `\\b${escapeRegExp(name)}\\(${argPattern}\\)`,
      'g',
    );

    this.macros.set(name, { name, pattern, replacement });
  }

  /**
   * 1行に対してマクロ展開を反復適用する。
   *
   * 一度適用したマクロは候補から外し、再帰展開の無限ループを防ぐ。
   * 展開が起きなくなるまで繰り返す。
   */
  expandMacros(line: string): string {
    const remaining = new Set(this.macros.keys());
    let result = line;
    let keepGoing = true;

    while (keepGoing && remaining.size > 0) {
      keepGoing = false;

      for (const name of Array.from(remaining)) {
        const macro = this.macros.get(name);
        if (macro === undefined) continue;

        // グローバル正規表現は lastIndex を持つため、都度リセットする
        macro.pattern.lastIndex = 0;
        const replaced = result.replace(macro.pattern, macro.replacement);

        if (replaced !== result) {
          result = replaced;
          remaining.delete(name);
          keepGoing = true;
        }
      }
    }

    return result;
  }
}

/**
 * 使い勝手のための関数版。
 *
 * @param source 入力テキスト
 * @returns 展開後のテキスト
 */
export function preprocess(source: string): string {
  return new CppPreprocessor().process(source);
}

#!/usr/bin/env node
/**
 * リポジトリ内の全 Markdown から Mermaid ブロックを抽出し、構文を検証する。
 *
 * GitHub は 4連バッククォート（````）で囲まれたブロックをコード例として表示し、
 * 中身を描画しない。本スクリプトも同じ判定で、実際に描画されるブロックだけを対象とする。
 *
 * 使い方:
 *   node scripts/validate-mermaid.mjs
 *
 * 前提: pnpm add -D mermaid jsdom
 */
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Mermaid は DOM を要求するため、Node 上で最小限の DOM を用意する
const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false });

const SKIP_DIRS = new Set(['node_modules', '.git', 'reference', 'dist', '.next']);

/** Markdown を再帰的に集める。 */
function collectMarkdown(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectMarkdown(full, acc);
    else if (name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

/**
 * 描画対象の Mermaid ブロックを取り出す。
 *
 * 4連バッククォートで囲まれた範囲は、行数を保ったまま空行に置き換えて除外する。
 * 行数を保つのは、エラー箇所の行番号を元ファイルと対応させるためである。
 */
function extractBlocks(source) {
  const withoutExamples = source.replace(
    /^````[\s\S]*?^````/gm,
    (m) => '\n'.repeat((m.match(/\n/g) ?? []).length),
  );

  const blocks = [];
  const re = /^```mermaid\n([\s\S]*?)\n^```/gm;
  let m;
  while ((m = re.exec(withoutExamples)) !== null) {
    const line = withoutExamples.slice(0, m.index).split('\n').length;
    blocks.push({ code: m[1] ?? '', line });
  }
  return blocks;
}

const root = process.cwd();
let ok = 0;
let ng = 0;

for (const file of collectMarkdown(root)) {
  const source = readFileSync(file, 'utf-8');
  for (const { code, line } of extractBlocks(source)) {
    const kind = code.split('\n')[0]?.split(/\s+/)[0] ?? '?';
    const where = `${relative(root, file)}:${line}`;
    try {
      await mermaid.parse(code);
      ok++;
      console.log(`  OK   ${kind.padEnd(20)} ${where}`);
    } catch (error) {
      ng++;
      const message = String(error instanceof Error ? error.message : error);
      console.error(`  FAIL ${kind.padEnd(20)} ${where}`);
      console.error(`       ${message.split('\n')[0]}`);
    }
  }
}

console.log(`\n  成功 ${ok} / 失敗 ${ng}`);
process.exit(ng > 0 ? 1 : 0);

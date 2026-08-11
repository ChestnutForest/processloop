#!/usr/bin/env node
/**
 * 要求仕様の Front Matter からトレーサビリティマトリクスを生成する。
 *
 * 出力は2通り。
 *   --table    Markdown の表（既定）
 *   --diagram  Mermaid の Requirement Diagram
 *   --both     両方
 *
 * 使い方:
 *   node scripts/generate-tm.mjs --both > docs/phase1/traceability-matrix.md
 *
 * 前提: pnpm add -D js-yaml
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

const REQ_DIR = 'docs/phase1/req';
const REPO = 'https://github.com/ChestnutForest/processloop/blob/main';

/** 要求ファイルの Front Matter を読み出す。 */
function readRequirements() {
  const files = readdirSync(REQ_DIR)
    .filter((f) => /^(fr|nfr|con)-.+\.md$/.test(f))
    .sort();

  return files.map((f) => {
    const text = readFileSync(join(REQ_DIR, f), 'utf-8');
    const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (match === null) throw new Error(`front matter がない: ${f}`);
    const fm = load(match[1] ?? '');
    return { ...fm, file: f };
  });
}

/** Mermaid の要求種別へ写す。 */
function mermaidType(type) {
  switch (type) {
    case 'functional': return 'functionalRequirement';
    case 'constraint': return 'designConstraint';
    default: return 'requirement';
  }
}

/** 識別子として使える名前にする。Mermaid は英数字と下線のみ受け付ける。 */
function toName(id) {
  return id.toLowerCase().replace(/-/g, '_');
}

/** 表形式のトレーサビリティマトリクスを組み立てる。 */
function buildTable(reqs) {
  const lines = [];

  lines.push('## 工程別の対応');
  lines.push('');
  lines.push('| 要求 | 表題 | 解析 | ユニット | 移植仕様 | 実装 | テスト | 状態 |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of reqs) {
    const ana = (r.source?.analysis_refs ?? []).join('<br>') || '—';
    const prt = `PRT-${r.unit.replace("-", "")}`;
    const src = `SRC-${r.unit.replace("-", "")}`;
    const tests = (r.test_refs ?? []).join('<br>') || '—';
    lines.push(
      `| [\`${r.id}\`](req/${r.file}) | ${r.title} | ${ana} | ${r.unit} | ${prt} | ${src} | ${tests} | \`${r.status}\` |`,
    );
  }

  lines.push('');
  lines.push('## 移植元の根拠');
  lines.push('');
  lines.push('| 要求 | 移植元のファイル | 上流SHA |');
  lines.push('|---|---|---|');
  for (const r of reqs) {
    const files = (r.source?.files ?? []).map((f) => `\`${f}\``).join('<br>');
    const sha = (r.source?.upstream_sha ?? '').slice(0, 7);
    lines.push(`| \`${r.id}\` | ${files} | \`${sha}\` |`);
  }

  lines.push('');
  lines.push('## 技術領域のカバレッジ');
  lines.push('');
  const domains = ['behavior', 'screen', 'data_model', 'external_if', 'batch', 'report', 'none'];
  lines.push(`| 要求 | ${domains.join(' | ')} |`);
  lines.push(`|---|${domains.map(() => '---').join('|')}|`);
  for (const r of reqs) {
    const cells = domains.map((d) => ((r.domains ?? []).includes(d) ? 'O' : ''));
    lines.push(`| \`${r.id}\` | ${cells.join(' | ')} |`);
  }

  lines.push('');
  lines.push('## 規模');
  lines.push('');
  lines.push('| 要求 | 仕様数 |');
  lines.push('|---|---|');
  let total = 0;
  for (const r of reqs) {
    total += r.spec_count ?? 0;
    lines.push(`| \`${r.id}\` | ${r.spec_count} |`);
  }
  lines.push(`| **合計** | **${total}** |`);

  return lines.join('\n');
}

/** Mermaid の Requirement Diagram を組み立てる。 */
function buildDiagram(reqs) {
  const lines = ['```mermaid', 'requirementDiagram', ''];

  for (const r of reqs) {
    lines.push(`${mermaidType(r.type)} ${toName(r.id)} {`);
    lines.push(`    id: "${r.id}"`);
    lines.push(`    text: "${r.title}"`);
    lines.push(`    risk: Medium`);
    lines.push(`    verifymethod: Test`);
    lines.push('}');
    lines.push('');
  }

  // 移植元を element として置く。ユニットごとに1つにまとめる。
  const units = [...new Set(reqs.map((r) => r.unit))].sort();
  for (const u of units) {
    lines.push(`element upstream_${toName(u)} {`);
    lines.push(`    type: "移植元"`);
    lines.push(`    docref: "unit ${u} @bf5a4d6"`);
    lines.push('}');
    lines.push('');
  }

  for (const r of reqs) {
    lines.push(`upstream_${toName(r.unit)} - derives -> ${toName(r.id)}`);
  }
  lines.push('');
  for (const r of reqs) {
    for (const dep of r.depends_on ?? []) {
      lines.push(`${toName(r.id)} - traces -> ${toName(dep)}`);
    }
  }

  lines.push('```');
  return lines.join('\n');
}

const args = process.argv.slice(2);
const mode = args.includes('--both') ? 'both' : args.includes('--diagram') ? 'diagram' : 'table';
const reqs = readRequirements();

if (mode === 'table' || mode === 'both') console.log(buildTable(reqs));
if (mode === 'both') console.log('');
if (mode === 'diagram' || mode === 'both') console.log(buildDiagram(reqs));

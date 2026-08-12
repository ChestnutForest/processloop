/**
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * テスト用 DB へのスキーマ投入を実行全体で1回だけ行う
 * （docs/phase1/units/prt-b9-persistence.md 3章「テスト環境」）。
 */

import { pushSchema } from './src/persistence/test-support';

export default function setup(): void {
  pushSchema();
}

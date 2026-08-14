/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 1998-2016 Tuma Solutions, LLC.
 * Ported from src/net/sourceforge/processdash/util/Stopwatch.java at upstream
 * commit bf5a4d63aff08410f79840001c816b37392e5001 (2.7.6, 2026-05-28).
 *
 * GNU General Public License version 3 or later. See LICENSE.
 */

/** 状態遷移に用いるサーバの壁時計。 */
export interface Clock {
  now(): Date;
}

/** 実行環境の現在時刻を返す既定実装。 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** 画面内の経過時間表示に用いる単調時計の抽象。 */
export interface MonotonicClock {
  nowMillis(): number;
}

/**
 * 時計の読みが逆行しても、利用者へ返す経過時間を減少させない。
 * ブラウザAPIには依存せず、frontendが単調時計の実装を注入する。
 */
export class MonotonicElapsedTimer {
  private readonly originMillis: number;
  private lastElapsedMillis = 0;

  constructor(private readonly clock: MonotonicClock) {
    this.originMillis = clock.nowMillis();
  }

  elapsedMillis(): number {
    const candidate = Math.max(0, this.clock.nowMillis() - this.originMillis);
    this.lastElapsedMillis = Math.max(this.lastElapsedMillis, candidate);
    return this.lastElapsedMillis;
  }
}

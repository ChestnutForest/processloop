/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2003-2020 Tuma Solutions, LLC.
 * Ported from src/net/sourceforge/processdash/log/time/DefaultTimeLoggingModel.java
 * at upstream commit bf5a4d63aff08410f79840001c816b37392e5001
 * (2.7.6, 2026-05-28).
 *
 * GNU General Public License version 3 or later. See LICENSE.
 */

import type { RoundedTimeLog } from './types';

export const MILLIS_PER_MINUTE = 60_000;

function assertDuration(name: string, millis: number): void {
  if (!Number.isFinite(millis) || millis < 0) {
    throw new RangeError(`${name}は0以上の有限値でなければならない`);
  }
}

/**
 * 移植元と同じく、作業時間は四捨五入し、中断時間は分未満を切り捨てる。
 * ただし丸め前の正味時間が1分未満なら、0分ログを作らずnullを返す。
 */
export function roundTimeLog(
  workMillis: number,
  interruptMillis: number,
): RoundedTimeLog | null {
  assertDuration('workMillis', workMillis);
  assertDuration('interruptMillis', interruptMillis);

  if (workMillis < MILLIS_PER_MINUTE) {
    return null;
  }

  return {
    delta: Math.floor(workMillis / MILLIS_PER_MINUTE + 0.5),
    interrupt: Math.floor(interruptMillis / MILLIS_PER_MINUTE),
  };
}

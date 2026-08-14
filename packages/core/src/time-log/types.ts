/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2003-2020 Tuma Solutions, LLC.
 * Ported from src/net/sourceforge/processdash/log/time/TimeLoggingModel.java and
 * src/net/sourceforge/processdash/log/time/TimeLogEntry.java at upstream commit
 * bf5a4d63aff08410f79840001c816b37392e5001 (2.7.6, 2026-05-28).
 *
 * GNU General Public License version 3 or later. See LICENSE.
 */

export type TimeSessionState = 'running' | 'paused';

/** 計測対象。末端ノードかどうかの判定はB-2の責務とする。 */
export interface TimeNode {
  readonly nodeId: number;
  readonly path: string;
}

/** 永続化から独立した、未終了の時間計測状態。 */
export interface ActiveTimeSession {
  readonly nodeId: number;
  readonly path: string;
  readonly start: Date;
  readonly state: TimeSessionState;
  readonly workMillis: number;
  readonly interruptMillis: number;
  readonly stateChangedAt: Date;
  readonly version: number;
  readonly updatedAt: Date;
}

/** B-9へ渡せる、ID採番前の正式ログ候補。 */
export interface TimeLogDraft {
  readonly nodeId: number;
  readonly path: string;
  readonly start: Date;
  /** 中断を除いた正味時間（分）。 */
  readonly delta: number;
  /** 中断時間（分）。deltaを超えてよい。 */
  readonly interrupt: number;
  readonly comment: string | null;
}

export interface RoundedTimeLog {
  readonly delta: number;
  readonly interrupt: number;
}

export interface StopSessionResult {
  /** 終了時点までの未丸め値を確定した状態。永続化はしない。 */
  readonly finalSession: ActiveTimeSession;
  /** 正味時間が1分未満ならnull。 */
  readonly log: TimeLogDraft | null;
}

export type StartSessionKind = 'started' | 'continued' | 'switched';

export interface StartSessionResult {
  readonly kind: StartSessionKind;
  readonly session: ActiveTimeSession;
  /** 異なるノードへ切り替えた場合だけ、終了対象を返す。 */
  readonly stopped: StopSessionResult | null;
}

export interface RestoredSession {
  readonly session: ActiveTimeSession;
  readonly displayWorkMillis: number;
  readonly displayInterruptMillis: number;
}

/** 古い画面からの更新を表すドメインエラー。 */
export class VersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(`時間計測セッションのversionが競合した: expected=${expectedVersion}, actual=${actualVersion}`);
    this.name = 'VersionConflictError';
  }
}

/** 現在状態では許可されない操作を表すドメインエラー。 */
export class InvalidSessionStateError extends Error {
  constructor(
    readonly operation: string,
    readonly actualState: TimeSessionState,
  ) {
    super(`状態${actualState}では${operation}を実行できない`);
    this.name = 'InvalidSessionStateError';
  }
}

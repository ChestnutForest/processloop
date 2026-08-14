/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 1998-2020 Tuma Solutions, LLC.
 * Ported from src/net/sourceforge/processdash/log/time/DefaultTimeLoggingModel.java
 * and src/net/sourceforge/processdash/util/Stopwatch.java at upstream commit
 * bf5a4d63aff08410f79840001c816b37392e5001 (2.7.6, 2026-05-28).
 *
 * GNU General Public License version 3 or later. See LICENSE.
 */

import type { Clock } from './clock';
import { roundTimeLog } from './rounding';
import {
  InvalidSessionStateError,
  VersionConflictError,
  type ActiveTimeSession,
  type RestoredSession,
  type StartSessionResult,
  type StopSessionResult,
  type TimeLogDraft,
  type TimeNode,
  type TimeSessionState,
} from './types';

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function durationSince(session: ActiveTimeSession, now: Date): number {
  return Math.max(0, now.getTime() - session.stateChangedAt.getTime());
}

function assertVersion(session: ActiveTimeSession, expectedVersion: number): void {
  if (session.version !== expectedVersion) {
    throw new VersionConflictError(expectedVersion, session.version);
  }
}

function assertState(
  session: ActiveTimeSession,
  expectedState: TimeSessionState,
  operation: string,
): void {
  if (session.state !== expectedState) {
    throw new InvalidSessionStateError(operation, session.state);
  }
}

function assertElapsedMillis(elapsedMillis: number): void {
  if (!Number.isFinite(elapsedMillis) || elapsedMillis < 0) {
    throw new RangeError('elapsedMillisは0以上の有限値でなければならない');
  }
}

function accumulateCurrentInterval(
  session: ActiveTimeSession,
  elapsedMillis: number,
): Pick<ActiveTimeSession, 'workMillis' | 'interruptMillis'> {
  if (session.state === 'running') {
    return {
      workMillis: session.workMillis + elapsedMillis,
      interruptMillis: session.interruptMillis,
    };
  }

  return {
    workMillis: session.workMillis,
    interruptMillis: session.interruptMillis + elapsedMillis,
  };
}

function updateSession(
  session: ActiveTimeSession,
  now: Date,
  elapsedMillis: number,
  nextState: TimeSessionState,
): ActiveTimeSession {
  const accumulated = accumulateCurrentInterval(session, elapsedMillis);
  return {
    ...session,
    ...accumulated,
    state: nextState,
    stateChangedAt: cloneDate(now),
    updatedAt: cloneDate(now),
    version: session.version + 1,
  };
}

function createSession(node: TimeNode, now: Date): ActiveTimeSession {
  return {
    nodeId: node.nodeId,
    path: node.path,
    start: cloneDate(now),
    state: 'running',
    workMillis: 0,
    interruptMillis: 0,
    stateChangedAt: cloneDate(now),
    version: 1,
    updatedAt: cloneDate(now),
  };
}

function createLogDraft(
  session: ActiveTimeSession,
  comment: string | null,
): TimeLogDraft | null {
  const rounded = roundTimeLog(session.workMillis, session.interruptMillis);
  if (rounded === null) {
    return null;
  }

  return {
    nodeId: session.nodeId,
    path: session.path,
    start: cloneDate(session.start),
    delta: rounded.delta,
    interrupt: rounded.interrupt,
    comment,
  };
}

function stopAt(
  session: ActiveTimeSession,
  comment: string | null,
  now: Date,
): StopSessionResult {
  const elapsedMillis = durationSince(session, now);
  const finalSession = updateSession(session, now, elapsedMillis, session.state);

  // 移植元は末尾中断を含めない場合がある。Processloopでは利用者が明示した
  // 中断区間を欠落させないため、中断中の明示終了時も終了時刻まで積算する。
  return {
    finalSession,
    log: createLogDraft(finalSession, comment),
  };
}

/** 同じノードなら継続し、異なるノードなら旧セッションの終了対象も返す。 */
export function startSession(
  current: ActiveTimeSession | null,
  node: TimeNode,
  clock: Clock,
): StartSessionResult {
  if (current !== null && current.nodeId === node.nodeId) {
    return { kind: 'continued', session: current, stopped: null };
  }

  const now = clock.now();
  const stopped = current === null ? null : stopAt(current, null, now);
  return {
    kind: current === null ? 'started' : 'switched',
    session: createSession(node, now),
    stopped,
  };
}

/** 作業区間を確定し、中断状態へ移す。 */
export function pauseSession(
  session: ActiveTimeSession,
  expectedVersion: number,
  clock: Clock,
): ActiveTimeSession {
  assertVersion(session, expectedVersion);
  assertState(session, 'running', 'pause');
  const now = clock.now();
  return updateSession(session, now, durationSince(session, now), 'paused');
}

/** 中断区間を確定し、計測状態へ戻す。 */
export function resumeSession(
  session: ActiveTimeSession,
  expectedVersion: number,
  clock: Clock,
): ActiveTimeSession {
  assertVersion(session, expectedVersion);
  assertState(session, 'paused', 'resume');
  const now = clock.now();
  return updateSession(session, now, durationSince(session, now), 'running');
}

/** 単調時計で測った現在区間を確定し、同じ状態で新しい区間を始める。 */
export function checkpointSession(
  session: ActiveTimeSession,
  expectedVersion: number,
  elapsedMillis: number,
  clock: Clock,
): ActiveTimeSession {
  assertVersion(session, expectedVersion);
  assertElapsedMillis(elapsedMillis);
  return updateSession(session, clock.now(), elapsedMillis, session.state);
}

/** 現在区間を確定し、正式ログ候補または1分未満の非保存結果を返す。 */
export function stopSession(
  session: ActiveTimeSession,
  expectedVersion: number,
  comment: string | null,
  clock: Clock,
): StopSessionResult {
  assertVersion(session, expectedVersion);
  return stopAt(session, comment, clock.now());
}

/** 永続化済み状態を変更せず、復元時点の表示値だけを算出する。 */
export function restoreSession(
  session: ActiveTimeSession,
  clock: Clock,
): RestoredSession {
  const elapsedMillis = durationSince(session, clock.now());
  const accumulated = accumulateCurrentInterval(session, elapsedMillis);
  return {
    session,
    displayWorkMillis: accumulated.workMillis,
    displayInterruptMillis: accumulated.interruptMillis,
  };
}

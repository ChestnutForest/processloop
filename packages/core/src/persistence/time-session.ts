/*
 * Processloop - a Next.js port of Process Dashboard
 * Copyright (C) 2026 Kazuyuki Kuribayashi
 *
 * Derived from Process Dashboard, Copyright (C) 2003-2020 Tuma Solutions, LLC.
 * Ported from src/net/sourceforge/processdash/log/time/DefaultTimeLoggingModel.java,
 * src/net/sourceforge/processdash/log/time/TimeLogEntry.java, and
 * src/net/sourceforge/processdash/util/Stopwatch.java at upstream commit
 * bf5a4d63aff08410f79840001c816b37392e5001 (2.7.6, 2026-05-28).
 *
 * The upstream keeps the current record inside the desktop process. Processloop
 * deliberately persists it for browser reload and server restart recovery; see
 * docs/phase1/units/prt-b4-time-log.md.
 *
 * GNU General Public License version 3 or later. See LICENSE.
 */

import type { Prisma } from '@prisma/client';
import {
  checkpointSession as transitionCheckpoint,
  pauseSession as transitionPause,
  restoreSession as calculateRestoredSession,
  resumeSession as transitionResume,
  startSession as transitionStart,
  stopSession as transitionStop,
  VersionConflictError,
  type ActiveTimeSession,
  type Clock,
  type RestoredSession,
  type StartSessionResult,
  type StopSessionResult,
  type TimeLogDraft,
  type TimeNode,
  type TimeSessionState,
} from '../time-log';
import { getClient } from './client';
import { ActiveTimeSessionNotFoundError } from './types';

const ACTIVE_SESSION_ID = 1;
const START_RETRY_LIMIT = 3;

type TimeSessionDatabase = Pick<
  Prisma.TransactionClient,
  'activeTimeSession' | 'timeLogEntry'
>;

class ConcurrentTimeSessionChangeError extends Error {}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

function isTimeSessionState(value: string): value is TimeSessionState {
  return value === 'running' || value === 'paused';
}

function fromStoredMillis(value: bigint, field: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted) || converted < 0) {
    throw new RangeError(`${field}は0以上の安全な整数でなければならない`);
  }
  return converted;
}

function toStoredMillis(value: number, field: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field}は0以上の安全な整数でなければならない`);
  }
  return BigInt(value);
}

function toDomain(row: {
  nodeId: number;
  path: string;
  start: Date;
  state: string;
  workMillis: bigint;
  interruptMillis: bigint;
  stateChangedAt: Date;
  version: number;
  updatedAt: Date;
}): ActiveTimeSession {
  if (!isTimeSessionState(row.state)) {
    throw new RangeError(`保存された時間計測状態が不正である: ${row.state}`);
  }

  return {
    nodeId: row.nodeId,
    path: row.path,
    start: row.start,
    state: row.state,
    workMillis: fromStoredMillis(row.workMillis, 'workMillis'),
    interruptMillis: fromStoredMillis(row.interruptMillis, 'interruptMillis'),
    stateChangedAt: row.stateChangedAt,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function toCreateData(
  session: ActiveTimeSession,
): Prisma.ActiveTimeSessionUncheckedCreateInput {
  return {
    id: ACTIVE_SESSION_ID,
    nodeId: session.nodeId,
    path: session.path,
    start: session.start,
    state: session.state,
    workMillis: toStoredMillis(session.workMillis, 'workMillis'),
    interruptMillis: toStoredMillis(session.interruptMillis, 'interruptMillis'),
    stateChangedAt: session.stateChangedAt,
    version: session.version,
    updatedAt: session.updatedAt,
  };
}

function toUpdateData(
  session: ActiveTimeSession,
): Prisma.ActiveTimeSessionUpdateManyMutationInput {
  return {
    state: session.state,
    workMillis: toStoredMillis(session.workMillis, 'workMillis'),
    interruptMillis: toStoredMillis(session.interruptMillis, 'interruptMillis'),
    stateChangedAt: session.stateChangedAt,
    version: session.version,
    updatedAt: session.updatedAt,
  };
}

function toTimeLogData(log: TimeLogDraft): Prisma.TimeLogEntryUncheckedCreateInput {
  return {
    nodeId: log.nodeId,
    path: log.path,
    start: log.start,
    delta: log.delta,
    interrupt: log.interrupt,
    comment: log.comment,
  };
}

function fixedClock(at: Date): Clock {
  const millis = at.getTime();
  return { now: () => new Date(millis) };
}

async function readCurrent(
  database: Pick<TimeSessionDatabase, 'activeTimeSession'>,
): Promise<ActiveTimeSession | null> {
  const row = await database.activeTimeSession.findUnique({
    where: { id: ACTIVE_SESSION_ID },
  });
  return row === null ? null : toDomain(row);
}

async function requireCurrent(
  database: Pick<TimeSessionDatabase, 'activeTimeSession'>,
): Promise<ActiveTimeSession> {
  const current = await readCurrent(database);
  if (current === null) throw new ActiveTimeSessionNotFoundError();
  return current;
}

async function removeExpected(
  database: Pick<TimeSessionDatabase, 'activeTimeSession'>,
  version: number,
): Promise<void> {
  const removed = await database.activeTimeSession.deleteMany({
    where: { id: ACTIVE_SESSION_ID, version },
  });
  if (removed.count !== 1) throw new ConcurrentTimeSessionChangeError();
}

async function createTimeLog(
  database: Pick<TimeSessionDatabase, 'timeLogEntry'>,
  log: TimeLogDraft | null,
): Promise<void> {
  if (log !== null) {
    await database.timeLogEntry.create({ data: toTimeLogData(log) });
  }
}

async function throwLatestConflict(expectedVersion: number): Promise<never> {
  const latest = await readCurrent(getClient());
  if (latest === null) throw new ActiveTimeSessionNotFoundError();
  throw new VersionConflictError(expectedVersion, latest.version);
}

async function updateCurrent(
  expectedVersion: number,
  transition: (current: ActiveTimeSession) => ActiveTimeSession,
): Promise<ActiveTimeSession> {
  const client = getClient();
  const current = await requireCurrent(client);
  const updated = transition(current);
  const result = await client.activeTimeSession.updateMany({
    where: { id: ACTIVE_SESSION_ID, version: expectedVersion },
    data: toUpdateData(updated),
  });
  if (result.count !== 1) return throwLatestConflict(expectedVersion);
  return updated;
}

async function startOnce(node: TimeNode, operationClock: Clock): Promise<StartSessionResult> {
  return getClient().$transaction(async (transaction) => {
    const current = await readCurrent(transaction);
    const result = transitionStart(current, node, operationClock);
    if (result.kind === 'continued') return result;

    if (current !== null) {
      await removeExpected(transaction, current.version);
      await createTimeLog(transaction, result.stopped?.log ?? null);
    }
    await transaction.activeTimeSession.create({ data: toCreateData(result.session) });
    return result;
  });
}

/** 同じノードなら継続し、異なるノードなら旧ログの確定と新規作成を原子的に行う。 */
export async function startSession(
  node: TimeNode,
  clock: Clock,
): Promise<StartSessionResult> {
  const operationClock = fixedClock(clock.now());
  let lastError: unknown;

  for (let attempt = 0; attempt < START_RETRY_LIMIT; attempt += 1) {
    try {
      return await startOnce(node, operationClock);
    } catch (error) {
      if (
        !(error instanceof ConcurrentTimeSessionChangeError) &&
        !isPrismaError(error, 'P2002') &&
        !isPrismaError(error, 'P2034')
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('時間計測セッションの開始に失敗した');
}

/** 作業区間を確定し、楽観ロック付きで中断状態を保存する。 */
export async function pauseSession(
  expectedVersion: number,
  clock: Clock,
): Promise<ActiveTimeSession> {
  const operationClock = fixedClock(clock.now());
  return updateCurrent(expectedVersion, (current) =>
    transitionPause(current, expectedVersion, operationClock),
  );
}

/** 中断区間を確定し、楽観ロック付きで計測状態を保存する。 */
export async function resumeSession(
  expectedVersion: number,
  clock: Clock,
): Promise<ActiveTimeSession> {
  const operationClock = fixedClock(clock.now());
  return updateCurrent(expectedVersion, (current) =>
    transitionResume(current, expectedVersion, operationClock),
  );
}

/** 画面の単調時計で測った現在区間を積算して保存する。 */
export async function checkpointSession(
  expectedVersion: number,
  elapsedMillis: number,
  clock: Clock,
): Promise<ActiveTimeSession> {
  const operationClock = fixedClock(clock.now());
  return updateCurrent(expectedVersion, (current) =>
    transitionCheckpoint(current, expectedVersion, elapsedMillis, operationClock),
  );
}

/** 保存済み状態を変更せず、復元時点の表示値を返す。 */
export async function restoreSession(clock: Clock): Promise<RestoredSession | null> {
  const current = await readCurrent(getClient());
  return current === null
    ? null
    : calculateRestoredSession(current, fixedClock(clock.now()));
}

/** 正式ログの作成と未終了セッションの削除を単一トランザクションで行う。 */
export async function stopSession(
  expectedVersion: number,
  comment: string | null,
  clock: Clock,
): Promise<StopSessionResult> {
  const operationClock = fixedClock(clock.now());
  try {
    return await getClient().$transaction(async (transaction) => {
      const current = await requireCurrent(transaction);
      const result = transitionStop(current, expectedVersion, comment, operationClock);
      await removeExpected(transaction, expectedVersion);
      await createTimeLog(transaction, result.log);
      return result;
    });
  } catch (error) {
    if (error instanceof ConcurrentTimeSessionChangeError) {
      return throwLatestConflict(expectedVersion);
    }
    throw error;
  }
}

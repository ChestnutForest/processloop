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

export { MonotonicElapsedTimer, SystemClock } from './clock';
export type { Clock, MonotonicClock } from './clock';
export { MILLIS_PER_MINUTE, roundTimeLog } from './rounding';
export {
  checkpointSession,
  pauseSession,
  restoreSession,
  resumeSession,
  startSession,
  stopSession,
} from './session';
export { InvalidSessionStateError, VersionConflictError } from './types';
export type {
  ActiveTimeSession,
  RestoredSession,
  RoundedTimeLog,
  StartSessionKind,
  StartSessionResult,
  StopSessionResult,
  TimeLogDraft,
  TimeNode,
  TimeSessionState,
} from './types';

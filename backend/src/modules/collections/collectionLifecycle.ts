import { parseCollectionNotes } from './collections.service.js';

export interface PauseLike {
  startedAt: Date | string;
  endedAt?: Date | string | null;
}

export interface CollectionTimingLike {
  status?: string;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  notes?: string | null;
  targetDurationMinutes?: number | null;
  pauses?: PauseLike[];
}

export function resolveTargetDurationMinutes(col: CollectionTimingLike): number | null {
  if (typeof col.targetDurationMinutes === 'number' && col.targetDurationMinutes > 0) {
    return col.targetDurationMinutes;
  }
  const parsed = parseCollectionNotes(col.notes);
  return parsed.targetDurationMinutes && parsed.targetDurationMinutes > 0
    ? parsed.targetDurationMinutes
    : null;
}

export function sumPausedMs(
  startedAt: Date | string,
  pauses: PauseLike[] | undefined,
  untilMs: number
): number {
  const startMs = new Date(startedAt).getTime();
  if (isNaN(startMs) || !pauses || pauses.length === 0) return 0;

  let total = 0;
  for (const p of pauses) {
    const pStart = Math.max(startMs, new Date(p.startedAt).getTime());
    const pEnd = p.endedAt ? Math.min(untilMs, new Date(p.endedAt).getTime()) : untilMs;
    if (!isNaN(pStart) && !isNaN(pEnd) && pEnd > pStart) {
      total += pEnd - pStart;
    }
  }
  return total;
}

export function computeOperationalElapsedMs(
  col: CollectionTimingLike,
  nowMs: number = Date.now()
): number {
  if (!col.startedAt) return 0;
  const startMs = new Date(col.startedAt).getTime();
  if (isNaN(startMs)) return 0;

  const endMs = col.endedAt ? new Date(col.endedAt).getTime() : nowMs;
  const effectiveEndMs = Math.max(startMs, endMs);
  const pausedMs = sumPausedMs(col.startedAt, col.pauses, effectiveEndMs);
  return Math.max(0, effectiveEndMs - startMs - pausedMs);
}

/**
 * Calcula o instante exato (deadline) em que a coleta atinge o limite configurado,
 * descontando todas as pausas registradas até `nowMs`.
 */
export function computeDeadline(
  col: CollectionTimingLike,
  nowMs: number = Date.now()
): Date | null {
  const targetMinutes = resolveTargetDurationMinutes(col);
  if (!targetMinutes || !col.startedAt) return null;

  const startMs = new Date(col.startedAt).getTime();
  if (isNaN(startMs)) return null;

  const refEndMs = col.endedAt ? new Date(col.endedAt).getTime() : nowMs;
  const pausedMs = sumPausedMs(col.startedAt, col.pauses, Math.max(startMs, refEndMs));
  return new Date(startMs + targetMinutes * 60_000 + pausedMs);
}

export function computeRemainingMs(
  col: CollectionTimingLike,
  nowMs: number = Date.now()
): number | null {
  const targetMinutes = resolveTargetDurationMinutes(col);
  if (!targetMinutes) return null;
  if (!col.startedAt || col.status === 'DRAFT') {
    return targetMinutes * 60_000;
  }
  if (col.status === 'FINISHED') {
    return 0;
  }
  const elapsedMs = computeOperationalElapsedMs(col, nowMs);
  return Math.max(0, targetMinutes * 60_000 - elapsedMs);
}

export function isDeadlineExpired(
  col: CollectionTimingLike,
  nowMs: number = Date.now()
): boolean {
  const deadline = computeDeadline(col, nowMs);
  if (!deadline) return false;
  return deadline.getTime() <= nowMs;
}

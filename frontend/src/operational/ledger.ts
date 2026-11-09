import { EventItem } from '../api/events.js';

export type LedgerOpKind = 'ARRIVAL' | 'SERVICE_START' | 'SERVICE_FINISH';
export type LedgerOpStatus = 'queued' | 'sending' | 'retrying' | 'confirmed' | 'failed' | 'rejected';

export interface LedgerOp {
  key: string; // idempotencyKey
  kind: LedgerOpKind;
  collectionId: string;
  attendantId?: string;
  attendant?: { id: string; code: string; displayName: string };
  queueId?: string;
  queueName?: string;
  occurredAt: string;
  startedAt?: string;
  status: LedgerOpStatus;
  error?: string;
  retryCount: number;
  serverEventId?: string;
  serverIntervalId?: string;
  serverEvent?: EventItem;
  confirmedAt?: number;
  metadata?: any;
}

export interface ServerSnapshot {
  seq: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';
  targetDurationMinutes?: number | null;
  startedAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
  pauses?: Array<{ id: string; startedAt: string; endedAt: string | null; reason: string | null }>;
  deadlineAt?: string | null;
  remainingMs?: number | null;
  serverTime: string;
  arrivals: number;
  arrivalsByQueue?: Record<string, number>;
  arrivalsByAttendant?: Record<string, number>;
  deliveriesByAttendant: Record<string, number>;
  eventStates: Record<string, { isVoided: boolean; id: string }>;
  activeServices: Array<{
    id: string;
    attendantId: string;
    startedAt: string;
    attendant?: { id: string; code: string; displayName: string };
  }>;
  recentEvents: EventItem[];
}

export interface PendingVoid {
  key: string; // idempotencyKey (ou eventId se chave indisponível)
  eventId: string;
  eventType: 'ARRIVAL' | 'DELIVERY' | 'OBSERVATION';
  attendantId?: string | null;
  queueId?: string | null;
}

export interface LedgerState {
  snapshot: ServerSnapshot | null;
  ops: LedgerOp[];
  pendingVoids: Record<string, PendingVoid>;
  closed: boolean;
}

export type LedgerAction =
  | { type: 'OP_ENQUEUED'; op: LedgerOp }
  | {
      type: 'OP_STATUS_CHANGED';
      key: string;
      status: LedgerOpStatus;
      error?: string;
      retryCount?: number;
      serverEvent?: EventItem;
      serverEventId?: string;
      serverIntervalId?: string;
      startedAt?: string;
      confirmedAt?: number;
    }
  | { type: 'OP_DISMISSED'; key: string }
  | { type: 'VOID_REQUESTED'; voidItem: PendingVoid }
  | { type: 'VOID_CONFIRMED'; key: string }
  | { type: 'VOID_FAILED'; key: string }
  | { type: 'SNAPSHOT_APPLIED'; snapshot: ServerSnapshot; nowMs?: number }
  | { type: 'COLLECTION_CLOSED'; reason?: string };

export interface DerivedActiveService {
  id: string;
  attendantId: string;
  startedAt: string;
  isPending: boolean;
}

export interface DerivedLogItem {
  key: string; // React key estável = idempotencyKey
  eventId?: string; // ID real no banco (presente quando confirmado)
  kind: 'ARRIVAL' | 'DELIVERY' | 'SERVICE_START';
  syncStatus: LedgerOpStatus;
  occurredAt: string;
  startedAt?: string;
  durationSeconds?: number;
  attendantId?: string | null;
  attendant?: { code: string; displayName: string } | null;
  queueId?: string | null;
  queue?: { name: string } | null;
  isVoided: boolean;
  isVoidPending?: boolean;
  error?: string;
}

const ACTIVE_OP_STATUSES: ReadonlySet<LedgerOpStatus> = new Set([
  'queued',
  'sending',
  'retrying',
  'confirmed',
]);

export function createInitialLedgerState(persistedOps: LedgerOp[] = []): LedgerState {
  return {
    snapshot: null,
    ops: persistedOps,
    pendingVoids: {},
    closed: false,
  };
}

export function normalizeRawSnapshot(raw: any, seq: number): ServerSnapshot {
  const eventStates: Record<string, { isVoided: boolean; id: string }> = {};

  if (Array.isArray(raw.eventStates)) {
    for (const tuple of raw.eventStates) {
      if (Array.isArray(tuple) && tuple[0]) {
        eventStates[String(tuple[0])] = {
          isVoided: Boolean(tuple[1]),
          id: String(tuple[2] || tuple[0]),
        };
      }
    }
  }

  const recentEvents: EventItem[] = Array.isArray(raw.recentEvents) ? raw.recentEvents : [];
  for (const ev of recentEvents) {
    const k = ev.idempotencyKey || ev.id;
    if (k) {
      eventStates[k] = {
        isVoided: Boolean(ev.isVoided),
        id: ev.id,
      };
    }
  }

  return {
    seq,
    status: raw.status || 'IN_PROGRESS',
    targetDurationMinutes: raw.targetDurationMinutes ?? null,
    startedAt: raw.startedAt ?? null,
    pausedAt: raw.pausedAt ?? null,
    finishedAt: raw.finishedAt ?? raw.endedAt ?? null,
    pauses: Array.isArray(raw.pauses) ? raw.pauses : undefined,
    deadlineAt: raw.deadlineAt ?? null,
    remainingMs: typeof raw.remainingMs === 'number' ? raw.remainingMs : null,
    serverTime: raw.serverTime || new Date().toISOString(),
    arrivals: Number(raw.eventCounts?.arrivals ?? 0),
    arrivalsByQueue: { ...(raw.eventCounts?.arrivalsByQueue || {}) },
    arrivalsByAttendant: { ...(raw.eventCounts?.arrivalsByAttendant || {}) },
    deliveriesByAttendant: { ...(raw.eventCounts?.deliveriesByAttendant || {}) },
    eventStates,
    activeServices: Array.isArray(raw.activeServices) ? raw.activeServices : [],
    recentEvents,
  };
}

export function reduceLedger(state: LedgerState, action: LedgerAction): LedgerState {
  switch (action.type) {
    case 'OP_ENQUEUED': {
      if (state.closed) {
        return {
          ...state,
          ops: [
            {
              ...action.op,
              status: 'rejected',
              error: 'Aferição já encerrada.',
            },
            ...state.ops.filter((o) => o.key !== action.op.key),
          ],
        };
      }
      return {
        ...state,
        ops: [action.op, ...state.ops.filter((o) => o.key !== action.op.key)],
      };
    }

    case 'OP_STATUS_CHANGED': {
      return {
        ...state,
        ops: state.ops.map((op) => {
          if (op.key !== action.key) return op;
          return {
            ...op,
            status: action.status,
            error: action.error,
            retryCount: action.retryCount ?? op.retryCount,
            serverEvent: action.serverEvent ?? op.serverEvent,
            serverEventId: action.serverEvent?.id ?? action.serverEventId ?? op.serverEventId,
            serverIntervalId: action.serverIntervalId ?? op.serverIntervalId,
            startedAt: action.startedAt ?? op.startedAt,
            confirmedAt:
              action.status === 'confirmed'
                ? action.confirmedAt ?? op.confirmedAt ?? Date.now()
                : op.confirmedAt,
          };
        }),
      };
    }

    case 'OP_DISMISSED': {
      return {
        ...state,
        ops: state.ops.filter((op) => op.key !== action.key),
      };
    }

    case 'VOID_REQUESTED': {
      return {
        ...state,
        pendingVoids: {
          ...state.pendingVoids,
          [action.voidItem.key]: action.voidItem,
        },
      };
    }

    case 'VOID_CONFIRMED': {
      return state;
    }

    case 'VOID_FAILED': {
      const nextVoids = { ...state.pendingVoids };
      delete nextVoids[action.key];
      return {
        ...state,
        pendingVoids: nextVoids,
      };
    }

    case 'COLLECTION_CLOSED': {
      const msg = action.reason || 'Aferição já encerrada.';
      return {
        ...state,
        closed: true,
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              status: 'FINISHED',
              remainingMs: 0,
              activeServices: [],
            }
          : null,
        ops: state.ops.map((op) => {
          if (op.status === 'queued') {
            return { ...op, status: 'rejected', error: msg };
          }
          return op;
        }),
      };
    }

    case 'SNAPSHOT_APPLIED': {
      const incoming = action.snapshot;
      if (state.snapshot && incoming.seq < state.snapshot.seq) {
        // Ignora respostas de poll antigas que chegaram fora de ordem
        return state;
      }

      const nowMs = action.nowMs ?? Date.now();
      const isFinished = incoming.status === 'FINISHED';

      // Limpa operações já absorvidas pelo snapshot do servidor
      const nextOps: LedgerOp[] = [];
      for (const op of state.ops) {
        if (op.kind === 'ARRIVAL' || op.kind === 'SERVICE_FINISH') {
          const inServer = incoming.eventStates[op.key];
          if (inServer && op.status === 'confirmed') {
            // Já consta nas contagens e estados do servidor -> absorvida!
            continue;
          }
          if (inServer && ACTIVE_OP_STATUSES.has(op.status)) {
            // O poll observou o evento antes da resposta HTTP voltar: promove a confirmado
            nextOps.push({
              ...op,
              status: 'confirmed',
              serverEventId: inServer.id,
              confirmedAt: op.confirmedAt ?? nowMs,
            });
            continue;
          }
          if (op.status === 'confirmed' && op.confirmedAt && nowMs - op.confirmedAt > 60_000) {
            continue;
          }
        } else if (op.kind === 'SERVICE_START') {
          const hasActiveOnServer = incoming.activeServices.some(
            (s) =>
              s.attendantId === op.attendantId &&
              (op.serverIntervalId ? s.id === op.serverIntervalId : true)
          );
          const hasSubsequentFinish = state.ops.some(
            (other) =>
              other.kind === 'SERVICE_FINISH' &&
              other.attendantId === op.attendantId &&
              other.occurredAt >= op.occurredAt
          );
          if (op.status === 'confirmed' && (hasActiveOnServer || hasSubsequentFinish || isFinished)) {
            continue;
          }
          if (op.status === 'confirmed' && op.confirmedAt && nowMs - op.confirmedAt > 60_000) {
            continue;
          }
        }

        if (isFinished && op.status === 'queued') {
          nextOps.push({
            ...op,
            status: 'rejected',
            error: 'Aferição já encerrada.',
          });
        } else {
          nextOps.push(op);
        }
      }

      // Limpa anulações pendentes que o snapshot já reflete como isVoided = true
      const nextVoids: Record<string, PendingVoid> = {};
      for (const [key, v] of Object.entries(state.pendingVoids)) {
        const inServer = incoming.eventStates[key];
        if (inServer && inServer.isVoided) {
          continue;
        }
        nextVoids[key] = v;
      }

      return {
        ...state,
        snapshot: incoming,
        ops: nextOps,
        pendingVoids: nextVoids,
        closed: isFinished,
      };
    }

    default:
      return state;
  }
}

/**
 * Total derivado de chegadas:
 * Base autoritativa do servidor + chegadas locais ainda não refletidas no snapshot - anulações pendentes.
 */
export function selectArrivals(state: LedgerState): number {
  const base = state.snapshot?.arrivals ?? 0;
  const eventStates = state.snapshot?.eventStates ?? {};

  let delta = 0;
  for (const op of state.ops) {
    if (op.kind !== 'ARRIVAL') continue;
    if (!ACTIVE_OP_STATUSES.has(op.status)) continue;
    if (state.pendingVoids[op.key]) continue;
    if (!eventStates[op.key]) {
      delta += 1;
    }
  }

  for (const v of Object.values(state.pendingVoids)) {
    if (v.eventType !== 'ARRIVAL') continue;
    const inServer = eventStates[v.key];
    if (inServer && !inServer.isVoided) {
      delta -= 1;
    }
  }

  return Math.max(0, base + delta);
}

/**
 * Total derivado de chegadas por fila (queueId):
 * Base autoritativa do servidor + chegadas locais ainda não refletidas no snapshot - anulações pendentes.
 */
export function selectArrivalsByQueue(state: LedgerState): Record<string, number> {
  const base = state.snapshot?.arrivalsByQueue ?? {};
  const eventStates = state.snapshot?.eventStates ?? {};
  const result: Record<string, number> = { ...base };

  for (const op of state.ops) {
    if (op.kind !== 'ARRIVAL' || !op.queueId) continue;
    if (!ACTIVE_OP_STATUSES.has(op.status)) continue;
    if (state.pendingVoids[op.key]) continue;
    if (!eventStates[op.key]) {
      result[op.queueId] = (result[op.queueId] || 0) + 1;
    }
  }

  for (const v of Object.values(state.pendingVoids)) {
    if (v.eventType !== 'ARRIVAL' || !v.queueId) continue;
    const inServer = eventStates[v.key];
    if (inServer && !inServer.isVoided) {
      result[v.queueId] = Math.max(0, (result[v.queueId] || 1) - 1);
    }
  }

  return result;
}

/**
 * Total derivado de chegadas por atendente (attendantId):
 * Base autoritativa do servidor + chegadas locais atribuídas à fila daquele atendente - anulações pendentes.
 */
export function selectArrivalsByAttendant(state: LedgerState): Record<string, number> {
  const base = state.snapshot?.arrivalsByAttendant ?? {};
  const eventStates = state.snapshot?.eventStates ?? {};
  const result: Record<string, number> = { ...base };

  for (const op of state.ops) {
    if (op.kind !== 'ARRIVAL' || !op.attendantId) continue;
    if (!ACTIVE_OP_STATUSES.has(op.status)) continue;
    if (state.pendingVoids[op.key]) continue;
    if (!eventStates[op.key]) {
      result[op.attendantId] = (result[op.attendantId] || 0) + 1;
    }
  }

  for (const v of Object.values(state.pendingVoids)) {
    if (v.eventType !== 'ARRIVAL' || !v.attendantId) continue;
    const inServer = eventStates[v.key];
    if (inServer && !inServer.isVoided) {
      result[v.attendantId] = Math.max(0, (result[v.attendantId] || 1) - 1);
    }
  }

  return result;
}

/**
 * Total derivado de entregas por atendente:
 * Base autoritativa do servidor + finalizações locais ainda não no snapshot - anulações pendentes.
 */
export function selectDeliveries(state: LedgerState): Record<string, number> {
  const base = state.snapshot?.deliveriesByAttendant ?? {};
  const eventStates = state.snapshot?.eventStates ?? {};
  const result: Record<string, number> = { ...base };

  for (const op of state.ops) {
    if (op.kind !== 'SERVICE_FINISH' || !op.attendantId) continue;
    if (!ACTIVE_OP_STATUSES.has(op.status)) continue;
    if (state.pendingVoids[op.key]) continue;
    if (!eventStates[op.key]) {
      result[op.attendantId] = (result[op.attendantId] || 0) + 1;
    }
  }

  for (const v of Object.values(state.pendingVoids)) {
    if (v.eventType !== 'DELIVERY' || !v.attendantId) continue;
    const inServer = eventStates[v.key];
    if (inServer && !inServer.isVoided) {
      result[v.attendantId] = Math.max(0, (result[v.attendantId] || 1) - 1);
    }
  }

  return result;
}

/**
 * Mapa derivado de atendimentos ativos por attendantId.
 * Aplica em ordem cronológica as operações locais sobre o snapshot do servidor,
 * eliminando qualquer "pisca" (flicker) entre Iniciar e Finalizar durante o polling.
 */
export function selectActiveServices(state: LedgerState): Record<string, DerivedActiveService> {
  if (state.closed || state.snapshot?.status === 'FINISHED') {
    return {};
  }

  const byAttendant: Record<string, DerivedActiveService> = {};
  for (const srv of state.snapshot?.activeServices ?? []) {
    byAttendant[srv.attendantId] = {
      id: srv.id,
      attendantId: srv.attendantId,
      startedAt: srv.startedAt,
      isPending: false,
    };
  }

  // Aplica ops em ordem cronológica (da mais antiga para a mais recente)
  const chronological = [...state.ops]
    .filter((op) => ACTIVE_OP_STATUSES.has(op.status) && op.attendantId)
    .reverse();

  for (const op of chronological) {
    const attId = op.attendantId!;
    if (op.kind === 'SERVICE_START') {
      const existing = byAttendant[attId];
      byAttendant[attId] = {
        id: op.serverIntervalId || existing?.id || op.key,
        attendantId: attId,
        // Preserva o timestamp inicial para o cronômetro nunca saltar
        startedAt: op.startedAt || op.occurredAt || existing?.startedAt,
        isPending: op.status !== 'confirmed' && !existing,
      };
    } else if (op.kind === 'SERVICE_FINISH') {
      const inServer = state.snapshot?.eventStates?.[op.key];
      if (!inServer) {
        delete byAttendant[attId];
      }
    }
  }

  return byAttendant;
}

function calcDurationSeconds(startedAt?: string, endedAt?: string): number {
  if (!startedAt || !endedAt) return 0;
  const s = Date.parse(startedAt);
  const e = Date.parse(endedAt);
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 1000));
}

/**
 * Lista unificada de registros para o mini-log ("Últimos Registros").
 * Mantém React key estável (`idempotencyKey`) desde o clique ("Registrando...") até o status permanente.
 */
export function selectLogItems(state: LedgerState, limit = 12): DerivedLogItem[] {
  const items: DerivedLogItem[] = [];
  const seenKeys = new Set<string>();
  const serverEventsByKey = new Map<string, EventItem>();

  for (const ev of state.snapshot?.recentEvents ?? []) {
    const k = ev.idempotencyKey || ev.id;
    serverEventsByKey.set(k, ev);
  }

  for (const op of state.ops) {
    // Q1: "Iniciando atendimento..." é transitório — aparece enquanto grava ou se falhar, e some ao confirmar
    if (op.kind === 'SERVICE_START') {
      if (op.status === 'confirmed') continue;
      seenKeys.add(op.key);
      items.push({
        key: op.key,
        kind: 'SERVICE_START',
        syncStatus: op.status,
        occurredAt: op.occurredAt,
        startedAt: op.startedAt || op.occurredAt,
        attendantId: op.attendantId,
        attendant: op.attendant
          ? { code: op.attendant.code, displayName: op.attendant.displayName }
          : null,
        isVoided: false,
        error: op.error,
      });
      continue;
    }

    const serverEv = serverEventsByKey.get(op.key) || op.serverEvent;
    const voidPending = Boolean(state.pendingVoids[op.key]);
    const inStates = state.snapshot?.eventStates?.[op.key];
    const isVoided = Boolean(serverEv?.isVoided || inStates?.isVoided || voidPending);

    seenKeys.add(op.key);

    const startedAt =
      serverEv?.metadata?.startedAt ||
      op.startedAt ||
      op.metadata?.startedAt ||
      op.occurredAt;
    const endedAt = serverEv?.occurredAt || op.occurredAt;
    const durationSeconds =
      serverEv?.metadata?.durationSeconds !== undefined
        ? serverEv.metadata.durationSeconds
        : calcDurationSeconds(startedAt, endedAt);

    items.push({
      key: op.key,
      eventId: serverEv?.id || op.serverEventId || inStates?.id,
      kind: op.kind === 'ARRIVAL' ? 'ARRIVAL' : 'DELIVERY',
      syncStatus: serverEv || inStates ? 'confirmed' : op.status,
      occurredAt: endedAt,
      startedAt,
      durationSeconds,
      attendantId: op.attendantId ?? serverEv?.attendantId,
      attendant:
        serverEv?.attendant ||
        (op.attendant ? { code: op.attendant.code, displayName: op.attendant.displayName } : null),
      queueId: op.queueId ?? serverEv?.queueId,
      queue: serverEv?.queue || (op.queueName ? { name: op.queueName } : null),
      isVoided,
      isVoidPending: voidPending,
      error: op.error,
    });
  }

  for (const ev of state.snapshot?.recentEvents ?? []) {
    const k = ev.idempotencyKey || ev.id;
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);

    const voidPending = Boolean(state.pendingVoids[k]);
    const inStates = state.snapshot?.eventStates?.[k];
    const isVoided = Boolean(ev.isVoided || inStates?.isVoided || voidPending);
    const startedAt = ev.metadata?.startedAt || ev.occurredAt;
    const durationSeconds =
      ev.metadata?.durationSeconds !== undefined
        ? ev.metadata.durationSeconds
        : calcDurationSeconds(startedAt, ev.occurredAt);

    items.push({
      key: k,
      eventId: ev.id,
      kind: ev.eventType === 'ARRIVAL' ? 'ARRIVAL' : 'DELIVERY',
      syncStatus: 'confirmed',
      occurredAt: ev.occurredAt,
      startedAt,
      durationSeconds,
      attendantId: ev.attendantId,
      attendant: ev.attendant || null,
      queueId: ev.queueId,
      queue: ev.queue || null,
      isVoided,
      isVoidPending: voidPending,
    });
  }

  items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return items.slice(0, limit);
}

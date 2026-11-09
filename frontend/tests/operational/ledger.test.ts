import { describe, it, expect } from 'vitest';
import {
  createInitialLedgerState,
  normalizeRawSnapshot,
  reduceLedger,
  selectActiveServices,
  selectArrivals,
  selectDeliveries,
  selectLogItems,
  LedgerOp,
} from '../../src/operational/ledger.js';

function makeArrivalOp(key: string, occurredAt = '2026-11-09T12:00:01.000Z'): LedgerOp {
  return {
    key,
    kind: 'ARRIVAL',
    collectionId: 'col-1',
    occurredAt,
    status: 'sending',
    retryCount: 0,
  };
}

describe('Operational Ledger (Estado Derivado e Idempotência)', () => {
  it('3 cliques rápidos somam exatamente +3 e não duplicam ao confirmar via HTTP + Poll', () => {
    let state = createInitialLedgerState();

    // Snapshot inicial do servidor com 10 chegadas
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          serverTime: '2026-11-09T12:00:00.000Z',
          eventCounts: { arrivals: 10, deliveriesByAttendant: {} },
          eventStates: [],
          activeServices: [],
          recentEvents: [],
        },
        1
      ),
    });
    expect(selectArrivals(state)).toBe(10);

    // 3 cliques rápidos
    state = reduceLedger(state, { type: 'OP_ENQUEUED', op: makeArrivalOp('arr-1', '2026-11-09T12:00:01.000Z') });
    state = reduceLedger(state, { type: 'OP_ENQUEUED', op: makeArrivalOp('arr-2', '2026-11-09T12:00:02.000Z') });
    state = reduceLedger(state, { type: 'OP_ENQUEUED', op: makeArrivalOp('arr-3', '2026-11-09T12:00:03.000Z') });

    expect(selectArrivals(state)).toBe(13);
    expect(selectLogItems(state)).toHaveLength(3);
    expect(selectLogItems(state)[0].syncStatus).toBe('sending');

    // Resposta HTTP confirma arr-1 (com uuid diferente do idempotencyKey)
    state = reduceLedger(state, {
      type: 'OP_STATUS_CHANGED',
      key: 'arr-1',
      status: 'confirmed',
      serverEventId: 'uuid-real-1',
      serverEvent: {
        id: 'uuid-real-1',
        collectionId: 'col-1',
        eventType: 'ARRIVAL',
        occurredAt: '2026-11-09T12:00:01.000Z',
        recordedAt: '2026-11-09T12:00:01.100Z',
        idempotencyKey: 'arr-1',
        isVoided: false,
      },
    });
    // Continua 13 (não soma +1 de novo!)
    expect(selectArrivals(state)).toBe(13);

    // Poll chega antes do HTTP de arr-2 terminar, trazendo arr-1 e arr-2 já gravados no banco (total servidor = 12)
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          serverTime: '2026-11-09T12:00:02.500Z',
          eventCounts: { arrivals: 12, deliveriesByAttendant: {} },
          eventStates: [
            ['arr-1', false, 'uuid-real-1'],
            ['arr-2', false, 'uuid-real-2'],
          ],
          activeServices: [],
          recentEvents: [
            {
              id: 'uuid-real-2',
              collectionId: 'col-1',
              eventType: 'ARRIVAL',
              occurredAt: '2026-11-09T12:00:02.000Z',
              recordedAt: '2026-11-09T12:00:02.100Z',
              idempotencyKey: 'arr-2',
              isVoided: false,
            },
            {
              id: 'uuid-real-1',
              collectionId: 'col-1',
              eventType: 'ARRIVAL',
              occurredAt: '2026-11-09T12:00:01.000Z',
              recordedAt: '2026-11-09T12:00:01.100Z',
              idempotencyKey: 'arr-1',
              isVoided: false,
            },
          ],
        },
        2
      ),
    });

    // Servidor tem 12 (arr-1, arr-2) + 1 local ainda não no snapshot (arr-3) = 13!
    expect(selectArrivals(state)).toBe(13);
    const logs = selectLogItems(state);
    expect(logs).toHaveLength(3);
    expect(logs.map((l) => l.key)).toEqual(['arr-3', 'arr-2', 'arr-1']);
  });

  it('ignora snapshots fora de ordem (seq menor que o atual)', () => {
    let state = createInitialLedgerState();
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 5, deliveriesByAttendant: {} },
        },
        10
      ),
    });
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 2, deliveriesByAttendant: {} },
        },
        9
      ),
    });
    expect(selectArrivals(state)).toBe(5);
  });

  it('corrige contagem para baixo quando novo snapshot autoritativo tem menos eventos (sem Math.max)', () => {
    let state = createInitialLedgerState();
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 8, deliveriesByAttendant: { 'att-1': 4 } },
        },
        1
      ),
    });
    expect(selectArrivals(state)).toBe(8);
    expect(selectDeliveries(state)['att-1']).toBe(4);

    // Outro dispositivo anulou um evento -> snapshot seguinte vem com 7 e 3
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 7, deliveriesByAttendant: { 'att-1': 3 } },
        },
        2
      ),
    });
    expect(selectArrivals(state)).toBe(7);
    expect(selectDeliveries(state)['att-1']).toBe(3);
  });

  it('não pisca o botão do atendente quando um poll antigo traz activeServices vazio durante start/finish', () => {
    let state = createInitialLedgerState();
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 0, deliveriesByAttendant: { 'att-1': 0 } },
          activeServices: [],
        },
        1
      ),
    });

    // Inicia atendimento
    state = reduceLedger(state, {
      type: 'OP_ENQUEUED',
      op: {
        key: 'srv-start-1',
        kind: 'SERVICE_START',
        collectionId: 'col-1',
        attendantId: 'att-1',
        occurredAt: '2026-11-09T12:00:10.000Z',
        startedAt: '2026-11-09T12:00:10.000Z',
        status: 'sending',
        retryCount: 0,
      },
    });
    expect(selectActiveServices(state)['att-1']).toBeDefined();
    expect(selectActiveServices(state)['att-1'].startedAt).toBe('2026-11-09T12:00:10.000Z');

    // Poll chega antes do POST terminar no banco (activeServices ainda vazio no servidor)
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 0, deliveriesByAttendant: { 'att-1': 0 } },
          activeServices: [],
        },
        2
      ),
    });
    // Continua ocupado sem piscar!
    expect(selectActiveServices(state)['att-1']).toBeDefined();

    // Finaliza atendimento em seguida
    state = reduceLedger(state, {
      type: 'OP_ENQUEUED',
      op: {
        key: 'srv-fin-1',
        kind: 'SERVICE_FINISH',
        collectionId: 'col-1',
        attendantId: 'att-1',
        occurredAt: '2026-11-09T12:00:18.000Z',
        startedAt: '2026-11-09T12:00:10.000Z',
        status: 'sending',
        retryCount: 0,
      },
    });
    // Fica livre imediatamente e soma +1 entrega
    expect(selectActiveServices(state)['att-1']).toBeUndefined();
    expect(selectDeliveries(state)['att-1']).toBe(1);

    // Poll intermediário traz o atendimento ainda ativo no servidor (antes do finish commitar)
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 0, deliveriesByAttendant: { 'att-1': 0 } },
          activeServices: [
            { id: 'int-1', attendantId: 'att-1', startedAt: '2026-11-09T12:00:10.000Z' },
          ],
          eventStates: [],
        },
        3
      ),
    });
    // Continua livre (não volta para ocupado!) e entrega continua 1
    expect(selectActiveServices(state)['att-1']).toBeUndefined();
    expect(selectDeliveries(state)['att-1']).toBe(1);
  });

  it('reverte automaticamente o contador quando a operação falha ou é rejeitada', () => {
    let state = createInitialLedgerState();
    state = reduceLedger(state, { type: 'OP_ENQUEUED', op: makeArrivalOp('arr-fail') });
    expect(selectArrivals(state)).toBe(1);

    state = reduceLedger(state, {
      type: 'OP_STATUS_CHANGED',
      key: 'arr-fail',
      status: 'failed',
      error: 'Erro de conexão',
    });
    expect(selectArrivals(state)).toBe(0);
    expect(selectLogItems(state)[0].syncStatus).toBe('failed');
  });

  it('mata todos os atendimentos ativos e rejeita operações na fila quando a aferição encerra', () => {
    let state = createInitialLedgerState();
    state = reduceLedger(state, {
      type: 'SNAPSHOT_APPLIED',
      snapshot: normalizeRawSnapshot(
        {
          status: 'IN_PROGRESS',
          eventCounts: { arrivals: 3, deliveriesByAttendant: {} },
          activeServices: [
            { id: 'int-1', attendantId: 'att-1', startedAt: '2026-11-09T12:00:00.000Z' },
          ],
        },
        1
      ),
    });
    state = reduceLedger(state, {
      type: 'OP_ENQUEUED',
      op: { ...makeArrivalOp('arr-queued'), status: 'queued' },
    });

    state = reduceLedger(state, { type: 'COLLECTION_CLOSED' });
    expect(selectActiveServices(state)).toEqual({});
    expect(selectArrivals(state)).toBe(3);
    expect(selectLogItems(state)[0].syncStatus).toBe('rejected');
  });
});

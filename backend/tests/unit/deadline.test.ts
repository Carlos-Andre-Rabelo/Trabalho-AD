import { describe, it, expect } from 'vitest';
import {
  computeDeadline,
  computeOperationalElapsedMs,
  computeRemainingMs,
  isDeadlineExpired,
} from '../../src/modules/collections/collectionLifecycle.js';

describe('Ciclo de Vida e Deadline Autoritativo da Coleta', () => {
  it('retorna null quando a coleta não possui limite de tempo', () => {
    const col = {
      status: 'IN_PROGRESS',
      startedAt: '2026-11-09T12:00:00.000Z',
      notes: null,
      targetDurationMinutes: null,
    };
    expect(computeDeadline(col)).toBeNull();
    expect(computeRemainingMs(col)).toBeNull();
    expect(isDeadlineExpired(col)).toBe(false);
  });

  it('calcula deadline exato sem pausas', () => {
    const startMs = Date.parse('2026-11-09T12:00:00.000Z');
    const col = {
      status: 'IN_PROGRESS',
      startedAt: new Date(startMs).toISOString(),
      targetDurationMinutes: 15,
      pauses: [],
    };
    const deadline = computeDeadline(col, startMs + 5 * 60_000);
    expect(deadline?.toISOString()).toBe('2026-11-09T12:15:00.000Z');
    expect(computeRemainingMs(col, startMs + 5 * 60_000)).toBe(10 * 60_000);
    expect(isDeadlineExpired(col, startMs + 14 * 60_000)).toBe(false);
    expect(isDeadlineExpired(col, startMs + 15 * 60_000)).toBe(true);
  });

  it('desconta pausas fechadas e abertas do tempo operacional e empurra o deadline', () => {
    const startMs = Date.parse('2026-11-09T12:00:00.000Z');
    const col = {
      status: 'IN_PROGRESS',
      startedAt: new Date(startMs).toISOString(),
      targetDurationMinutes: 10,
      pauses: [
        {
          startedAt: new Date(startMs + 2 * 60_000).toISOString(),
          endedAt: new Date(startMs + 5 * 60_000).toISOString(), // 3 min de pausa
        },
      ],
    };

    // Aos 11 min de relógio corrido, apenas 8 min operacionais se passaram
    const checkMs = startMs + 11 * 60_000;
    expect(computeOperationalElapsedMs(col, checkMs)).toBe(8 * 60_000);
    expect(computeRemainingMs(col, checkMs)).toBe(2 * 60_000);
    expect(computeDeadline(col, checkMs)?.toISOString()).toBe('2026-11-09T12:13:00.000Z');
    expect(isDeadlineExpired(col, checkMs)).toBe(false);

    // Aos 13 min de relógio corrido (10 min operacionais + 3 min pausa), atinge o deadline
    const endCheckMs = startMs + 13 * 60_000;
    expect(isDeadlineExpired(col, endCheckMs)).toBe(true);
    expect(computeRemainingMs(col, endCheckMs)).toBe(0);
  });

  it('extrai targetDurationMinutes do JSON de notes quando não informado diretamente', () => {
    const startMs = Date.parse('2026-11-09T12:00:00.000Z');
    const col = {
      status: 'IN_PROGRESS',
      startedAt: new Date(startMs).toISOString(),
      notes: JSON.stringify({ notesText: 'Almoço', targetDurationMinutes: 20 }),
    };
    expect(computeDeadline(col, startMs)?.toISOString()).toBe('2026-11-09T12:20:00.000Z');
  });
});

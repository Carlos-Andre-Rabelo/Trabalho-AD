import { describe, it, expect } from 'vitest';
import { computeCollectionMetrics, calculateSummary } from '../../src/utils/statistics.js';

describe('Cálculo de Métricas Estatísticas e Teoria das Filas (RU Metrics)', () => {
  it('deve calcular estatísticas descritivas (média, mediana, desvio padrão, percentis) corretamente', () => {
    const data = [30, 40, 50, 60, 70];
    const summary = calculateSummary(data);

    expect(summary.count).toBe(5);
    expect(summary.mean).toBe(50);
    expect(summary.median).toBe(50);
    expect(summary.min).toBe(30);
    expect(summary.max).toBe(70);
    expect(summary.stdDev).toBeCloseTo(15.81, 1);
  });

  it('deve retornar campos nulos com segurança quando não houver dados de duração (evita divisão por zero)', () => {
    const summary = calculateSummary([]);

    expect(summary.count).toBe(0);
    expect(summary.mean).toBeNull();
    expect(summary.median).toBeNull();
    expect(summary.stdDev).toBeNull();
  });

  it('deve descontar pausas operacionais corretamente do tempo total', () => {
    const startedAt = new Date('2026-10-27T10:00:00Z');
    const endedAt = new Date('2026-10-27T11:00:00Z'); // 60 minutos total

    // Pausa de 10 minutos (10:20 a 10:30)
    const pauses = [
      {
        startedAt: new Date('2026-10-27T10:20:00Z'),
        endedAt: new Date('2026-10-27T10:30:00Z'),
      },
    ];

    const metrics = computeCollectionMetrics({
      startedAt,
      endedAt,
      currentStatus: 'FINISHED',
      pauses,
      events: [],
      serviceIntervals: [],
      attendants: [{ id: 'att-1', code: 'A', displayName: 'Atendente A' }],
      proteinMeasurements: [],
    });

    expect(metrics.timeMetrics.totalDurationSeconds).toBe(3600); // 60 min
    expect(metrics.timeMetrics.pauseDurationSeconds).toBe(600); // 10 min
    expect(metrics.timeMetrics.operationalDurationSeconds).toBe(3000); // 50 min
    expect(metrics.timeMetrics.operationalDurationMinutes).toBe(50);
  });

  it('deve calcular Throughput (X = N / T) e Taxa de Chegada (lambda = A / T) apenas a partir de eventos válidos', () => {
    const startedAt = new Date('2026-10-27T10:00:00Z');
    const endedAt = new Date('2026-10-27T10:30:00Z'); // 30 minutos

    const attendants = [
      { id: 'att-1', code: 'A', displayName: 'Atendente A' },
      { id: 'att-2', code: 'B', displayName: 'Atendente B' },
    ];

    const events = [
      // 10 Chegadas
      ...Array.from({ length: 10 }).map((_, i) => ({
        id: `arr-${i}`,
        eventType: 'ARRIVAL' as const,
        attendantId: null,
        isVoided: false,
        occurredAt: new Date('2026-10-27T10:05:00Z'),
      })),
      // 1 Chegada anulada (NÃO deve contar)
      {
        id: 'arr-voided',
        eventType: 'ARRIVAL' as const,
        attendantId: null,
        isVoided: true,
        occurredAt: new Date('2026-10-27T10:06:00Z'),
      },
      // 15 Entregas Atendente A
      ...Array.from({ length: 15 }).map((_, i) => ({
        id: `del-a-${i}`,
        eventType: 'DELIVERY' as const,
        attendantId: 'att-1',
        isVoided: false,
        occurredAt: new Date('2026-10-27T10:10:00Z'),
      })),
      // 10 Entregas Atendente B
      ...Array.from({ length: 10 }).map((_, i) => ({
        id: `del-b-${i}`,
        eventType: 'DELIVERY' as const,
        attendantId: 'att-2',
        isVoided: false,
        occurredAt: new Date('2026-10-27T10:15:00Z'),
      })),
      // 2 Entregas anuladas (NÃO devem contar)
      {
        id: 'del-void-1',
        eventType: 'DELIVERY' as const,
        attendantId: 'att-1',
        isVoided: true,
        occurredAt: new Date('2026-10-27T10:16:00Z'),
      },
    ];

    const metrics = computeCollectionMetrics({
      startedAt,
      endedAt,
      currentStatus: 'FINISHED',
      pauses: [],
      events,
      serviceIntervals: [],
      attendants,
      proteinMeasurements: [],
    });

    // Total de Chegadas Válidas = 10 em 30 min -> lambda = 0.33/min
    expect(metrics.arrivalMetrics.totalArrivals).toBe(10);
    expect(metrics.arrivalMetrics.arrivalsPerMinute).toBe(0.33);

    // Total de Entregas Válidas = 25 em 30 min -> X = 0.83/min
    expect(metrics.overallThroughput.totalDeliveries).toBe(25);
    expect(metrics.overallThroughput.deliveriesPerMinute).toBe(0.83);

    // Atendente A = 15 entregas (60% do total)
    const attA = metrics.attendantsMetrics.find((a) => a.code === 'A')!;
    expect(attA.deliveriesCount).toBe(15);
    expect(attA.deliveriesPerMinute).toBe(0.5);
    expect(attA.percentOfTotalDeliveries).toBe(60);

    // Atendente B = 10 entregas (40% do total)
    const attB = metrics.attendantsMetrics.find((a) => a.code === 'B')!;
    expect(attB.deliveriesCount).toBe(10);
    expect(attB.deliveriesPerMinute).toBe(0.33);
    expect(attB.percentOfTotalDeliveries).toBe(40);
  });

  it('deve conter aviso metodológico na comparação sem inferir superioridade estatística', () => {
    const startedAt = new Date('2026-10-27T10:00:00Z');
    const endedAt = new Date('2026-10-27T10:20:00Z');

    const attendants = [
      { id: '1', code: 'A', displayName: 'Atendente A' },
      { id: '2', code: 'B', displayName: 'Atendente B' },
    ];

    const metrics = computeCollectionMetrics({
      startedAt,
      endedAt,
      currentStatus: 'FINISHED',
      pauses: [],
      events: [
        { id: '1', eventType: 'DELIVERY', attendantId: '1', isVoided: false, occurredAt: startedAt },
        { id: '2', eventType: 'DELIVERY', attendantId: '1', isVoided: false, occurredAt: startedAt },
        { id: '3', eventType: 'DELIVERY', attendantId: '2', isVoided: false, occurredAt: startedAt },
      ],
      serviceIntervals: [],
      attendants,
      proteinMeasurements: [],
    });

    expect(metrics.comparison.hasTwoAttendants).toBe(true);
    expect(metrics.comparison.differenceAbsoluteDeliveries).toBe(1);
    expect(metrics.comparison.disclaimer).toContain('Aviso Acadêmico');
    expect(metrics.comparison.disclaimer).toContain('Não produza inferências de superioridade individual ou significância estatística');
  });

  it('deve detectar instabilidade estocástica na teoria das filas quando lambda >= capacidade', () => {
    const startedAt = new Date('2026-10-27T10:00:00Z');
    const endedAt = new Date('2026-10-27T10:20:00Z'); // 20 minutos

    // 40 chegadas em 20 min (lambda = 2.0/min)
    const arrivals = Array.from({ length: 40 }).map((_, i) => ({
      id: `arr-${i}`,
      eventType: 'ARRIVAL' as const,
      attendantId: null,
      isVoided: false,
      occurredAt: startedAt,
    }));

    // Apenas 10 entregas em 20 min (capacidade observada = 0.5/min)
    const deliveries = Array.from({ length: 10 }).map((_, i) => ({
      id: `del-${i}`,
      eventType: 'DELIVERY' as const,
      attendantId: '1',
      isVoided: false,
      occurredAt: startedAt,
    }));

    const metrics = computeCollectionMetrics({
      startedAt,
      endedAt,
      currentStatus: 'FINISHED',
      pauses: [],
      events: [...arrivals, ...deliveries],
      serviceIntervals: [],
      attendants: [{ id: '1', code: 'A', displayName: 'Atendente A' }],
      proteinMeasurements: [],
    });

    expect(metrics.queueTheory.stabilityState).toBe('SATURATED_OR_UNSTABLE');
    expect(metrics.sampleIntegrity.limitations.some((l) => l.includes('Alerta de Estabilidade'))).toBe(true);
  });
});

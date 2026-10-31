/**
 * Módulo de Métricas Estatísticas e Teoria das Filas para o RU Metrics.
 * Implementa rigorosamente as regras do documento de requisitos:
 * - Throughput X = N / T
 * - Taxa de chegada lambda = A / T
 * - Tempo de serviço (média, mediana, percentis, variância)
 * - Utilização do atendente U = B / T
 * - Análise da Lei de Little (L = lambda * W) com condições de estabilidade
 * - Comparação entre atendentes com ressalvas metodológicas
 */

export interface StatisticalSummary {
  count: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
}

export function calculateSummary(values: number[]): StatisticalSummary {
  if (!values || values.length === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      stdDev: null,
      min: null,
      max: null,
      p25: null,
      p75: null,
      p90: null,
      p95: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  // Variância e Desvio Padrão Amostral (se n > 1)
  let stdDev: number | null = null;
  if (n > 1) {
    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
    stdDev = Math.sqrt(variance);
  } else {
    stdDev = 0;
  }

  const getPercentile = (p: number): number => {
    if (n === 1) return sorted[0];
    const index = (p / 100) * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    count: n,
    mean: Number(mean.toFixed(2)),
    median: Number(getPercentile(50).toFixed(2)),
    stdDev: stdDev !== null ? Number(stdDev.toFixed(2)) : null,
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[n - 1].toFixed(2)),
    p25: Number(getPercentile(25).toFixed(2)),
    p75: Number(getPercentile(75).toFixed(2)),
    p90: Number(getPercentile(90).toFixed(2)),
    p95: Number(getPercentile(95).toFixed(2)),
  };
}

export interface CollectionCalculatedMetrics {
  timeMetrics: {
    totalDurationSeconds: number;
    pauseDurationSeconds: number;
    operationalDurationSeconds: number; // T
    operationalDurationMinutes: number;
    operationalDurationHours: number;
  };
  overallThroughput: {
    totalDeliveries: number; // N
    deliveriesPerMinute: number | null; // X (min)
    deliveriesPerHour: number | null; // X (hora)
  };
  arrivalMetrics: {
    totalArrivals: number; // A
    arrivalsPerMinute: number | null; // lambda (min)
    arrivalsPerHour: number | null; // lambda (hora)
  };
  attendantsMetrics: Array<{
    attendantId: string;
    code: string;
    displayName: string;
    deliveriesCount: number;
    deliveriesPerMinute: number | null;
    deliveriesPerHour: number | null;
    percentOfTotalDeliveries: number;
    serviceTimeSeconds: StatisticalSummary; // Baseado em cronometragens
    busyDurationSeconds: number;
    utilizationPercent: number | null; // U
  }>;
  comparison: {
    hasTwoAttendants: boolean;
    disclaimer: string;
    differenceAbsoluteDeliveries?: number;
    differenceRelativePercent?: number;
    fasterAttendantCode?: string;
    throughputComparisonText?: string;
  };
  queueTheory: {
    isApplicable: boolean;
    reasonIfNotApplicable?: string;
    lambdaPerMinute: number | null;
    muPerAttendantPerMinute: number | null;
    totalCapacityPerMinute: number | null;
    trafficIntensityRho: number | null; // lambda / (c * mu)
    stabilityState: 'STABLE' | 'SATURATED_OR_UNSTABLE' | 'INSUFFICIENT_DATA';
    littlesLaw: {
      averageItemsInSystemL: number | null;
      averageTimeInSystemWMinutes: number | null;
      formula: string;
      notes: string;
    };
  };
  proteinMetrics?: {
    totalMeasurements: number;
    totalGramsMeasured: number;
    averageGramsPerServing: number | null;
    minGrams: number | null;
    maxGrams: number | null;
  };
  sampleIntegrity: {
    isSampleSufficient: boolean;
    limitations: string[];
  };
}

export interface CalculateMetricsInput {
  startedAt: Date | null;
  endedAt: Date | null;
  currentStatus: string;
  now?: Date;
  pauses: Array<{ startedAt: Date; endedAt: Date | null }>;
  events: Array<{
    id: string;
    eventType: 'ARRIVAL' | 'DELIVERY' | 'OBSERVATION';
    attendantId: string | null;
    isVoided: boolean;
    occurredAt: Date;
  }>;
  serviceIntervals: Array<{
    id: string;
    attendantId: string;
    durationMs: number | null;
    startedAt: Date;
    endedAt: Date | null;
    status: string;
  }>;
  attendants: Array<{
    id: string;
    code: string;
    displayName: string;
  }>;
  proteinMeasurements: Array<{
    amount: number;
    unit: string;
    measurementMethod: string;
  }>;
}

export function computeCollectionMetrics(input: CalculateMetricsInput): CollectionCalculatedMetrics {
  const {
    startedAt,
    endedAt,
    currentStatus,
    now = new Date(),
    pauses,
    events,
    serviceIntervals,
    attendants,
    proteinMeasurements,
  } = input;

  const limitations: string[] = [];

  // 1. Cálculo de Tempos (Total, Pausas e Operacional)
  let totalDurationMs = 0;
  if (startedAt) {
    const endReference = endedAt || (currentStatus === 'IN_PROGRESS' || currentStatus === 'PAUSED' ? now : startedAt);
    totalDurationMs = Math.max(0, endReference.getTime() - new Date(startedAt).getTime());
  }

  let pauseDurationMs = 0;
  for (const pause of pauses) {
    const pStart = new Date(pause.startedAt).getTime();
    const pEnd = pause.endedAt ? new Date(pause.endedAt).getTime() : now.getTime();
    pauseDurationMs += Math.max(0, pEnd - pStart);
  }

  const operationalDurationMs = Math.max(0, totalDurationMs - pauseDurationMs);
  const operationalDurationSeconds = Math.floor(operationalDurationMs / 1000);
  const operationalDurationMinutes = operationalDurationSeconds / 60;
  const operationalDurationHours = operationalDurationMinutes / 60;

  if (operationalDurationSeconds <= 0) {
    limitations.push('A coleta não possui tempo operacional acumulado suficiente para taxas temporais.');
  }

  // 2. Filtrar Eventos Válidos (Desconsiderando Voids)
  const validEvents = events.filter((e) => !e.isVoided);
  const arrivalEvents = validEvents.filter((e) => e.eventType === 'ARRIVAL');
  const deliveryEvents = validEvents.filter((e) => e.eventType === 'DELIVERY');

  const totalDeliveries = deliveryEvents.length;
  const totalArrivals = arrivalEvents.length;

  // 3. Throughput Geral (X = N / T)
  const deliveriesPerMinute = operationalDurationMinutes > 0 ? Number((totalDeliveries / operationalDurationMinutes).toFixed(2)) : null;
  const deliveriesPerHour = operationalDurationHours > 0 ? Number((totalDeliveries / operationalDurationHours).toFixed(2)) : null;

  // 4. Taxa de Chegada (lambda = A / T)
  const arrivalsPerMinute = operationalDurationMinutes > 0 ? Number((totalArrivals / operationalDurationMinutes).toFixed(2)) : null;
  const arrivalsPerHour = operationalDurationHours > 0 ? Number((totalArrivals / operationalDurationHours).toFixed(2)) : null;

  if (totalArrivals === 0) {
    limitations.push('Nenhuma chegada de estudante foi registrada nesta coleta. Taxa de chegada é desconhecida.');
  }

  // 5. Métricas por Atendente
  const attendantsMetrics = attendants.map((attendant) => {
    const attDeliveries = deliveryEvents.filter((e) => e.attendantId === attendant.id);
    const count = attDeliveries.length;

    const attDpm = operationalDurationMinutes > 0 ? Number((count / operationalDurationMinutes).toFixed(2)) : null;
    const attDph = operationalDurationHours > 0 ? Number((count / operationalDurationHours).toFixed(2)) : null;
    const percentOfTotal = totalDeliveries > 0 ? Number(((count / totalDeliveries) * 100).toFixed(1)) : 0;

    // Intervalos de serviço cronometrados deste atendente
    const completedIntervals = serviceIntervals.filter(
      (s) => s.attendantId === attendant.id && s.status === 'COMPLETED' && s.durationMs !== null && s.durationMs > 0
    );

    const durationsSeconds = completedIntervals.map((s) => s.durationMs! / 1000);
    const serviceTimeSummary = calculateSummary(durationsSeconds);

    // Tempo Ocupado (Busy Duration)
    const busyDurationMs = completedIntervals.reduce((acc, s) => acc + s.durationMs!, 0);
    const busyDurationSeconds = Math.floor(busyDurationMs / 1000);

    const utilizationPercent =
      operationalDurationSeconds > 0 && durationsSeconds.length > 0
        ? Number(Math.min(100, (busyDurationSeconds / operationalDurationSeconds) * 100).toFixed(1))
        : null;

    return {
      attendantId: attendant.id,
      code: attendant.code,
      displayName: attendant.displayName,
      deliveriesCount: count,
      deliveriesPerMinute: attDpm,
      deliveriesPerHour: attDph,
      percentOfTotalDeliveries: percentOfTotal,
      serviceTimeSeconds: serviceTimeSummary,
      busyDurationSeconds,
      utilizationPercent,
    };
  });

  // 6. Comparação entre Atendentes (com Ressalva Metodológica)
  let comparison = {
    hasTwoAttendants: attendants.length === 2,
    disclaimer:
      'Aviso Acadêmico: As diferenças observadas são puramente descritivas da amostra observada. Não produza inferências de superioridade individual ou significância estatística sem conduzir testes de hipótese adequados (ex.: t-Student ou Mann-Whitney) e controlar variáveis como composição da fila e tipo de porção servida.',
    differenceAbsoluteDeliveries: undefined as number | undefined,
    differenceRelativePercent: undefined as number | undefined,
    fasterAttendantCode: undefined as string | undefined,
    throughputComparisonText: undefined as string | undefined,
  };

  if (attendants.length === 2) {
    const a1 = attendantsMetrics[0];
    const a2 = attendantsMetrics[1];
    const diff = Math.abs(a1.deliveriesCount - a2.deliveriesCount);
    const minCount = Math.min(a1.deliveriesCount, a2.deliveriesCount);
    const relPercent = minCount > 0 ? Number(((diff / minCount) * 100).toFixed(1)) : 0;

    comparison.differenceAbsoluteDeliveries = diff;
    comparison.differenceRelativePercent = relPercent;

    if (a1.deliveriesCount > a2.deliveriesCount) {
      comparison.throughputComparisonText = `${a1.displayName} registrou ${diff} entregas a mais que ${a2.displayName} (${relPercent}% maior no período).`;
    } else if (a2.deliveriesCount > a1.deliveriesCount) {
      comparison.throughputComparisonText = `${a2.displayName} registrou ${diff} entregas a mais que ${a1.displayName} (${relPercent}% maior no período).`;
    } else {
      comparison.throughputComparisonText = `Ambos os atendentes registraram o mesmo número de entregas (${a1.deliveriesCount}).`;
    }
  }

  // 7. Teoria das Filas e Lei de Little (L = lambda * W)
  const isApplicable =
    operationalDurationMinutes >= 5 &&
    totalArrivals >= 10 &&
    totalDeliveries >= 10 &&
    arrivalsPerMinute !== null;

  let queueTheory: CollectionCalculatedMetrics['queueTheory'] = {
    isApplicable,
    reasonIfNotApplicable: !isApplicable
      ? 'Amostra insuficiente ou duração operacional inferior a 5 minutos. A Teoria das Filas e a Lei de Little requerem regime permanente e estabilidade estocástica.'
      : undefined,
    lambdaPerMinute: arrivalsPerMinute,
    muPerAttendantPerMinute: null,
    totalCapacityPerMinute: null,
    trafficIntensityRho: null,
    stabilityState: 'INSUFFICIENT_DATA',
    littlesLaw: {
      averageItemsInSystemL: null,
      averageTimeInSystemWMinutes: null,
      formula: 'L = λ * W (Lei de Little)',
      notes:
        'W representa o tempo médio que o estudante permanece no sistema (espera na fila + atendimento). Se não houver pareamento ponta a ponta de chegada a saída, L e W são aproximações teóricas.',
    },
  };

  if (isApplicable && arrivalsPerMinute !== null && operationalDurationMinutes > 0) {
    const c = attendants.length || 1;
    // Estimar mu a partir do throughput ou de tempos médios de serviço
    const totalDeliveriesPerMin = deliveriesPerMinute || 0;
    const muIndividual = c > 0 ? totalDeliveriesPerMin / c : totalDeliveriesPerMin;
    const totalCapacity = muIndividual * c;

    queueTheory.muPerAttendantPerMinute = Number(muIndividual.toFixed(2));
    queueTheory.totalCapacityPerMinute = Number(totalCapacity.toFixed(2));

    if (totalCapacity > 0) {
      const rho = arrivalsPerMinute / totalCapacity;
      queueTheory.trafficIntensityRho = Number(rho.toFixed(2));

      if (rho >= 1.0) {
        queueTheory.stabilityState = 'SATURATED_OR_UNSTABLE';
        limitations.push(
          `Alerta de Estabilidade: Taxa de chegada (λ = ${arrivalsPerMinute}/min) é superior ou igual à capacidade total observada (c·μ = ${totalCapacity}/min). O sistema é estocasticamente instável (fila tenderá a crescer continuamente).`
        );
      } else {
        queueTheory.stabilityState = 'STABLE';
      }
    }
  }

  // 8. Medições de Proteína
  let proteinMetrics: CollectionCalculatedMetrics['proteinMetrics'] = undefined;
  if (proteinMeasurements.length > 0) {
    const totalGrams = proteinMeasurements.reduce((acc, m) => acc + m.amount, 0);
    const amounts = proteinMeasurements.map((m) => m.amount);
    proteinMetrics = {
      totalMeasurements: proteinMeasurements.length,
      totalGramsMeasured: Number(totalGrams.toFixed(1)),
      averageGramsPerServing: Number((totalGrams / proteinMeasurements.length).toFixed(1)),
      minGrams: Math.min(...amounts),
      maxGrams: Math.max(...amounts),
    };
  }

  const isSampleSufficient = totalDeliveries >= 15 && operationalDurationMinutes >= 5;
  if (!isSampleSufficient) {
    limitations.push('Amostra reduzida: menos de 15 atendimentos ou menos de 5 minutos operacionais. Indicadores estatísticos devem ser interpretados como preliminares.');
  }

  return {
    timeMetrics: {
      totalDurationSeconds: Math.floor(totalDurationMs / 1000),
      pauseDurationSeconds: Math.floor(pauseDurationMs / 1000),
      operationalDurationSeconds,
      operationalDurationMinutes: Number(operationalDurationMinutes.toFixed(2)),
      operationalDurationHours: Number(operationalDurationHours.toFixed(3)),
    },
    overallThroughput: {
      totalDeliveries,
      deliveriesPerMinute,
      deliveriesPerHour,
    },
    arrivalMetrics: {
      totalArrivals,
      arrivalsPerMinute,
      arrivalsPerHour,
    },
    attendantsMetrics,
    comparison,
    queueTheory,
    proteinMetrics,
    sampleIntegrity: {
      isSampleSufficient,
      limitations,
    },
  };
}

/**
 * Utilitário para exportação de dados em CSV (padrão RFC 4180 e compatível com Excel/Sheets em PT-BR)
 */

export function escapeCsvField(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateRawEventsCsv(events: any[]): string {
  const headers = [
    'ID Evento',
    'Tipo de Evento',
    'Horário Ocorrência (ISO)',
    'Horário Registro (ISO)',
    'Código Atendente',
    'Nome Atendente',
    'Fila',
    'Anulado?',
    'Motivo Anulação',
    'Chave Idempotência',
  ];

  const rows = events.map((e) => [
    e.id,
    e.eventType,
    e.occurredAt ? new Date(e.occurredAt).toISOString() : '',
    e.recordedAt ? new Date(e.recordedAt).toISOString() : '',
    e.attendant?.code || '',
    e.attendant?.displayName || '',
    e.queue?.name || '',
    e.isVoided ? 'SIM' : 'NAO',
    e.voidReason || '',
    e.idempotencyKey,
  ]);

  const csvLines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ];

  return csvLines.join('\r\n');
}

export function generateAggregatedMetricsCsv(collection: any, metrics: any): string {
  const lines: string[] = [];

  lines.push('METADADOS DA COLETA');
  lines.push(`Título,${escapeCsvField(collection.title)}`);
  lines.push(`ID,${escapeCsvField(collection.id)}`);
  lines.push(`Status,${escapeCsvField(collection.status)}`);
  lines.push(`Modo de Fila,${escapeCsvField(collection.queueMode)}`);
  lines.push(`Início,${collection.startedAt ? new Date(collection.startedAt).toISOString() : ''}`);
  lines.push(`Encerramento,${collection.endedAt ? new Date(collection.endedAt).toISOString() : ''}`);
  lines.push('');

  lines.push('TEMPOS E TAXAS GERAIS');
  lines.push(`Duração Total (s),${metrics.timeMetrics.totalDurationSeconds}`);
  lines.push(`Duração Pausas (s),${metrics.timeMetrics.pauseDurationSeconds}`);
  lines.push(`Tempo Operacional Válido (s),${metrics.timeMetrics.operationalDurationSeconds}`);
  lines.push(`Tempo Operacional Válido (min),${metrics.timeMetrics.operationalDurationMinutes}`);
  lines.push(`Total de Chegadas,${metrics.arrivalMetrics.totalArrivals}`);
  lines.push(`Taxa de Chegada (lambda/min),${metrics.arrivalMetrics.arrivalsPerMinute ?? 'N/A'}`);
  lines.push(`Total de Entregas,${metrics.overallThroughput.totalDeliveries}`);
  lines.push(`Throughput Geral (X/min),${metrics.overallThroughput.deliveriesPerMinute ?? 'N/A'}`);
  lines.push(`Throughput Geral (X/hora),${metrics.overallThroughput.deliveriesPerHour ?? 'N/A'}`);
  lines.push('');

  lines.push('MÉTRICAS POR ATENDENTE');
  const attHeaders = [
    'Código',
    'Nome',
    'Total Entregas',
    'Taxa (entregas/min)',
    '% do Total',
    'Tempo Médio Serviço (s)',
    'Mediana Serviço (s)',
    'Desvio Padrão (s)',
    'Mínimo (s)',
    'Máximo (s)',
    'Utilização (%)',
  ];
  lines.push(attHeaders.map(escapeCsvField).join(','));

  for (const att of metrics.attendantsMetrics) {
    const row = [
      att.code,
      att.displayName,
      att.deliveriesCount,
      att.deliveriesPerMinute ?? 'N/A',
      att.percentOfTotalDeliveries + '%',
      att.serviceTimeSeconds.mean ?? 'N/A',
      att.serviceTimeSeconds.median ?? 'N/A',
      att.serviceTimeSeconds.stdDev ?? 'N/A',
      att.serviceTimeSeconds.min ?? 'N/A',
      att.serviceTimeSeconds.max ?? 'N/A',
      att.utilizationPercent !== null ? att.utilizationPercent + '%' : 'N/A',
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  lines.push('');
  lines.push('RESSALVAS METODOLÓGICAS E LIMITAÇÕES');
  lines.push(`Ressalva Comparativa,${escapeCsvField(metrics.comparison.disclaimer)}`);
  for (const lim of metrics.sampleIntegrity.limitations) {
    lines.push(`Limitação Identificada,${escapeCsvField(lim)}`);
  }

  return lines.join('\r\n');
}

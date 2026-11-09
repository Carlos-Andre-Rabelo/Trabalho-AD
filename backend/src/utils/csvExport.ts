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
  lines.push(`Ressalva Comparativa,${escapeCsvField(metrics.comparison?.disclaimer || '')}`);
  if (metrics.sampleIntegrity?.limitations) {
    for (const lim of metrics.sampleIntegrity.limitations) {
      lines.push(`Limitação Identificada,${escapeCsvField(lim)}`);
    }
  }

  return lines.join('\r\n');
}

export function generateCompleteConsolidatedCsv(collection: any, metrics: any, events: any[], serviceIntervals: any[]): string {
  const sep = ';'; // Padrão Excel em português
  const lines: string[] = [];

  const esc = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(sep) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  lines.push(['RELATÓRIO CONSOLIDADO COMPLETO DE DESEMPENHO DE FILAS RU'].map(esc).join(sep));
  lines.push([`Gerado em: ${new Date().toLocaleString('pt-BR')}`].map(esc).join(sep));
  lines.push('');

  lines.push(['1. METADADOS E PARÂMETROS DA COLETA'].map(esc).join(sep));
  lines.push(['Título da Coleta', collection.title].map(esc).join(sep));
  lines.push(['ID da Coleta', collection.id].map(esc).join(sep));
  lines.push(['Responsável / Aferidor', collection.owner?.name || 'Aferidor'].map(esc).join(sep));
  lines.push(['Local', collection.location || 'RU Central'].map(esc).join(sep));
  lines.push(['Topologia de Fila', collection.queueMode].map(esc).join(sep));
  lines.push(['Status', collection.status].map(esc).join(sep));
  lines.push(['Início', collection.startedAt ? new Date(collection.startedAt).toLocaleString('pt-BR') : ''].map(esc).join(sep));
  lines.push(['Encerramento', collection.endedAt ? new Date(collection.endedAt).toLocaleString('pt-BR') : 'Em andamento'].map(esc).join(sep));
  lines.push(['Tempo Operacional Líquido (s)', metrics.timeMetrics?.operationalDurationSeconds ?? 0].map(esc).join(sep));
  lines.push(['Tempo Operacional Líquido (min)', metrics.timeMetrics?.operationalDurationMinutes ?? 0].map(esc).join(sep));
  lines.push(['Total de Chegadas', metrics.arrivalMetrics?.totalArrivals ?? 0].map(esc).join(sep));
  lines.push(['Total de Entregas', metrics.overallThroughput?.totalDeliveries ?? 0].map(esc).join(sep));
  lines.push(['Taxa Média de Chegadas (lambda/min)', metrics.arrivalMetrics?.arrivalsPerMinute ?? 'N/A'].map(esc).join(sep));
  lines.push(['Throughput Global (X/min)', metrics.overallThroughput?.deliveriesPerMinute ?? 'N/A'].map(esc).join(sep));
  lines.push(['Intensidade de Tráfego (rho)', metrics.queueTheory?.trafficIntensityRho ?? 'N/A'].map(esc).join(sep));
  lines.push(['Diagnóstico de Estabilidade', metrics.queueTheory?.stabilityState === 'STABLE' ? 'Estável' : 'Sobrecarga'].map(esc).join(sep));
  lines.push(['Tamanho Médio Fila Estimado (Lq)', metrics.queueTheory?.littlesLaw?.Lq ?? 'N/A'].map(esc).join(sep));
  lines.push(['Tempo Médio em Fila Estimado (Wq min)', metrics.queueTheory?.littlesLaw?.WqMinutes ?? 'N/A'].map(esc).join(sep));
  lines.push('');

  lines.push(['2. MÉTRICAS COMPARATIVAS POR ATENDENTE'].map(esc).join(sep));
  const attHeaders = [
    'Código Atendente',
    'Nome Atendente',
    'Total Entregas',
    '% do Total',
    'Throughput (entregas/min)',
    'Throughput Projetado (entregas/h)',
    'Tempo Médio Serviço (s)',
    'Mediana Serviço (s)',
    'Desvio Padrão (s)',
    'Tempo Mínimo (s)',
    'Tempo Máximo (s)',
    'Utilização Individual (%)',
  ];
  lines.push(attHeaders.map(esc).join(sep));

  for (const att of metrics.attendantsMetrics || []) {
    lines.push([
      att.code,
      att.displayName,
      att.deliveriesCount,
      att.percentOfTotalDeliveries ? `${att.percentOfTotalDeliveries}%` : '0%',
      att.deliveriesPerMinute ?? 'N/A',
      att.deliveriesPerHour ?? 'N/A',
      att.serviceTimeSeconds?.mean ?? 'N/A',
      att.serviceTimeSeconds?.median ?? 'N/A',
      att.serviceTimeSeconds?.stdDev ?? 'N/A',
      att.serviceTimeSeconds?.min ?? 'N/A',
      att.serviceTimeSeconds?.max ?? 'N/A',
      att.utilizationPercent !== null ? `${att.utilizationPercent}%` : 'N/A',
    ].map(esc).join(sep));
  }
  lines.push('');

  lines.push(['3. HISTÓRICO DE CHEGADAS'].map(esc).join(sep));
  const arrivalHeaders = ['Nº', 'Horário ISO', 'Horário Formatado', 'Tempo Decorrido (s)', 'Fila', 'Válido?', 'Motivo'];
  lines.push(arrivalHeaders.map(esc).join(sep));
  const arrivals = (events || []).filter((e) => e.eventType === 'ARRIVAL');
  let startMs = collection.startedAt ? new Date(collection.startedAt).getTime() : 0;
  let arrCount = 1;
  for (const a of arrivals) {
    const occMs = new Date(a.occurredAt).getTime();
    const elapsed = startMs ? Math.max(0, Math.floor((occMs - startMs) / 1000)) : 0;
    lines.push([
      arrCount++,
      new Date(a.occurredAt).toISOString(),
      new Date(a.occurredAt).toLocaleString('pt-BR'),
      elapsed,
      a.queue?.name || 'Geral',
      a.isVoided ? 'NÃO (ANULADO)' : 'SIM',
      a.voidReason || '',
    ].map(esc).join(sep));
  }
  lines.push('');

  lines.push(['4. HISTÓRICO DE SAÍDAS / ENTREGAS'].map(esc).join(sep));
  const delHeaders = ['Nº', 'Horário ISO', 'Horário Formatado', 'Tempo Decorrido (s)', 'Atendente Cód', 'Atendente Nome', 'Fila', 'Válido?'];
  lines.push(delHeaders.map(esc).join(sep));
  const deliveries = (events || []).filter((e) => e.eventType === 'DELIVERY');
  let delCount = 1;
  for (const d of deliveries) {
    const occMs = new Date(d.occurredAt).getTime();
    const elapsed = startMs ? Math.max(0, Math.floor((occMs - startMs) / 1000)) : 0;
    lines.push([
      delCount++,
      new Date(d.occurredAt).toISOString(),
      new Date(d.occurredAt).toLocaleString('pt-BR'),
      elapsed,
      d.attendant?.code || '',
      d.attendant?.displayName || '',
      d.queue?.name || 'Geral',
      d.isVoided ? 'NÃO (ANULADO)' : 'SIM',
    ].map(esc).join(sep));
  }
  lines.push('');

  lines.push(['5. INTERVALOS DE ATENDIMENTO CRONOMETRADOS'].map(esc).join(sep));
  const srvHeaders = ['Nº', 'Atendente Cód', 'Atendente Nome', 'Início', 'Término', 'Duração (s)', 'Status'];
  lines.push(srvHeaders.map(esc).join(sep));
  let srvCount = 1;
  for (const s of serviceIntervals || []) {
    const durSec = s.durationMs ? Math.round(s.durationMs / 1000) : '';
    lines.push([
      srvCount++,
      s.attendant?.code || '',
      s.attendant?.displayName || '',
      s.startedAt ? new Date(s.startedAt).toLocaleString('pt-BR') : '',
      s.endedAt ? new Date(s.endedAt).toLocaleString('pt-BR') : '',
      durSec,
      s.status,
    ].map(esc).join(sep));
  }

  return lines.join('\r\n');
}

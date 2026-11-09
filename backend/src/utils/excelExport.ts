import * as XLSX from 'xlsx';

export interface ExcelExportPayload {
  collection: any;
  metrics: any;
  events: any[];
  serviceIntervals: any[];
  timeline?: any[];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatIso(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function generateCollectionExcelBuffer(data: ExcelExportPayload): Buffer {
  const { collection, metrics, events, serviceIntervals } = data;
  const wb = XLSX.utils.book_new();

  const collectionStartMs = collection.startedAt ? new Date(collection.startedAt).getTime() : 0;

  // =========================================================================
  // ABA 1: RESUMO EXECUTIVO E TEORIA DAS FILAS
  // =========================================================================
  const summaryAoa: any[][] = [
    ['SISTEMA RU METRICS — RELATÓRIO ACADÊMICO DE AVALIAÇÃO DE DESEMPENHO DE FILAS'],
    ['Gerado em: ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    [''],
    ['1. METADADOS DA SESSÃO DE AFERIÇÃO'],
    ['Título da Coleta', collection.title || 'Coleta RU'],
    ['Identificador Único (ID)', collection.id],
    ['Aferidor / Pesquisador Responsável', collection.owner?.name || 'Aferidor'],
    ['Local de Coleta', collection.location || 'Restaurante Universitário'],
    [
      'Topologia de Fila',
      collection.queueMode === 'SEPARATE_QUEUES'
        ? 'Filas Múltiplas Separadas'
        : collection.queueMode === 'SINGLE_QUEUE'
        ? 'Fila Única Centralizada'
        : 'Personalizado',
    ],
    ['Status da Coleta', collection.status],
    ['Data/Hora de Início', formatDate(collection.startedAt)],
    ['Data/Hora de Término', formatDate(collection.endedAt) || 'Em andamento'],
    [
      'Duração Programada (Temporizador)',
      collection.targetDurationMinutes ? `${collection.targetDurationMinutes} minutos` : 'Livre / Sem limite pré-definido',
    ],
    [''],
    ['2. CARACTERIZAÇÃO TEMPORAL E OPERACIONAL'],
    ['Tempo Bruto Total Decorrido (segundos)', metrics.timeMetrics?.totalDurationSeconds ?? 0],
    ['Tempo em Pausas / Interrupções (segundos)', metrics.timeMetrics?.pauseDurationSeconds ?? 0],
    ['Tempo Operacional Líquido T (segundos)', metrics.timeMetrics?.operationalDurationSeconds ?? 0],
    ['Tempo Operacional Líquido T (minutos)', metrics.timeMetrics?.operationalDurationMinutes ?? 0],
    ['Tempo Operacional Líquido Formatado (mm:ss)', formatDuration(metrics.timeMetrics?.operationalDurationSeconds)],
    [''],
    ['3. VOLUMES E TAXAS OBSERVADAS'],
    ['Total de Chegadas Registradas', metrics.arrivalMetrics?.totalArrivals ?? 0],
    ['Total de Chegadas Válidas', metrics.arrivalMetrics?.validArrivals ?? metrics.arrivalMetrics?.totalArrivals ?? 0],
    ['Total de Entregas / Saídas Registradas', metrics.overallThroughput?.totalDeliveries ?? 0],
    ['Saldo Líquido em Fila ao Fim (Chegadas - Entregas)', Math.max(0, (metrics.arrivalMetrics?.totalArrivals ?? 0) - (metrics.overallThroughput?.totalDeliveries ?? 0))],
    ['Taxa Média de Chegadas (lambda) por Minuto', metrics.arrivalMetrics?.arrivalsPerMinute ?? 'N/A'],
    ['Taxa Média de Chegadas (lambda) por Hora', metrics.arrivalMetrics?.arrivalsPerHour ?? 'N/A'],
    ['Throughput Médio Global (X) por Minuto', metrics.overallThroughput?.deliveriesPerMinute ?? 'N/A'],
    ['Throughput Médio Global (X) por Hora', metrics.overallThroughput?.deliveriesPerHour ?? 'N/A'],
    [''],
    ['4. APLICAÇÃO DA TEORIA DAS FILAS E LEI DE LITTLE'],
    ['Número de Canais / Servidores Ativos (c)', metrics.queueTheory?.c ?? collection.attendants?.length ?? 1],
    ['Taxa Média de Serviço por Atendente (mu / min)', metrics.queueTheory?.muPerAttendantPerMinute ?? 'N/A'],
    ['Taxa Global de Serviço do Sistema (c * mu / min)', metrics.queueTheory?.muGlobalPerMinute ?? 'N/A'],
    ['Intensidade de Tráfego / Taxa de Ocupação (rho)', metrics.queueTheory?.trafficIntensityRho ?? 'N/A'],
    ['Diagnóstico de Estabilidade do Regime', metrics.queueTheory?.stabilityState === 'STABLE' ? 'Estável (rho < 1)' : 'Saturado / Sobrecarga (rho >= 1)'],
    ['Equação da Lei de Little', metrics.queueTheory?.littlesLaw?.formula || 'L = lambda * W'],
    ['Número Médio Estimado em Fila (Lq)', metrics.queueTheory?.littlesLaw?.Lq ?? 'N/A'],
    ['Tempo Médio Estimado em Fila (Wq em minutos)', metrics.queueTheory?.littlesLaw?.WqMinutes ?? 'N/A'],
    ['Tempo Médio Estimado em Fila (Wq em segundos)', metrics.queueTheory?.littlesLaw?.WqSeconds ?? 'N/A'],
    ['Tempo Médio Estimado no Sistema (W em minutos)', metrics.queueTheory?.littlesLaw?.WMinutes ?? 'N/A'],
    ['Tempo Médio Estimado no Sistema (W em segundos)', metrics.queueTheory?.littlesLaw?.WSeconds ?? 'N/A'],
    ['Notas Metodológicas Teóricas', metrics.queueTheory?.littlesLaw?.notes || ''],
    [''],
    ['5. RESSALVAS METODOLÓGICAS E LIMITAÇÕES'],
    ['Critério Científico de Comparação', metrics.comparison?.disclaimer || 'Amostras observacionais de campo.'],
  ];

  if (metrics.sampleIntegrity?.limitations?.length) {
    for (const lim of metrics.sampleIntegrity.limitations) {
      summaryAoa.push(['Limitação Declarada', lim]);
    }
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo e Teoria das Filas');

  // =========================================================================
  // ABA 2: MÉTRICAS COMPARATIVAS POR ATENDENTE
  // =========================================================================
  const attHeaders = [
    'Código Atendente',
    'Nome Atendente',
    'Total de Entregas (N)',
    'Participação (%)',
    'Throughput (entregas/min)',
    'Throughput Projetado (entregas/h)',
    'Tempo Médio Serviço (s)',
    'Tempo Médio Serviço (mm:ss)',
    'Mediana do Serviço (s)',
    'Desvio Padrão do Serviço (s)',
    'Coeficiente de Variação (CV)',
    'Tempo Mínimo (s)',
    'Tempo Máximo (s)',
    'Taxa de Utilização (%)',
  ];

  const attRows: any[][] = [];
  const attendantsList = metrics.attendantsMetrics || [];

  for (const att of attendantsList) {
    const meanSec = att.serviceTimeSeconds?.mean ?? null;
    const stdDevSec = att.serviceTimeSeconds?.stdDev ?? null;
    const cv = meanSec && stdDevSec ? Number((stdDevSec / meanSec).toFixed(3)) : 'N/A';

    attRows.push([
      att.code,
      att.displayName,
      att.deliveriesCount,
      att.percentOfTotalDeliveries ? Number(att.percentOfTotalDeliveries) : 0,
      att.deliveriesPerMinute ?? 'N/A',
      att.deliveriesPerHour ?? (att.deliveriesPerMinute ? Number((att.deliveriesPerMinute * 60).toFixed(1)) : 'N/A'),
      meanSec ?? 'N/A',
      meanSec !== null ? formatDuration(meanSec) : 'N/A',
      att.serviceTimeSeconds?.median ?? 'N/A',
      stdDevSec ?? 'N/A',
      cv,
      att.serviceTimeSeconds?.min ?? 'N/A',
      att.serviceTimeSeconds?.max ?? 'N/A',
      att.utilizationPercent !== null ? Number(att.utilizationPercent) : 'N/A',
    ]);
  }

  // Linha de total / consolidado
  attRows.push([
    'TOTAL GERAL',
    'Todos os Atendentes',
    metrics.overallThroughput?.totalDeliveries ?? 0,
    100,
    metrics.overallThroughput?.deliveriesPerMinute ?? 'N/A',
    metrics.overallThroughput?.deliveriesPerHour ?? 'N/A',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
  ]);

  const wsAtt = XLSX.utils.aoa_to_sheet([attHeaders, ...attRows]);
  wsAtt['!cols'] = [
    { wch: 18 },
    { wch: 25 },
    { wch: 22 },
    { wch: 16 },
    { wch: 24 },
    { wch: 30 },
    { wch: 24 },
    { wch: 26 },
    { wch: 22 },
    { wch: 24 },
    { wch: 26 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAtt, 'Métricas por Atendente');

  // =========================================================================
  // ABA 3: HISTÓRICO DETALHADO DE CHEGADAS
  // =========================================================================
  const arrivalHeaders = [
    'Nº Chegada',
    'Data e Hora (ISO)',
    'Data e Hora Formatada',
    'Tempo Decorrido (segundos)',
    'Tempo Decorrido (mm:ss)',
    'Intervalo desde Chegada Anterior (segundos)',
    'Fila',
    'Válido?',
    'Motivo da Anulação',
    'ID Evento',
  ];

  const arrivalEvents = (events || []).filter((e) => e.eventType === 'ARRIVAL');
  const arrivalRows: any[][] = [];
  let prevArrivalOccurredMs: number | null = null;
  let arrivalCounter = 1;

  for (const arr of arrivalEvents) {
    const occurredMs = new Date(arr.occurredAt).getTime();
    const elapsedSec = collectionStartMs ? Math.max(0, Math.floor((occurredMs - collectionStartMs) / 1000)) : 0;
    const interArrivalSec = prevArrivalOccurredMs !== null ? Math.max(0, Math.floor((occurredMs - prevArrivalOccurredMs) / 1000)) : '—';
    if (!arr.isVoided) {
      prevArrivalOccurredMs = occurredMs;
    }

    arrivalRows.push([
      arrivalCounter++,
      formatIso(arr.occurredAt),
      formatDate(arr.occurredAt),
      elapsedSec,
      formatDuration(elapsedSec),
      interArrivalSec,
      arr.queue?.name || 'Fila Geral',
      arr.isVoided ? 'NÃO (ANULADO)' : 'SIM',
      arr.voidReason || '',
      arr.id,
    ]);
  }

  const wsArrivals = XLSX.utils.aoa_to_sheet([arrivalHeaders, ...arrivalRows]);
  wsArrivals['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 26 },
    { wch: 24 },
    { wch: 38 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 38 },
  ];
  XLSX.utils.book_append_sheet(wb, wsArrivals, 'Histórico de Chegadas');

  // =========================================================================
  // ABA 4: HISTÓRICO DETALHADO DE SAÍDAS / ENTREGAS
  // =========================================================================
  const deliveryHeaders = [
    'Nº Entrega',
    'Data e Hora (ISO)',
    'Data e Hora Formatada',
    'Tempo Decorrido (segundos)',
    'Tempo Decorrido (mm:ss)',
    'Código Atendente',
    'Nome Atendente',
    'Fila',
    'Intervalo Global desde Última Entrega (s)',
    'Intervalo do Atendente desde Última Entrega (s)',
    'Válido?',
    'Motivo da Anulação',
    'ID Evento',
  ];

  const deliveryEvents = (events || []).filter((e) => e.eventType === 'DELIVERY');
  const deliveryRows: any[][] = [];
  let prevGlobalDeliveryMs: number | null = null;
  const prevAttendantDeliveryMs: Record<string, number> = {};
  let deliveryCounter = 1;

  for (const del of deliveryEvents) {
    const occurredMs = new Date(del.occurredAt).getTime();
    const elapsedSec = collectionStartMs ? Math.max(0, Math.floor((occurredMs - collectionStartMs) / 1000)) : 0;
    const globalInterSec = prevGlobalDeliveryMs !== null ? Math.max(0, Math.floor((occurredMs - prevGlobalDeliveryMs) / 1000)) : '—';
    const attId = del.attendantId || del.attendant?.id || '';
    const attLast = prevAttendantDeliveryMs[attId];
    const attInterSec = attLast !== undefined ? Math.max(0, Math.floor((occurredMs - attLast) / 1000)) : '—';

    if (!del.isVoided) {
      prevGlobalDeliveryMs = occurredMs;
      if (attId) prevAttendantDeliveryMs[attId] = occurredMs;
    }

    deliveryRows.push([
      deliveryCounter++,
      formatIso(del.occurredAt),
      formatDate(del.occurredAt),
      elapsedSec,
      formatDuration(elapsedSec),
      del.attendant?.code || '—',
      del.attendant?.displayName || '—',
      del.queue?.name || 'Balcão',
      globalInterSec,
      attInterSec,
      del.isVoided ? 'NÃO (ANULADO)' : 'SIM',
      del.voidReason || '',
      del.id,
    ]);
  }

  const wsDeliveries = XLSX.utils.aoa_to_sheet([deliveryHeaders, ...deliveryRows]);
  wsDeliveries['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 26 },
    { wch: 24 },
    { wch: 18 },
    { wch: 25 },
    { wch: 16 },
    { wch: 38 },
    { wch: 42 },
    { wch: 18 },
    { wch: 28 },
    { wch: 38 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDeliveries, 'Histórico de Saídas');

  // =========================================================================
  // ABA 5: ATENDIMENTOS CRONOMETRADOS INDIVIDUAIS
  // =========================================================================
  const serviceHeaders = [
    'Nº Atendimento',
    'Código Atendente',
    'Nome Atendente',
    'Início do Atendimento',
    'Término do Atendimento',
    'Duração (segundos)',
    'Duração (mm:ss)',
    'Duração (milissegundos)',
    'Status do Atendimento',
    'Fila',
    'Gramatura Proteína (g)',
    'ID Intervalo',
  ];

  const serviceRows: any[][] = [];
  let serviceCounter = 1;

  for (const s of serviceIntervals || []) {
    const durationSec = s.durationMs ? Math.round(s.durationMs / 1000) : (s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000) : '—');
    const proteinAmount = s.proteinMeasurements?.length ? s.proteinMeasurements[0].amount : (s.proteinMeasurement?.amount || '—');

    serviceRows.push([
      serviceCounter++,
      s.attendant?.code || '—',
      s.attendant?.displayName || '—',
      formatDate(s.startedAt),
      formatDate(s.endedAt),
      durationSec,
      typeof durationSec === 'number' ? formatDuration(durationSec) : '—',
      s.durationMs ?? '—',
      s.status === 'COMPLETED' ? 'CONCLUÍDO' : s.status === 'CANCELLED' ? 'CANCELADO' : 'EM ANDAMENTO',
      s.queue?.name || '—',
      proteinAmount,
      s.id,
    ]);
  }

  const wsServices = XLSX.utils.aoa_to_sheet([serviceHeaders, ...serviceRows]);
  wsServices['!cols'] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 25 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 24 },
    { wch: 38 },
  ];
  XLSX.utils.book_append_sheet(wb, wsServices, 'Atendimentos Cronometrados');

  // =========================================================================
  // ABA 6: SÉRIE TEMPORAL MINUTO A MINUTO (SE DISPONÍVEL)
  // =========================================================================
  if (data.timeline && data.timeline.length > 0) {
    const timelineHeaders = [
      'Janela Temporal',
      'Chegadas no Intervalo',
      'Entregas no Intervalo',
      'Saldo Líquido (Chegadas - Entregas)',
      'Tamanho Estimado da Fila',
      'Taxa Pontual de Entrega (/min)',
    ];

    const timelineRows = data.timeline.map((item: any) => [
      item.label || item.timestamp || '—',
      item.arrivals ?? 0,
      item.deliveries ?? 0,
      (item.arrivals ?? 0) - (item.deliveries ?? 0),
      item.queueLength ?? item.estimatedQueue ?? '—',
      item.deliveriesPerMinute ?? '—',
    ]);

    const wsTimeline = XLSX.utils.aoa_to_sheet([timelineHeaders, ...timelineRows]);
    wsTimeline['!cols'] = [
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 34 },
      { wch: 26 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTimeline, 'Série Temporal');
  }

  // =========================================================================
  // ABA 7: TODOS OS EVENTOS BRUTOS DO BANCO DE DADOS
  // =========================================================================
  const rawHeaders = [
    'ID Evento',
    'Tipo de Evento',
    'Horário Ocorrência (ISO)',
    'Horário Ocorrência Formatado',
    'Horário Registro (ISO)',
    'Código Atendente',
    'Nome Atendente',
    'Fila',
    'Anulado?',
    'Motivo Anulação',
    'Chave de Idempotência',
  ];

  const rawRows = (events || []).map((e) => [
    e.id,
    e.eventType,
    formatIso(e.occurredAt),
    formatDate(e.occurredAt),
    formatIso(e.recordedAt),
    e.attendant?.code || '',
    e.attendant?.displayName || '',
    e.queue?.name || '',
    e.isVoided ? 'SIM' : 'NÃO',
    e.voidReason || '',
    e.idempotencyKey || '',
  ]);

  const wsRaw = XLSX.utils.aoa_to_sheet([rawHeaders, ...rawRows]);
  wsRaw['!cols'] = [
    { wch: 38 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 28 },
    { wch: 18 },
    { wch: 25 },
    { wch: 18 },
    { wch: 12 },
    { wch: 30 },
    { wch: 38 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Todos os Eventos Brutos');

  // Gera o Buffer binário do workbook no padrão XLSX
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

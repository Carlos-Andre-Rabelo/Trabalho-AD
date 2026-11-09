import { describe, it, expect } from 'vitest';
import { generateCollectionExcelBuffer } from '../../src/utils/excelExport.js';
import { parseCollectionNotes, serializeCollectionNotes } from '../../src/modules/collections/collections.service.js';
import * as XLSX from 'xlsx';

describe('Excel Export Utility', () => {
  it('deve gerar um buffer XLSX válido com todas as abas estruturadas', () => {
    const mockData = {
      collection: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Almoço Balcão RU',
        location: 'RU Central',
        queueMode: 'SEPARATE_QUEUES',
        status: 'FINISHED',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        endedAt: new Date().toISOString(),
        targetDurationMinutes: 30,
        owner: { name: 'Aferidor Teste' },
        attendants: [
          { code: 'A', displayName: 'Atendente A' },
          { code: 'B', displayName: 'Atendente B' },
        ],
      },
      metrics: {
        timeMetrics: {
          totalDurationSeconds: 1800,
          pauseDurationSeconds: 120,
          operationalDurationSeconds: 1680,
          operationalDurationMinutes: 28,
        },
        arrivalMetrics: {
          totalArrivals: 85,
          validArrivals: 85,
          arrivalsPerMinute: 3.04,
          arrivalsPerHour: 182.4,
        },
        overallThroughput: {
          totalDeliveries: 80,
          deliveriesPerMinute: 2.86,
          deliveriesPerHour: 171.4,
        },
        attendantsMetrics: [
          {
            code: 'A',
            displayName: 'Atendente A',
            deliveriesCount: 42,
            percentOfTotalDeliveries: 52.5,
            deliveriesPerMinute: 1.5,
            serviceTimeSeconds: {
              mean: 32.4,
              median: 31,
              stdDev: 6.2,
              min: 22,
              max: 55,
            },
            utilizationPercent: 81.0,
          },
          {
            code: 'B',
            displayName: 'Atendente B',
            deliveriesCount: 38,
            percentOfTotalDeliveries: 47.5,
            deliveriesPerMinute: 1.36,
            serviceTimeSeconds: {
              mean: 35.1,
              median: 34,
              stdDev: 7.1,
              min: 20,
              max: 60,
            },
            utilizationPercent: 79.5,
          },
        ],
        queueTheory: {
          c: 2,
          muPerAttendantPerMinute: 1.75,
          muGlobalPerMinute: 3.5,
          trafficIntensityRho: 0.87,
          stabilityState: 'STABLE',
          littlesLaw: {
            formula: 'L = lambda * W',
            Lq: 5.8,
            WqMinutes: 1.9,
            WqSeconds: 114,
            WMinutes: 2.5,
            WSeconds: 150,
            notes: 'Sistema em regime estável com 2 canais.',
          },
        },
        comparison: {
          disclaimer: 'Dados coletados em campo.',
        },
        sampleIntegrity: {
          limitations: ['Amostra de 30 minutos em horário de pico.'],
        },
      },
      events: [
        {
          id: 'evt-1',
          eventType: 'ARRIVAL',
          occurredAt: new Date(Date.now() - 1700000).toISOString(),
          recordedAt: new Date(Date.now() - 1700000).toISOString(),
          isVoided: false,
          queue: { name: 'Fila Geral' },
        },
        {
          id: 'evt-2',
          eventType: 'DELIVERY',
          occurredAt: new Date(Date.now() - 1650000).toISOString(),
          recordedAt: new Date(Date.now() - 1650000).toISOString(),
          isVoided: false,
          attendant: { code: 'A', displayName: 'Atendente A' },
          queue: { name: 'Fila A' },
        },
      ],
      serviceIntervals: [
        {
          id: 'srv-1',
          attendant: { code: 'A', displayName: 'Atendente A' },
          startedAt: new Date(Date.now() - 1680000).toISOString(),
          endedAt: new Date(Date.now() - 1650000).toISOString(),
          durationMs: 30000,
          status: 'COMPLETED',
        },
      ],
      timeline: [
        {
          label: '12:00',
          arrivals: 10,
          deliveries: 8,
          queueLength: 2,
          deliveriesPerMinute: 8,
        },
      ],
    };

    const buffer = generateCollectionExcelBuffer(mockData as any);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    // Lê o buffer gerado e verifica se o workbook possui as abas esperadas
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Resumo e Teoria das Filas');
    expect(wb.SheetNames).toContain('Métricas por Atendente');
    expect(wb.SheetNames).toContain('Histórico de Chegadas');
    expect(wb.SheetNames).toContain('Histórico de Saídas');
    expect(wb.SheetNames).toContain('Atendimentos Cronometrados');
    expect(wb.SheetNames).toContain('Série Temporal');
    expect(wb.SheetNames).toContain('Todos os Eventos Brutos');
  });

  it('deve serializar e deserializar notas com tempo de aferição corretamente', () => {
    const serialized = serializeCollectionNotes('Aferição de almoço', 45);
    expect(serialized).toBeDefined();

    const parsed = parseCollectionNotes(serialized);
    expect(parsed.notesText).toBe('Aferição de almoço');
    expect(parsed.targetDurationMinutes).toBe(45);

    // Teste com tag legada
    const tagNotes = '[DURATION:20] Observação qualquer';
    const parsedTag = parseCollectionNotes(tagNotes);
    expect(parsedTag.targetDurationMinutes).toBe(20);
    expect(parsedTag.notesText).toBe('Observação qualquer');
  });
});

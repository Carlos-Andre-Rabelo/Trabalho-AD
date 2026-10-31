import { describe, it, expect } from 'vitest';
import { formatSecondsToStopwatch, formatNumber, formatRate } from '../../src/utils/formatters.js';

describe('Formatadores PT-BR e Cronômetro (RU Metrics)', () => {
  it('deve formatar segundos em cronômetro MM:SS e HH:MM:SS corretamente', () => {
    expect(formatSecondsToStopwatch(0)).toBe('00:00');
    expect(formatSecondsToStopwatch(45)).toBe('00:45');
    expect(formatSecondsToStopwatch(90)).toBe('01:30');
    expect(formatSecondsToStopwatch(3600)).toBe('01:00:00');
    expect(formatSecondsToStopwatch(3665)).toBe('01:01:05');
  });

  it('deve formatar números com vírgula padrão brasileiro', () => {
    expect(formatNumber(12.345, 2)).toBe('12,35');
    expect(formatNumber(null)).toBe('—');
  });

  it('deve formatar taxa com unidade correta', () => {
    expect(formatRate(1.25, 'pess/min')).toBe('1,25 pess/min');
    expect(formatRate(null)).toBe('—');
  });
});

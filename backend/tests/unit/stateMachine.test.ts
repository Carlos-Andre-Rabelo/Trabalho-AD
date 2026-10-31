import { describe, it, expect } from 'vitest';

describe('Máquina de Estados de Coleta (RU Metrics)', () => {
  type CollectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';

  function canTransition(current: CollectionStatus, target: CollectionStatus): boolean {
    const validTransitions: Record<CollectionStatus, CollectionStatus[]> = {
      DRAFT: ['IN_PROGRESS'],
      IN_PROGRESS: ['PAUSED', 'FINISHED'],
      PAUSED: ['IN_PROGRESS', 'FINISHED'],
      FINISHED: ['IN_PROGRESS'], // Reabertura com auditoria
    };

    return validTransitions[current].includes(target);
  }

  it('deve permitir iniciar apenas a partir de DRAFT', () => {
    expect(canTransition('DRAFT', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('DRAFT', 'PAUSED')).toBe(false);
    expect(canTransition('DRAFT', 'FINISHED')).toBe(false);
  });

  it('deve permitir pausar ou finalizar a partir de IN_PROGRESS', () => {
    expect(canTransition('IN_PROGRESS', 'PAUSED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'FINISHED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'DRAFT')).toBe(false);
  });

  it('deve permitir retomar ou finalizar a partir de PAUSED', () => {
    expect(canTransition('PAUSED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('PAUSED', 'FINISHED')).toBe(true);
    expect(canTransition('PAUSED', 'DRAFT')).toBe(false);
  });

  it('deve impedir que coletas finalizadas recebam eventos sem reabertura formal', () => {
    expect(canTransition('FINISHED', 'PAUSED')).toBe(false);
    expect(canTransition('FINISHED', 'DRAFT')).toBe(false);
    expect(canTransition('FINISHED', 'IN_PROGRESS')).toBe(true); // Reabertura auditada
  });
});

let clockOffsetMs = 0;
let hasSample = false;

/**
 * Atualiza o desvio estimado entre o relógio do servidor e o relógio local do dispositivo.
 * Usa metade do RTT quando informado e suavização exponencial para evitar saltos.
 */
export function updateServerClock(serverTimeIso: string | undefined | null, rttMs = 0): void {
  if (!serverTimeIso) return;
  const parsed = Date.parse(serverTimeIso);
  if (isNaN(parsed)) return;

  const estimatedServerNow = parsed + Math.max(0, Math.min(rttMs, 5000)) / 2;
  const sampleOffset = estimatedServerNow - Date.now();

  if (!hasSample || Math.abs(sampleOffset - clockOffsetMs) > 2000) {
    clockOffsetMs = sampleOffset;
    hasSample = true;
  } else {
    clockOffsetMs = Math.round(clockOffsetMs * 0.7 + sampleOffset * 0.3);
  }
}

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

export function serverNowIso(): string {
  return new Date(serverNow()).toISOString();
}

export function getClockOffsetMs(): number {
  return clockOffsetMs;
}

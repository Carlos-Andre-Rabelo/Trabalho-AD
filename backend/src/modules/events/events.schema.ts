import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    eventType: z.enum(['ARRIVAL', 'DELIVERY', 'OBSERVATION']),
    attendantId: z.string().uuid().optional(),
    queueId: z.string().uuid().optional(),
    occurredAt: z.string().datetime().optional(),
    idempotencyKey: z.string().min(8, 'A chave de idempotência é obrigatória para prevenir duplicidade'),
    metadata: z.record(z.any()).optional(),
  }),
});

export const voidEventSchema = z.object({
  body: z.object({
    voidReason: z.string().min(3, 'O motivo do cancelamento/anulação é obrigatório para auditoria').max(250),
  }),
});

export const listEventsQuerySchema = z.object({
  query: z.object({
    eventType: z.enum(['ARRIVAL', 'DELIVERY', 'OBSERVATION']).optional(),
    attendantId: z.string().uuid().optional(),
    includeVoided: z.string().optional().transform((v) => v === 'true'),
    page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
    limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
  }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>['body'];
export type VoidEventInput = z.infer<typeof voidEventSchema>['body'];

import { z } from 'zod';

export const createCollectionSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'O título deve ter no mínimo 3 caracteres').max(150),
    description: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    timezone: z.string().default('America/Sao_Paulo'),
    queueMode: z.enum(['SEPARATE_QUEUES', 'SINGLE_QUEUE', 'CUSTOM']).default('SEPARATE_QUEUES'),
    attendants: z
      .array(
        z.object({
          code: z.string().min(1).max(10),
          displayName: z.string().min(1).max(50),
        })
      )
      .min(1, 'É necessário informar ao menos um atendente')
      .default([
        { code: 'A', displayName: 'Atendente A' },
        { code: 'B', displayName: 'Atendente B' },
      ]),
    queues: z.array(z.string().min(1).max(50)).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const updateCollectionSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const pauseCollectionSchema = z.object({
  body: z.object({
    reason: z.string().max(250).optional(),
  }),
});

export const reopenCollectionSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'Informe uma justificativa válida para reabertura de coleta encerrada'),
  }),
});

export const listCollectionsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['DRAFT', 'IN_PROGRESS', 'PAUSED', 'FINISHED']).optional(),
    page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
    limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  }),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>['body'];
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>['body'];

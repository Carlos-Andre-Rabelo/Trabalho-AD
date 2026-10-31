import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Carrega .env do backend ou da raiz se existir
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3002'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/ru_metrics?schema=public'),
  JWT_SECRET: z.string().default('dev-secret-key-ru-metrics-academico-2026-substituir-em-producao'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);

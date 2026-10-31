import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('API Integration Tests (RU Metrics)', () => {
  const app = createApp();

  it('GET /health deve responder com status 200 e informações do serviço', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('RU Metrics API');
  });

  it('GET /api-docs/json deve fornecer o documento OpenAPI 3.0', async () => {
    const res = await request(app).get('/api-docs/json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('RU Metrics API');
  });

  it('GET /api/collections sem token JWT deve ser rejeitado com 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/collections');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/register com dados inválidos deve responder com 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: 'invalido',
      password: '123',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'RU Metrics API',
    version: '1.0.0',
    description: 'API REST do RU Metrics — Sistema de Coleta e Avaliação de Desempenho de Filas do Restaurante Universitário.',
    contact: {
      name: 'Equipe de Avaliação de Desempenho',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Servidor local / desenvolvimento',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Collection: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'IN_PROGRESS', 'PAUSED', 'FINISHED'] },
          queueMode: { type: 'string', enum: ['SEPARATE_QUEUES', 'SINGLE_QUEUE', 'CUSTOM'] },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: 'string', format: 'date-time' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          eventType: { type: 'string', enum: ['ARRIVAL', 'DELIVERY', 'OBSERVATION'] },
          attendantId: { type: 'string', format: 'uuid' },
          occurredAt: { type: 'string', format: 'date-time' },
          recordedAt: { type: 'string', format: 'date-time' },
          idempotencyKey: { type: 'string' },
          isVoided: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Cadastrar novo usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuário cadastrado com sucesso' },
          409: { description: 'Email já existente' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Autenticar usuário e obter token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Autenticação bem-sucedida' },
          401: { description: 'Credenciais inválidas' },
        },
      },
    },
    '/collections': {
      get: {
        summary: 'Listar coletas do usuário autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Lista paginada de coletas' },
        },
      },
      post: {
        summary: 'Criar nova coleta',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Coleta criada com sucesso' },
        },
      },
    },
    '/collections/{id}/start': {
      post: {
        summary: 'Iniciar coleta (transição DRAFT -> IN_PROGRESS)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Coleta iniciada' } },
      },
    },
    '/collections/{id}/events': {
      post: {
        summary: 'Registrar evento operacional (chegada ou entrega)',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Evento registrado' },
          200: { description: 'Replay idempotente' },
        },
      },
    },
    '/collections/{id}/metrics': {
      get: {
        summary: 'Consultar métricas calculadas da coleta',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Métricas e Teoria das Filas' } },
      },
    },
  },
};

import { PrismaClient, QueueMode, CollectionStatus, EventType, ServiceIntervalStatus, InterruptionType, MeasurementMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seed do RU Metrics ---');
  console.log('AVISO: Todos os dados gerados neste script são ESTRITAMENTE FICTÍCIOS para fins de demonstração acadêmica.');

  // 1. Criar Usuário de Demonstração
  const passwordHash = await bcrypt.hash('admin123', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'pesquisador@rumetrics.edu.br' },
    update: {},
    create: {
      name: 'Pesquisador RU (Demonstração)',
      email: 'pesquisador@rumetrics.edu.br',
      passwordHash: passwordHash,
    },
  });

  console.log(`Usuário demonstrativo configurado: ${demoUser.email} / senha: admin123`);

  // 2. Verificar se já existe a coleta de demonstração
  const existingCollection = await prisma.collection.findFirst({
    where: {
      ownerId: demoUser.id,
      title: '[DEMO/FICTÍCIO] Aferição Almoço - Proteína RU (Exemplo Didático)'
    }
  });

  if (existingCollection) {
    console.log('Coleta demonstrativa já existe. Seed finalizado sem duplicar.');
    return;
  }

  // 3. Criar Coleta de Demonstração Finalizada
  const baseTime = new Date('2026-10-25T11:30:00.000Z');
  const endTime = new Date('2026-10-25T12:15:00.000Z'); // 45 minutos total

  const collection = await prisma.collection.create({
    data: {
      ownerId: demoUser.id,
      title: '[DEMO/FICTÍCIO] Aferição Almoço - Proteína RU (Exemplo Didático)',
      description: 'Sessão demonstrativa com dados simulados para a disciplina de Avaliação de Desempenho. Todos os registros são fictícios.',
      location: 'Restaurante Universitário - Balcão 1',
      timezone: 'America/Sao_Paulo',
      queueMode: QueueMode.SEPARATE_QUEUES,
      status: CollectionStatus.FINISHED,
      startedAt: baseTime,
      endedAt: endTime,
      notes: 'Coleta de exemplo contendo 2 atendentes operando em filas separadas, com 1 pausa registrada para reposição.',
    },
  });

  // 4. Criar Atendentes
  const attendantA = await prisma.attendant.create({
    data: {
      collectionId: collection.id,
      code: 'A',
      displayName: 'Atendente A (Fictício)',
    },
  });

  const attendantB = await prisma.attendant.create({
    data: {
      collectionId: collection.id,
      code: 'B',
      displayName: 'Atendente B (Fictício)',
    },
  });

  // 5. Criar Filas
  const queueA = await prisma.queue.create({
    data: {
      collectionId: collection.id,
      name: 'Fila A (Atendente A)',
    },
  });

  const queueB = await prisma.queue.create({
    data: {
      collectionId: collection.id,
      name: 'Fila B (Atendente B)',
    },
  });

  // Associar atendentes às filas
  await prisma.queueAttendant.createMany({
    data: [
      { queueId: queueA.id, attendantId: attendantA.id },
      { queueId: queueB.id, attendantId: attendantB.id },
    ],
  });

  // 6. Registrar Pausa Demonstrativa (reposição de 11:50 a 11:54 = 4 min)
  const pauseStart = new Date(baseTime.getTime() + 20 * 60 * 1000);
  const pauseEnd = new Date(baseTime.getTime() + 24 * 60 * 1000);
  await prisma.collectionPause.create({
    data: {
      collectionId: collection.id,
      startedAt: pauseStart,
      endedAt: pauseEnd,
      reason: 'Reposição de cubas térmicas de proteína nas duas bancadas',
    },
  });

  // Registrar interrupção operacional
  await prisma.interruption.create({
    data: {
      collectionId: collection.id,
      interruptionType: InterruptionType.FOOD_REPLENISHMENT,
      startedAt: pauseStart,
      endedAt: pauseEnd,
      notes: 'Pausa geral para troca de travessas térmicas',
      recordedBy: demoUser.id,
    },
  });

  // 7. Simular Eventos e Intervalos
  // Atendente A: 25 atendimentos cronometrados
  // Atendente B: 22 atendimentos cronometrados
  // Chegadas registradas ao longo da observação
  let currentEventTime = new Date(baseTime.getTime() + 30 * 1000); // 30s após início

  // Registrar 52 chegadas distribuídas
  for (let i = 1; i <= 50; i++) {
    const arrivalTime = new Date(baseTime.getTime() + (i * 48 * 1000));
    await prisma.event.create({
      data: {
        collectionId: collection.id,
        eventType: EventType.ARRIVAL,
        queueId: i % 2 === 0 ? queueA.id : queueB.id,
        occurredAt: arrivalTime,
        recordedAt: arrivalTime,
        recordedBy: demoUser.id,
        idempotencyKey: `demo-arrival-${i}-${collection.id}`,
        metadata: { demoNote: 'Registro de chegada fictício para demonstração' },
      },
    });
  }

  // Atendente A: atendimentos de ~40-65 segundos
  for (let i = 1; i <= 24; i++) {
    const offset = i * 95 * 1000;
    const sStart = new Date(baseTime.getTime() + offset);
    const duration = Math.floor(40000 + Math.random() * 25000);
    const sEnd = new Date(sStart.getTime() + duration);

    const interval = await prisma.serviceInterval.create({
      data: {
        collectionId: collection.id,
        attendantId: attendantA.id,
        queueId: queueA.id,
        startedAt: sStart,
        endedAt: sEnd,
        durationMs: duration,
        status: ServiceIntervalStatus.COMPLETED,
      },
    });

    await prisma.event.create({
      data: {
        collectionId: collection.id,
        attendantId: attendantA.id,
        queueId: queueA.id,
        eventType: EventType.DELIVERY,
        occurredAt: sEnd,
        recordedAt: sEnd,
        recordedBy: demoUser.id,
        idempotencyKey: `demo-delivery-A-${i}-${collection.id}`,
        metadata: { durationSeconds: Math.round(duration / 1000), demoNote: 'Fictício' },
      },
    });

    // Medição de proteína a cada 4 atendimentos
    if (i % 4 === 0) {
      await prisma.proteinMeasurement.create({
        data: {
          collectionId: collection.id,
          attendantId: attendantA.id,
          serviceIntervalId: interval.id,
          amount: parseFloat((120 + Math.random() * 20).toFixed(1)),
          unit: 'g',
          measurementMethod: MeasurementMethod.MEASURED,
          notes: 'Amostragem com balança digital (Fictício)',
          recordedAt: sEnd,
        },
      });
    }
  }

  // Atendente B: atendimentos de ~45-75 segundos
  for (let j = 1; j <= 21; j++) {
    const offset = j * 110 * 1000;
    const sStart = new Date(baseTime.getTime() + offset);
    const duration = Math.floor(45000 + Math.random() * 30000);
    const sEnd = new Date(sStart.getTime() + duration);

    const interval = await prisma.serviceInterval.create({
      data: {
        collectionId: collection.id,
        attendantId: attendantB.id,
        queueId: queueB.id,
        startedAt: sStart,
        endedAt: sEnd,
        durationMs: duration,
        status: ServiceIntervalStatus.COMPLETED,
      },
    });

    await prisma.event.create({
      data: {
        collectionId: collection.id,
        attendantId: attendantB.id,
        queueId: queueB.id,
        eventType: EventType.DELIVERY,
        occurredAt: sEnd,
        recordedAt: sEnd,
        recordedBy: demoUser.id,
        idempotencyKey: `demo-delivery-B-${j}-${collection.id}`,
        metadata: { durationSeconds: Math.round(duration / 1000), demoNote: 'Fictício' },
      },
    });

    if (j % 4 === 0) {
      await prisma.proteinMeasurement.create({
        data: {
          collectionId: collection.id,
          attendantId: attendantB.id,
          serviceIntervalId: interval.id,
          amount: parseFloat((115 + Math.random() * 25).toFixed(1)),
          unit: 'g',
          measurementMethod: MeasurementMethod.MEASURED,
          notes: 'Amostragem com balança digital (Fictício)',
          recordedAt: sEnd,
        },
      });
    }
  }

  // 8. Log de Auditoria Inicial
  await prisma.auditLog.create({
    data: {
      userId: demoUser.id,
      collectionId: collection.id,
      action: 'COLLECTION_SEED_CREATED',
      entityType: 'Collection',
      entityId: collection.id,
      newValues: { title: collection.title, status: collection.status, isDemo: true },
    },
  });

  console.log('Seed de demonstração concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro durante execução do seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

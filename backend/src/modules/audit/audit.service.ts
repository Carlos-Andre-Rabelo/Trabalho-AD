import { prisma } from '../../config/prisma.js';

export interface CreateAuditLogParams {
  userId: string;
  collectionId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: any;
  newValues?: any;
}

export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        collectionId: params.collectionId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousValues: params.previousValues ? JSON.parse(JSON.stringify(params.previousValues)) : undefined,
        newValues: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : undefined,
      },
    });
  } catch (err) {
    console.error('Falha ao registrar log de auditoria:', err);
    // Não falha a requisição principal se o log falhar, mas registra o erro
  }
}

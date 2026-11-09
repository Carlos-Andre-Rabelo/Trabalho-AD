import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userRole?: string;
      remoteCollectionId?: string;
    }
  }
}

interface JwtPayload {
  userId: string;
  email?: string;
  role?: string;
  collectionId?: string;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    // 1. Se recebemos um JWT válido, tenta resolver o usuário
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        if (decoded && decoded.userId) {
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, name: true, email: true },
          });

          if (user) {
            req.user = user;
            req.userRole = decoded.role;
            req.remoteCollectionId = decoded.collectionId;
            return next();
          }
        }
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          return next(new AppError('Sua sessão expirou. Faça login novamente.', 401, 'TOKEN_EXPIRED'));
        }
        return next(new AppError('Token de autenticação inválido.', 401, 'INVALID_TOKEN'));
      }
    }

    // 2. Se o cliente enviou um nome de aferidor explicitamente via Header ou Query (para apoio operacional móvel)
    const explicitName = (req.headers['x-user-name'] as string) || (req.query.userName as string);
    if (explicitName && explicitName.trim()) {
      const trimmed = explicitName.trim();
      let user = await prisma.user.findFirst({
        where: { name: trimmed },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        const slug = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '') || 'aferidor';
        user = await prisma.user.create({
          data: {
            name: trimmed,
            email: `${slug}-${Date.now()}@aferidor.local`,
            passwordHash: 'NOPASSWORD',
          },
          select: { id: true, name: true, email: true },
        });
      }

      req.user = user;
      return next();
    }

    // 3. Sem token e sem identificação de operador: rejeita com 401 UNAUTHORIZED
    return next(new AppError('Autenticação necessária para acessar este recurso.', 401, 'UNAUTHORIZED'));
  } catch (error: any) {
    next(error);
  }
}

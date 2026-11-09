import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { prisma } from '../../config/prisma.js';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export class AuthController {
  async setName(req: Request, res: Response, next: NextFunction) {
    try {
      const name = (req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'O nome é obrigatório.' });
      }
      let user = await prisma.user.findFirst({ where: { name } });
      if (!user) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'aferidor';
        user = await prisma.user.create({
          data: {
            name,
            email: `${slug}-${Date.now()}@aferidor.local`,
            passwordHash: 'NOPASSWORD',
          },
        });
      }
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      return res.status(200).json({ success: true, data: { user, token } });
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);

      // Configurar cookie seguro com token
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie('token');
    return res.status(200).json({
      success: true,
      message: 'Sessão encerrada com sucesso.',
    });
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!.id);
      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

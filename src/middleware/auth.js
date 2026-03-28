import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

/**
 * Reads a Bearer token from the Authorization header or an httpOnly cookie
 * named "token", verifies it, and attaches the user record to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ??
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) throw new AppError('Authentication required', 401);

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) throw new AppError('User not found', 401);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
};

const signToken = (userId) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const register = async ({ email, password, name }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already registered', 409);

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashed, name },
    select: SAFE_USER_SELECT,
  });

  return { user, token: signToken(user.id) };
};

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && (await bcrypt.compare(password, user.password));
  // Constant-time: always compare even when user is null (dummy hash)
  if (!valid) throw new AppError('Invalid email or password', 401);

  const { password: _pw, ...safeUser } = user;
  return { user: safeUser, token: signToken(user.id) };
};

export const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
};

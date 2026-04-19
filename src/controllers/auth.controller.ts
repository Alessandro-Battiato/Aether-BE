import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';

const isProd = env.NODE_ENV === 'production';

// Security attributes shared between set and clear.
// clearCookie must send the same SameSite + Secure flags that were used when
// setting the cookie; browsers reject a SameSite=None header that lacks Secure,
// which silently prevents the deletion in production.
const COOKIE_BASE = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
};

const COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user, token } = await authService.register(req.body as { email: string; password: string; name: string });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ status: 'success', data: { user, token } });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user, token } = await authService.login(req.body as { email: string; password: string });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ status: 'success', data: { user, token } });
  } catch (err) {
    next(err);
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('token', COOKIE_BASE);
  res.json({ status: 'success', message: 'Logged out' });
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

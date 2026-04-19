import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';

const isProd = env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  // SameSite=None is required for cross-origin deployments (e.g. Netlify + Railway).
  // Browsers silently drop SameSite=Strict/Lax cookies on cross-site requests, which
  // makes every protected API call return 401 even after a successful login.
  // SameSite=None mandates Secure=true, which is already set in production.
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
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
  res.clearCookie('token');
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

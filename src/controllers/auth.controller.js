import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

export const register = async (req, res, next) => {
  try {
    const { user, token } = await authService.register(req.body);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ status: 'success', data: { user, token } });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ status: 'success', data: { user, token } });
  } catch (err) {
    next(err);
  }
};

export const logout = (_req, res) => {
  res.clearCookie('token');
  res.json({ status: 'success', message: 'Logged out' });
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

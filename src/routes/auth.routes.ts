import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// Tighter per-endpoint limiter for brute-force / credential-stuffing protection.
// A global limiter (200 req/15 min) already covers all /api routes; this one
// adds a stricter cap specifically on auth endpoints where guessing attacks matter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('passwordConfirm')
      .notEmpty().withMessage('Password confirmation is required')
      .custom((val, { req }) => val === req.body.password)
      .withMessage('Passwords do not match'),
  ],
  validate,
  authController.register,
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login,
);

router.post('/logout', authController.logout);

router.get('/me', authenticate, authController.getMe);

export default router;

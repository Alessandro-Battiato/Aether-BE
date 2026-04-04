import { Router } from 'express';
import authRoutes from './auth.routes.js';
import chatsRoutes from './chats.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/chats', chatsRoutes);

// Health-check — useful for Docker, load-balancers, and CI readiness probes
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

export default router;

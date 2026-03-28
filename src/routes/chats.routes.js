import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as chatsController from '../controllers/chats.controller.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

const chatIdParam = param('chatId').isString().notEmpty().withMessage('chatId is required');
const contentBody = body('content').trim().notEmpty().withMessage('content is required');

// ─── models ─────────────────────────────────────────────────────────────────
router.get('/models', chatsController.getModels);

// ─── chats ──────────────────────────────────────────────────────────────────
router.get('/', chatsController.getChats);

router.post(
  '/',
  [
    body('title').optional().trim().isLength({ max: 200 }),
    body('model').optional().trim().notEmpty(),
  ],
  validate,
  chatsController.createChat,
);

router.get('/:chatId', [chatIdParam], validate, chatsController.getChat);

router.patch(
  '/:chatId',
  [
    chatIdParam,
    body('title').optional().trim().isLength({ max: 200 }),
    body('model').optional().trim().notEmpty(),
  ],
  validate,
  chatsController.updateChat,
);

router.delete('/:chatId', [chatIdParam], validate, chatsController.deleteChat);

// ─── messages ────────────────────────────────────────────────────────────────
router.post(
  '/:chatId/messages',
  [chatIdParam, contentBody],
  validate,
  chatsController.sendMessage,
);

// SSE streaming endpoint — client must request with Accept: text/event-stream
router.post(
  '/:chatId/messages/stream',
  [chatIdParam, contentBody],
  validate,
  chatsController.streamMessage,
);

export default router;

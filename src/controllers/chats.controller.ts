import type { Request, Response, NextFunction } from 'express';
import * as chatsService from '../services/chats.service.js';
import * as aiService from '../services/ai.service.js';

type ChatParams = { chatId: string };

export const getChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chats = await chatsService.getChats(req.user!.id);
    res.json({ status: 'success', data: { chats } });
  } catch (err) {
    next(err);
  }
};

export const createChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatsService.createChat(req.user!.id, req.body as { title?: string; model?: string });
    res.status(201).json({ status: 'success', data: { chat } });
  } catch (err) {
    next(err);
  }
};

export const getChat = async (req: Request<ChatParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatsService.getChat(req.user!.id, req.params.chatId);
    res.json({ status: 'success', data: { chat } });
  } catch (err) {
    next(err);
  }
};

export const updateChat = async (req: Request<ChatParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatsService.updateChat(
      req.user!.id,
      req.params.chatId,
      req.body as { title?: string; model?: string },
    );
    res.json({ status: 'success', data: { chat } });
  } catch (err) {
    next(err);
  }
};

export const deleteChat = async (req: Request<ChatParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    await chatsService.deleteChat(req.user!.id, req.params.chatId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req: Request<ChatParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { content } = req.body as { content: string };
    const result = await chatsService.sendMessage(req.user!.id, req.params.chatId, content);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

export const streamMessage = async (req: Request<ChatParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { content } = req.body as { content: string };
    await chatsService.streamMessage(req.user!.id, req.params.chatId, content, res);
  } catch (err) {
    if (!res.headersSent) return next(err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    res.end();
  }
};

export const getModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const free = req.query.free === 'true';
    const result = await aiService.getModels({ page, limit, free });
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

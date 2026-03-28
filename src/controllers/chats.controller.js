import * as chatsService from '../services/chats.service.js';
import * as aiService from '../services/ai.service.js';

export const getChats = async (req, res, next) => {
  try {
    const chats = await chatsService.getChats(req.user.id);
    res.json({ status: 'success', data: { chats } });
  } catch (err) {
    next(err);
  }
};

export const createChat = async (req, res, next) => {
  try {
    const chat = await chatsService.createChat(req.user.id, req.body);
    res.status(201).json({ status: 'success', data: { chat } });
  } catch (err) {
    next(err);
  }
};

export const getChat = async (req, res, next) => {
  try {
    const chat = await chatsService.getChat(req.user.id, req.params.chatId);
    res.json({ status: 'success', data: { chat } });
  } catch (err) {
    next(err);
  }
};

export const updateChat = async (req, res, next) => {
  try {
    const chat = await chatsService.updateChat(req.user.id, req.params.chatId, req.body);
    res.json({ status: 'success', data: { chat } });
  } catch (err) {
    next(err);
  }
};

export const deleteChat = async (req, res, next) => {
  try {
    await chatsService.deleteChat(req.user.id, req.params.chatId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    const result = await chatsService.sendMessage(req.user.id, req.params.chatId, content);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Streams the AI response as Server-Sent Events.
 * The client must request with Accept: text/event-stream.
 *
 * Events emitted:
 *   data: { delta: "..." }         — incremental token
 *   data: { done: true, messageId, userMessageId }  — stream finished
 */
export const streamMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    await chatsService.streamMessage(req.user.id, req.params.chatId, content, res);
  } catch (err) {
    // If headers haven't been sent yet we can still respond with JSON error
    if (!res.headersSent) return next(err);
    // Otherwise write the error into the SSE stream and close
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

export const getModels = async (_req, res, next) => {
  try {
    const models = await aiService.getModels();
    res.json({ status: 'success', data: { models } });
  } catch (err) {
    next(err);
  }
};

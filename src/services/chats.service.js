import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

// ─── helpers ────────────────────────────────────────────────────────────────

const assertOwner = async (userId, chatId) => {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) throw new AppError('Chat not found', 404);
  return chat;
};

const autoTitle = (content) =>
  content.length > 60 ? content.slice(0, 57) + '...' : content;

// ─── chats CRUD ─────────────────────────────────────────────────────────────

export const getChats = (userId) =>
  prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, model: true, createdAt: true, updatedAt: true },
  });

export const createChat = (userId, { title, model } = {}) =>
  prisma.chat.create({
    data: { userId, title: title ?? 'New Chat', model: model ?? DEFAULT_MODEL },
  });

export const getChat = async (userId, chatId) => {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!chat) throw new AppError('Chat not found', 404);
  return chat;
};

export const updateChat = async (userId, chatId, data) => {
  await assertOwner(userId, chatId);
  return prisma.chat.update({ where: { id: chatId }, data });
};

export const deleteChat = async (userId, chatId) => {
  await assertOwner(userId, chatId);
  await prisma.chat.delete({ where: { id: chatId } });
};

// ─── messaging ──────────────────────────────────────────────────────────────

/**
 * Sends a user message and returns { userMessage, assistantMessage }.
 * Calls the AI service synchronously (no streaming).
 */
export const sendMessage = async (userId, chatId, content) => {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!chat) throw new AppError('Chat not found', 404);

  const userMessage = await prisma.message.create({
    data: { chatId, role: 'user', content },
  });

  const history = [
    ...chat.messages.map(({ role, content: c }) => ({ role, content: c })),
    { role: 'user', content },
  ];

  const aiContent = await aiService.generateResponse({ messages: history, model: chat.model });

  const assistantMessage = await prisma.message.create({
    data: { chatId, role: 'assistant', content: aiContent },
  });

  // Auto-set title from the first user message
  const isFirstMessage = chat.messages.length === 0;
  await prisma.chat.update({
    where: { id: chatId },
    data: {
      updatedAt: new Date(),
      ...(isFirstMessage && { title: autoTitle(content) }),
    },
  });

  return { userMessage, assistantMessage };
};

/**
 * Saves the user message, then streams the AI response as Server-Sent Events.
 * Writes directly to `res` — caller must NOT write headers before calling this.
 */
export const streamMessage = async (userId, chatId, content, res) => {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!chat) throw new AppError('Chat not found', 404);

  const userMessage = await prisma.message.create({
    data: { chatId, role: 'user', content },
  });

  const history = [
    ...chat.messages.map(({ role, content: c }) => ({ role, content: c })),
    { role: 'user', content },
  ];

  // Open the SSE channel after all DB writes, so any pre-stream error still
  // returns a normal JSON 4xx/5xx rather than a broken SSE frame.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const stream = await aiService.generateResponseStream({ messages: history, model: chat.model });

  let fullContent = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      fullContent += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  }

  const assistantMessage = await prisma.message.create({
    data: { chatId, role: 'assistant', content: fullContent },
  });

  const isFirstMessage = chat.messages.length === 0;
  await prisma.chat.update({
    where: { id: chatId },
    data: {
      updatedAt: new Date(),
      ...(isFirstMessage && { title: autoTitle(content) }),
    },
  });

  // Signal the client that the stream is complete and provide the saved message id
  res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id, userMessageId: userMessage.id })}\n\n`);
  res.end();
};

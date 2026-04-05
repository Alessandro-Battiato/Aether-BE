import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

const assertOwner = async (userId: string, chatId: string) => {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) throw new AppError('Chat not found', 404);
  return chat;
};

const autoTitle = (content: string): string =>
  content.length > 60 ? content.slice(0, 57) + '...' : content;

export const getChats = (userId: string) =>
  prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, model: true, createdAt: true, updatedAt: true },
  });

export const createChat = async (userId: string, { title, model }: { title?: string; model?: string } = {}) => {
  const resolvedModel = model ?? DEFAULT_MODEL;
  if (model && !(await aiService.isValidModel(model))) {
    throw new AppError(`Model '${model}' does not exist on OpenRouter`, 400);
  }
  return prisma.chat.create({
    data: { userId, title: title ?? 'New Chat', model: resolvedModel },
  });
};

export const getChat = async (userId: string, chatId: string) => {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!chat) throw new AppError('Chat not found', 404);
  return chat;
};

export const updateChat = async (
  userId: string,
  chatId: string,
  data: { title?: string; model?: string },
) => {
  if (data.model && !(await aiService.isValidModel(data.model))) {
    throw new AppError(`Model '${data.model}' does not exist on OpenRouter`, 400);
  }
  await assertOwner(userId, chatId);
  return prisma.chat.update({ where: { id: chatId }, data });
};

export const deleteChat = async (userId: string, chatId: string): Promise<void> => {
  await assertOwner(userId, chatId);
  await prisma.chat.delete({ where: { id: chatId } });
};

export const sendMessage = async (userId: string, chatId: string, content: string) => {
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
    { role: 'user' as const, content },
  ];

  const aiContent = await aiService.generateResponse({ messages: history, model: chat.model });

  const assistantMessage = await prisma.message.create({
    data: { chatId, role: 'assistant', content: aiContent },
  });

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

export const streamMessage = async (
  userId: string,
  chatId: string,
  content: string,
  res: Response,
): Promise<void> => {
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
    { role: 'user' as const, content },
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
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

  res.write(
    `data: ${JSON.stringify({ done: true, messageId: assistantMessage.id, userMessageId: userMessage.id })}\n\n`,
  );
  res.end();
};

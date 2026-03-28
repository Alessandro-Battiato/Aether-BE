import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    chat: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../src/services/ai.service.js', () => ({
  generateResponse: vi.fn(),
  generateResponseStream: vi.fn(),
}));

import { prisma } from '../../../src/lib/prisma.js';
import * as aiService from '../../../src/services/ai.service.js';
import {
  getChats,
  createChat,
  getChat,
  updateChat,
  deleteChat,
  sendMessage,
} from '../../../src/services/chats.service.js';
import { AppError } from '../../../src/middleware/errorHandler.js';

beforeEach(() => vi.clearAllMocks());

const USER_ID = 'user-1';
const CHAT_ID = 'chat-1';

// ─── getChats ────────────────────────────────────────────────────────────────
describe('getChats', () => {
  it('returns all chats for the user ordered by updatedAt desc', async () => {
    const chats = [{ id: CHAT_ID, title: 'Test', model: 'openai/gpt-4o-mini' }];
    prisma.chat.findMany.mockResolvedValue(chats);

    const result = await getChats(USER_ID);

    expect(prisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
    expect(result).toEqual(chats);
  });
});

// ─── createChat ──────────────────────────────────────────────────────────────
describe('createChat', () => {
  it('creates a chat with defaults when no options are passed', async () => {
    prisma.chat.create.mockResolvedValue({ id: CHAT_ID });
    await createChat(USER_ID);

    expect(prisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, title: 'New Chat' }),
      }),
    );
  });

  it('uses provided title and model', async () => {
    prisma.chat.create.mockResolvedValue({ id: CHAT_ID });
    await createChat(USER_ID, { title: 'My Chat', model: 'anthropic/claude-3-haiku' });

    expect(prisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'My Chat', model: 'anthropic/claude-3-haiku' }),
      }),
    );
  });
});

// ─── getChat ─────────────────────────────────────────────────────────────────
describe('getChat', () => {
  it('returns chat with messages', async () => {
    const chat = { id: CHAT_ID, messages: [] };
    prisma.chat.findFirst.mockResolvedValue(chat);

    const result = await getChat(USER_ID, CHAT_ID);
    expect(result).toEqual(chat);
  });

  it('throws 404 when chat not found or belongs to another user', async () => {
    prisma.chat.findFirst.mockResolvedValue(null);
    await expect(getChat(USER_ID, CHAT_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── updateChat ──────────────────────────────────────────────────────────────
describe('updateChat', () => {
  it('updates the chat title', async () => {
    prisma.chat.findFirst.mockResolvedValue({ id: CHAT_ID });
    prisma.chat.update.mockResolvedValue({ id: CHAT_ID, title: 'New Title' });

    const result = await updateChat(USER_ID, CHAT_ID, { title: 'New Title' });
    expect(result.title).toBe('New Title');
  });

  it('throws 404 when chat not owned by user', async () => {
    prisma.chat.findFirst.mockResolvedValue(null);
    await expect(updateChat(USER_ID, CHAT_ID, {})).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── deleteChat ───────────────────────────────────────────────────────────────
describe('deleteChat', () => {
  it('deletes the chat', async () => {
    prisma.chat.findFirst.mockResolvedValue({ id: CHAT_ID });
    await deleteChat(USER_ID, CHAT_ID);
    expect(prisma.chat.delete).toHaveBeenCalledWith({ where: { id: CHAT_ID } });
  });

  it('throws 404 for unknown chat', async () => {
    prisma.chat.findFirst.mockResolvedValue(null);
    await expect(deleteChat(USER_ID, CHAT_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── sendMessage ──────────────────────────────────────────────────────────────
describe('sendMessage', () => {
  const userMsg = { id: 'msg-1', role: 'user', content: 'Hello' };
  const assistantMsg = { id: 'msg-2', role: 'assistant', content: 'Hi there!' };

  beforeEach(() => {
    prisma.chat.findFirst.mockResolvedValue({
      id: CHAT_ID,
      model: 'openai/gpt-4o-mini',
      messages: [],
    });
    prisma.message.create
      .mockResolvedValueOnce(userMsg)
      .mockResolvedValueOnce(assistantMsg);
    prisma.chat.update.mockResolvedValue({});
    aiService.generateResponse.mockResolvedValue('Hi there!');
  });

  it('saves user message, calls AI, saves assistant message', async () => {
    const result = await sendMessage(USER_ID, CHAT_ID, 'Hello');

    expect(prisma.message.create).toHaveBeenCalledTimes(2);
    expect(aiService.generateResponse).toHaveBeenCalledOnce();
    expect(result.userMessage).toEqual(userMsg);
    expect(result.assistantMessage).toEqual(assistantMsg);
  });

  it('auto-titles the chat on the first message', async () => {
    await sendMessage(USER_ID, CHAT_ID, 'Hello');

    expect(prisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Hello' }),
      }),
    );
  });

  it('truncates long first messages to 60 chars', async () => {
    const long = 'A'.repeat(80);
    await sendMessage(USER_ID, CHAT_ID, long);

    expect(prisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'A'.repeat(57) + '...' }),
      }),
    );
  });

  it('throws 404 when chat not found', async () => {
    prisma.chat.findFirst.mockResolvedValue(null);
    await expect(sendMessage(USER_ID, CHAT_ID, 'Hi')).rejects.toMatchObject({ statusCode: 404 });
  });
});

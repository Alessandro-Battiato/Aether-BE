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
    message: { create: vi.fn() },
  },
}));

vi.mock('../../../src/services/ai.service.js', () => ({
  generateResponse: vi.fn(),
  generateResponseStream: vi.fn(),
  isValidModel: vi.fn().mockResolvedValue(true),
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
  streamMessage,
} from '../../../src/services/chats.service.js';
import type { Response } from 'express';

beforeEach(() => vi.clearAllMocks());

const USER_ID = 'user-1';
const CHAT_ID = 'chat-1';

describe('getChats', () => {
  it('returns all chats for the user ordered by updatedAt desc', async () => {
    const chats = [{ id: CHAT_ID, title: 'Test', model: 'openai/gpt-4o-mini' }];
    vi.mocked(prisma.chat.findMany).mockResolvedValue(chats as never);

    const result = await getChats(USER_ID);

    expect(prisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
    expect(result).toEqual(chats);
  });
});

describe('createChat', () => {
  it('creates a chat with defaults when no options are passed', async () => {
    vi.mocked(prisma.chat.create).mockResolvedValue({ id: CHAT_ID } as never);
    await createChat(USER_ID);

    expect(prisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, title: 'New Chat' }),
      }),
    );
  });

  it('uses provided title and model', async () => {
    vi.mocked(prisma.chat.create).mockResolvedValue({ id: CHAT_ID } as never);
    await createChat(USER_ID, { title: 'My Chat', model: 'anthropic/claude-3-haiku' });

    expect(prisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'My Chat', model: 'anthropic/claude-3-haiku' }),
      }),
    );
  });
});

describe('getChat', () => {
  it('returns chat with messages', async () => {
    const chat = { id: CHAT_ID, messages: [] };
    vi.mocked(prisma.chat.findFirst).mockResolvedValue(chat as never);

    const result = await getChat(USER_ID, CHAT_ID);
    expect(result).toEqual(chat);
  });

  it('throws 404 when chat not found or belongs to another user', async () => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue(null);
    await expect(getChat(USER_ID, CHAT_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('updateChat', () => {
  it('updates the chat title', async () => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue({ id: CHAT_ID } as never);
    vi.mocked(prisma.chat.update).mockResolvedValue({ id: CHAT_ID, title: 'New Title' } as never);

    const result = await updateChat(USER_ID, CHAT_ID, { title: 'New Title' });
    expect(result.title).toBe('New Title');
  });

  it('throws 404 when chat not owned by user', async () => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue(null);
    await expect(updateChat(USER_ID, CHAT_ID, {})).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('deleteChat', () => {
  it('deletes the chat', async () => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue({ id: CHAT_ID } as never);
    await deleteChat(USER_ID, CHAT_ID);
    expect(prisma.chat.delete).toHaveBeenCalledWith({ where: { id: CHAT_ID } });
  });

  it('throws 404 for unknown chat', async () => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue(null);
    await expect(deleteChat(USER_ID, CHAT_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('sendMessage', () => {
  const userMsg = { id: 'msg-1', role: 'user', content: 'Hello' };
  const assistantMsg = { id: 'msg-2', role: 'assistant', content: 'Hi there!' };

  beforeEach(() => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue({
      id: CHAT_ID,
      model: 'openai/gpt-4o-mini',
      messages: [],
    } as never);
    vi.mocked(prisma.message.create)
      .mockResolvedValueOnce(userMsg as never)
      .mockResolvedValueOnce(assistantMsg as never);
    vi.mocked(prisma.chat.update).mockResolvedValue({} as never);
    vi.mocked(aiService.generateResponse).mockResolvedValue('Hi there!');
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
    vi.mocked(prisma.chat.findFirst).mockResolvedValue(null);
    await expect(sendMessage(USER_ID, CHAT_ID, 'Hi')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── streamMessage ────────────────────────────────────────────────────────────
describe('streamMessage', () => {
  const createMockRes = () =>
    ({
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    }) as unknown as Response;

  beforeEach(() => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue({
      id: CHAT_ID,
      model: 'openai/gpt-4o-mini',
      messages: [],
    } as never);
    vi.mocked(prisma.message.create)
      .mockResolvedValueOnce({ id: 'msg-1', role: 'user', content: 'Hello' } as never)
      .mockResolvedValueOnce({ id: 'msg-2', role: 'assistant', content: 'Hi!' } as never);
    vi.mocked(prisma.chat.update).mockResolvedValue({} as never);
  });

  it('sets SSE headers, writes delta chunks, and ends with a done event', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'Hi' } }] };
      yield { choices: [{ delta: { content: '!' } }] };
    }
    vi.mocked(aiService.generateResponseStream).mockResolvedValue(fakeStream() as never);

    const res = createMockRes();
    await streamMessage(USER_ID, CHAT_ID, 'Hello', res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"delta":"Hi"'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"delta":"!"'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"done":true'));
    expect(res.end).toHaveBeenCalled();
  });

  it('auto-titles the chat on the first streamed message', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'answer' } }] };
    }
    vi.mocked(aiService.generateResponseStream).mockResolvedValue(fakeStream() as never);

    await streamMessage(USER_ID, CHAT_ID, 'First question', createMockRes());

    expect(prisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'First question' }),
      }),
    );
  });

  it('throws 404 when chat not found', async () => {
    vi.mocked(prisma.chat.findFirst).mockResolvedValue(null);
    await expect(
      streamMessage(USER_ID, CHAT_ID, 'Hello', createMockRes()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

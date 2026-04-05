/**
 * Integration tests for /api/v1/chats
 *
 * The AI service is mocked — no real tokens are sent to OpenRouter.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

vi.mock('../../src/services/ai.service.js', () => ({
  generateResponse: vi.fn().mockResolvedValue('Mocked AI response'),
  generateResponseStream: vi.fn(),
  isValidModel: vi.fn().mockResolvedValue(true),
  getModels: vi.fn().mockImplementation(({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}) =>
    Promise.resolve({
      models: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }],
      total: 1,
      page,
      limit,
      totalPages: 1,
    }),
  ),
}));

import * as aiService from '../../src/services/ai.service.js';

import app from '../../src/app.js';

// DATABASE_URL is set to the test DB by tests/setup.ts before this file loads.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const registerAndLogin = async (email = 'test@test.com'): Promise<string> => {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: 'Test User',
    email,
    password: 'password123',
    passwordConfirm: 'password123',
  });
  return res.body.data.token as string;
};

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

afterAll(() => prisma.$disconnect());

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

// ─── GET /api/v1/chats ────────────────────────────────────────────────────────
describe('GET /api/v1/chats', () => {
  it('returns an empty array when the user has no chats', async () => {
    const token = await registerAndLogin();
    const res = await request(app).get('/api/v1/chats').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.chats).toEqual([]);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/chats');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/chats ───────────────────────────────────────────────────────
describe('POST /api/v1/chats', () => {
  it('creates a chat with default title', async () => {
    const token = await registerAndLogin();
    const res = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});

    expect(res.status).toBe(201);
    expect(res.body.data.chat.title).toBe('New Chat');
    expect(res.body.data.chat.model).toBe('openai/gpt-4o-mini');
  });

  it('creates a chat with a custom title and model', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/v1/chats')
      .set(authHeader(token))
      .send({ title: 'My Chat', model: 'anthropic/claude-3-haiku' });

    expect(res.status).toBe(201);
    expect(res.body.data.chat.title).toBe('My Chat');
    expect(res.body.data.chat.model).toBe('anthropic/claude-3-haiku');
  });
});

// ─── GET /api/v1/chats/:chatId ────────────────────────────────────────────────
describe('GET /api/v1/chats/:chatId', () => {
  it('returns the chat with its messages', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    const res = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.chat.id).toBe(chatId);
    expect(Array.isArray(res.body.data.chat.messages)).toBe(true);
  });

  it('returns 404 for a chat that does not belong to the user', async () => {
    const token1 = await registerAndLogin('user1@test.com');
    const token2 = await registerAndLogin('user2@test.com');

    const create = await request(app).post('/api/v1/chats').set(authHeader(token1)).send({});
    const chatId = create.body.data.chat.id as string;

    const res = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token2));
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/chats/:chatId ─────────────────────────────────────────────
describe('PATCH /api/v1/chats/:chatId', () => {
  it('updates the chat title', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    const res = await request(app)
      .patch(`/api/v1/chats/${chatId}`)
      .set(authHeader(token))
      .send({ title: 'Renamed Chat' });

    expect(res.status).toBe(200);
    expect(res.body.data.chat.title).toBe('Renamed Chat');
  });
});

// ─── DELETE /api/v1/chats/:chatId ────────────────────────────────────────────
describe('DELETE /api/v1/chats/:chatId', () => {
  it('deletes the chat and returns 204', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    const del = await request(app).delete(`/api/v1/chats/${chatId}`).set(authHeader(token));
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token));
    expect(get.status).toBe(404);
  });
});

// ─── POST /api/v1/chats/:chatId/messages ─────────────────────────────────────
describe('POST /api/v1/chats/:chatId/messages', () => {
  it('saves user and assistant messages, returns 201', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    const res = await request(app)
      .post(`/api/v1/chats/${chatId}/messages`)
      .set(authHeader(token))
      .send({ content: 'Hello AI!' });

    expect(res.status).toBe(201);
    expect(res.body.data.userMessage.content).toBe('Hello AI!');
    expect(res.body.data.assistantMessage.content).toBe('Mocked AI response');
  });

  it('auto-titles the chat from the first message', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    await request(app)
      .post(`/api/v1/chats/${chatId}/messages`)
      .set(authHeader(token))
      .send({ content: 'What is the capital of France?' });

    const chat = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token));
    expect(chat.body.data.chat.title).toBe('What is the capital of France?');
  });

  it('returns 400 when content is empty', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    const res = await request(app)
      .post(`/api/v1/chats/${chatId}/messages`)
      .set(authHeader(token))
      .send({ content: '' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/chats/:chatId/messages/stream ───────────────────────────────
describe('POST /api/v1/chats/:chatId/messages/stream', () => {
  it('streams delta chunks and ends with a done event', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' world' } }] };
    }
    vi.mocked(aiService.generateResponseStream).mockResolvedValue(fakeStream() as never);

    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    const res = await request(app)
      .post(`/api/v1/chats/${chatId}/messages/stream`)
      .set(authHeader(token))
      .send({ content: 'Hi!' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('"delta":"Hello"');
    expect(res.text).toContain('"delta":" world"');
    expect(res.text).toContain('"done":true');
  });

  it('auto-titles the chat from the first streamed message', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'answer' } }] };
    }
    vi.mocked(aiService.generateResponseStream).mockResolvedValue(fakeStream() as never);

    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id as string;

    await request(app)
      .post(`/api/v1/chats/${chatId}/messages/stream`)
      .set(authHeader(token))
      .send({ content: 'First streamed question' });

    const chat = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token));
    expect(chat.body.data.chat.title).toBe('First streamed question');
  });
});

// ─── GET /api/v1/chats/models ─────────────────────────────────────────────────
describe('GET /api/v1/chats/models', () => {
  it('returns a paginated model list with pagination metadata', async () => {
    const token = await registerAndLogin();
    const res = await request(app).get('/api/v1/chats/models').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.models)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
    expect(typeof res.body.data.page).toBe('number');
    expect(typeof res.body.data.limit).toBe('number');
    expect(typeof res.body.data.totalPages).toBe('number');
  });

  it('respects page and limit query params', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/chats/models?page=2&limit=5')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.limit).toBe(5);
  });
});

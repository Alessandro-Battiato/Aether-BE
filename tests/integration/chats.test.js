/**
 * Integration tests for /api/v1/chats
 *
 * The AI service is mocked — no real tokens are sent to OpenRouter.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

// Mock AI before any app imports resolve
vi.mock('../../src/services/ai.service.js', () => ({
  generateResponse: vi.fn().mockResolvedValue('Mocked AI response'),
  generateResponseStream: vi.fn(),
  getModels: vi.fn().mockResolvedValue([{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }]),
}));

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.DATABASE_URL = DATABASE_URL;

import app from '../../src/app.js';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// ─── Helpers ─────────────────────────────────────────────────────────────────
const registerAndLogin = async (email = 'test@test.com') => {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: 'Test User',
    email,
    password: 'password123',
    passwordConfirm: 'password123',
  });
  return res.body.data.token;
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ─── Setup / teardown ─────────────────────────────────────────────────────────
beforeAll(() => prisma.$connect());
afterAll(() => prisma.$disconnect());

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

// ─── GET /api/v1/chats ───────────────────────────────────────────────────────────
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

// ─── POST /api/v1/chats ──────────────────────────────────────────────────────────
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

// ─── GET /api/v1/chats/:chatId ───────────────────────────────────────────────────
describe('GET /api/v1/chats/:chatId', () => {
  it('returns the chat with its messages', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id;

    const res = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.chat.id).toBe(chatId);
    expect(Array.isArray(res.body.data.chat.messages)).toBe(true);
  });

  it('returns 404 for a chat that does not belong to the user', async () => {
    const token1 = await registerAndLogin('user1@test.com');
    const token2 = await registerAndLogin('user2@test.com');

    const create = await request(app).post('/api/v1/chats').set(authHeader(token1)).send({});
    const chatId = create.body.data.chat.id;

    const res = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token2));
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/chats/:chatId ─────────────────────────────────────────────────
describe('PATCH /api/v1/chats/:chatId', () => {
  it('updates the chat title', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id;

    const res = await request(app)
      .patch(`/api/v1/chats/${chatId}`)
      .set(authHeader(token))
      .send({ title: 'Renamed Chat' });

    expect(res.status).toBe(200);
    expect(res.body.data.chat.title).toBe('Renamed Chat');
  });
});

// ─── DELETE /api/v1/chats/:chatId ────────────────────────────────────────────────
describe('DELETE /api/v1/chats/:chatId', () => {
  it('deletes the chat and returns 204', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id;

    const del = await request(app).delete(`/api/v1/chats/${chatId}`).set(authHeader(token));
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/v1/chats/${chatId}`).set(authHeader(token));
    expect(get.status).toBe(404);
  });
});

// ─── POST /api/v1/chats/:chatId/messages ────────────────────────────────────────
describe('POST /api/v1/chats/:chatId/messages', () => {
  it('saves user and assistant messages, returns 201', async () => {
    const token = await registerAndLogin();
    const create = await request(app).post('/api/v1/chats').set(authHeader(token)).send({});
    const chatId = create.body.data.chat.id;

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
    const chatId = create.body.data.chat.id;

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
    const chatId = create.body.data.chat.id;

    const res = await request(app)
      .post(`/api/v1/chats/${chatId}/messages`)
      .set(authHeader(token))
      .send({ content: '' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/chats/models ────────────────────────────────────────────────────
describe('GET /api/v1/chats/models', () => {
  it('returns the model list', async () => {
    const token = await registerAndLogin();
    const res = await request(app).get('/api/v1/chats/models').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.models)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError } from '../../../src/middleware/errorHandler.js';

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

import OpenAI from 'openai';
import { generateResponse, generateResponseStream, getModels } from '../../../src/services/ai.service.js';

const getMockCreate = () => new OpenAI().chat.completions.create;

beforeEach(() => vi.clearAllMocks());

describe('generateResponse', () => {
  it('returns the content string from the completion', async () => {
    getMockCreate().mockResolvedValue({
      choices: [{ message: { content: 'Hello!' } }],
    });

    const result = await generateResponse({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'openai/gpt-4o-mini',
    });

    expect(result).toBe('Hello!');
  });

  it('wraps API errors in AppError with status 502', async () => {
    getMockCreate().mockRejectedValue(new Error('upstream failure'));

    await expect(
      generateResponse({ messages: [], model: 'openai/gpt-4o-mini' }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('generateResponseStream', () => {
  it('calls create with stream: true', () => {
    const fakeStream = { [Symbol.asyncIterator]: vi.fn() };
    getMockCreate().mockResolvedValue(fakeStream);

    generateResponseStream({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'openai/gpt-4o-mini',
    });

    expect(getMockCreate()).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });
});

describe('getModels', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  afterEach(() => fetchSpy.mockReset());

  it('returns paginated models with metadata', async () => {
    const rawModels = Array.from({ length: 25 }, (_, i) => ({
      id: `model-${i}`,
      name: `Model ${i}`,
      description: `Desc ${i}`,
      extra: 'stripped',
    }));
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: rawModels }),
    } as Response);

    const result = await getModels({ page: 2, limit: 10 });

    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.models).toHaveLength(10);
    expect(result.models[0]).toEqual({ id: 'model-10', name: 'Model 10', description: 'Desc 10' });
    expect(result.models[0]).not.toHaveProperty('extra');
  });

  it('throws AppError 502 when OpenRouter responds with an error', async () => {
    fetchSpy.mockResolvedValue({ ok: false } as Response);

    await expect(getModels()).rejects.toMatchObject({ statusCode: 502 });
  });
});

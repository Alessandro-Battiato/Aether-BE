import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../src/middleware/errorHandler.js';

// Mock the OpenAI constructor before importing the service
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    // expose so tests can reach it
    __mockCreate: mockCreate,
  };
});

import OpenAI from 'openai';
import { generateResponse, generateResponseStream } from '../../../src/services/ai.service.js';

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
  it('calls create with stream: true', async () => {
    const fakeStream = { [Symbol.asyncIterator]: vi.fn() };
    getMockCreate().mockResolvedValue(fakeStream);

    const stream = generateResponseStream({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'openai/gpt-4o-mini',
    });

    // It returns a promise/stream — just verify the call args
    expect(getMockCreate()).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });
});

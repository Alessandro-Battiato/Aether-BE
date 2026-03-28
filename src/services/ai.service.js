import OpenAI from 'openai';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

// OpenRouter is OpenAI-API-compatible — just swap the baseURL.
const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': env.CLIENT_URL,
    'X-Title': 'GPT Clone',
  },
});

/**
 * Returns the full assistant reply as a string.
 * @param {{ messages: {role: string, content: string}[], model: string }} params
 */
export const generateResponse = async ({ messages, model }) => {
  try {
    const completion = await openai.chat.completions.create({ model, messages });
    return completion.choices[0].message.content;
  } catch (err) {
    throw new AppError(`AI service error: ${err.message}`, 502);
  }
};

/**
 * Returns an async iterable stream (OpenAI SDK streaming).
 * The caller is responsible for iterating and handling SSE.
 */
export const generateResponseStream = ({ messages, model }) => {
  try {
    return openai.chat.completions.create({ model, messages, stream: true });
  } catch (err) {
    throw new AppError(`AI service error: ${err.message}`, 502);
  }
};

/**
 * Fetch the list of models available on OpenRouter.
 * Returns a simplified array: [{ id, name, description }]
 */
export const getModels = async () => {
  const res = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  });
  if (!res.ok) throw new AppError('Failed to fetch models from OpenRouter', 502);
  const { data } = await res.json();
  return (data ?? []).map(({ id, name, description }) => ({ id, name, description }));
};

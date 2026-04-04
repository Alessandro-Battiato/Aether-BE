import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true, // required for cookies
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Body / cookie parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 fallthrough ─────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

// ─── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

export default app;

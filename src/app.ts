import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { xss } from 'express-xss-sanitizer';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ─── Trust proxy (required for correct req.ip behind nginx / load balancers) ──
// '1' = trust exactly one upstream proxy; safer than 'true' which trusts all hops
// and would let clients forge X-Forwarded-For to bypass IP rate limiting.
app.set('trust proxy', 1);

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Restricts access to CLIENT_URL only (use app.use(cors()) for fully public APIs).
// app.options('*', ...) handles the OPTIONS preflight that browsers send first.
const corsOptions: cors.CorsOptions = {
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Request logging (development only) ───────────────────────────────────────
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Global rate limiter (all /api routes) ────────────────────────────────────
// Auth routes apply a tighter per-endpoint limiter on top of this.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// ─── Body / cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Data sanitization against XSS ───────────────────────────────────────────
// Must run after body parsing so req.body is populated.
app.use(xss());

// ─── Compress all text responses ──────────────────────────────────────────────
app.use(compression());

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 fallthrough ──────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;

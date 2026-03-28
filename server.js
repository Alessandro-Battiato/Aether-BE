import { env } from './src/config/env.js';
import app from './src/app.js';
import { prisma } from './src/lib/prisma.js';

const server = app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

// Graceful shutdown — close DB connection before exiting
const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('DB disconnected. Bye.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

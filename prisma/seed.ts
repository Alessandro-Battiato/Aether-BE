import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main(): Promise<void> {
  const password = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      password,
      name: 'Demo User',
      chats: {
        create: [
          {
            title: 'What is the meaning of life?',
            model: 'openai/gpt-4o-mini',
            messages: {
              create: [
                { role: 'user', content: 'What is the meaning of life?' },
                { role: 'assistant', content: '42, obviously. But more seriously — it depends on who you ask.' },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`Seeded demo user: ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

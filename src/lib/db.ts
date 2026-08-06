import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

// Lazy: app.ts loads .env in its module body, which runs AFTER imports are
// evaluated — constructing the client at import time would miss DATABASE_URL
// locally.
let prisma: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  return prisma;
}

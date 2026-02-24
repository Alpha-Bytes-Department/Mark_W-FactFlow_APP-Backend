import { PrismaClient } from '@/../prisma/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import config from '@/config';
export * from '@/../prisma/client/client.js';

// One pool per Node process (PM2 "1 instance" => 1 pool)
const pool = new pg.Pool({
  connectionString: config.url.database,
  max: Number(process.env.PG_POOL_MAX ?? 3),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

// Call once at startup (optional, Prisma can lazy-connect too)
export async function connectDB() {
  await prisma.$connect();
}

// Call on shutdown
export async function disconnectDB() {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
}

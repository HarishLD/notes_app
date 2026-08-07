import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Next.js dev hot-reload re-executes this module on every edit. Without the
// global cache, each reload would open a fresh connection pool against Neon
// until the limit is exhausted.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // The pooled connection string — DIRECT_URL is for migrations only, see prisma.config.ts.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

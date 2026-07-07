import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:/data/dev.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

let cachedPrisma: PrismaClient;

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!cachedPrisma) {
      cachedPrisma = globalForPrisma.prisma ?? createPrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = cachedPrisma;
      }
    }
    const value = (cachedPrisma as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(cachedPrisma);
    }
    return value;
  },
});

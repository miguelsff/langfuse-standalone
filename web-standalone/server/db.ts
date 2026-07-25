import { PrismaClient } from "@prisma/client";

const globalDatabase = globalThis as unknown as {
  standalonePrisma?: PrismaClient;
  standaloneDatabaseReady?: Promise<PrismaClient>;
};

const prisma =
  globalDatabase.standalonePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.standalonePrisma = prisma;
}

export const getDatabase = async () => {
  globalDatabase.standaloneDatabaseReady ??= (async () => {
    await prisma.$connect();
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
    await prisma.localProject.upsert({
      where: { id: "local" },
      update: {},
      create: { id: "local", name: "Local project" },
    });
    return prisma;
  })();

  return globalDatabase.standaloneDatabaseReady;
};

export { prisma };

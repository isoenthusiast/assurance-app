import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const password = process.env.ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name: "Admin",
      username: "admin",
      passwordHash,
      role: "Admin",
    },
  });

  console.log("Seeded admin user.");
  console.log("  username: admin");
  if (process.env.ADMIN_PASSWORD) {
    console.log("  password: (from ADMIN_PASSWORD env var)");
  } else {
    console.log(`  password: ${password}`);
    console.log("Save this password now — it will not be shown again.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

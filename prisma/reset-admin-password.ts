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
  const newPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const admin = await prisma.user.update({
    where: { username: "admin" },
    data: { passwordHash },
  });

  console.log("✅ Admin password reset successfully!");
  console.log("  username: admin");
  console.log(`  password: ${newPassword}`);
  console.log("⚠️  Save this password now — it will not be shown again.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

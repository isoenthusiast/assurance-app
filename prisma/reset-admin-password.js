require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
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

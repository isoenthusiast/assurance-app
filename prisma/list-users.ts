import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("DATABASE_URL in use:", process.env.DATABASE_URL ?? "file:./data/dev.db");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });
  console.log(`Found ${users.length} user(s):`);
  for (const u of users) {
    console.log(`  id=${u.id}  username="${u.username}"  name="${u.name}"  role=${u.role}`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

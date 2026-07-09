import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const links = await prisma.controlSubProcess.findMany({
    include: {
      control: { select: { name: true } },
      subProcess: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  
  console.log(`Total ControlSubProcess links: ${links.length}`);
  for (const l of links) {
    console.log(`  ${l.control.name} -> ${l.subProcess.name} (primary: ${l.isPrimary})`);
  }
  
  await prisma.$disconnect();
}
main();

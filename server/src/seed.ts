import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("password123", 10);
    const user = await prisma.user.create({ data: { email, passwordHash, name: "Demo", tz: "Asia/Jerusalem", locale: "he" } });
    await prisma.campaign.create({
      data: { userId: user.id, name: "קמפיין לדוגמה", platform: "instagram", budget: 100, status: "active" }
    });
    await prisma.lead.create({
      data: { userId: user.id, name: "יואב", phone: "0500000000", email: "yoav@example.com", source: "campaign" }
    });
  }
  console.log("Seed done");
}

main().finally(()=>prisma.$disconnect());

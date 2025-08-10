
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function audit(userId: string|undefined, orgId: string|undefined, action: string, entity?: string, meta?: any) {
  try {
    await prisma.auditLog.create({ data: { userId, orgId, action, entity, meta } });
  } catch {}
}

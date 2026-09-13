import "dotenv/config";
import { prisma } from "@/lib/prisma";
(async () => {
  const keys = await prisma.userApiKey.findMany({ select: { provider: true } });
  console.log("BYOK keys:", JSON.stringify(keys));
  const p = await prisma.project.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 5 });
  console.log("projects:", JSON.stringify(p));
  const specs = await prisma.systemSpec.count();
  console.log("existing specs:", specs);
  await prisma.$disconnect();
})();

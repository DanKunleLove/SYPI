import "dotenv/config";
import { setPlatformModelRef, getPlatformModelRef, serverKeyFor } from "@/lib/ai/platform-model";
import { prisma } from "@/lib/prisma";
(async () => {
  console.log("nvidia key present:", Boolean(serverKeyFor("nvidia")));
  await setPlatformModelRef("nvidia:nvidia/nemotron-3-super-120b-a12b");
  console.log("platform model now:", await getPlatformModelRef());
  await prisma.$disconnect();
})();

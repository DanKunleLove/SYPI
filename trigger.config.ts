import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_owfrqxxeuxgpglkikjgi",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  dirs: ["./trigger"],
  build: {
    extensions: [
      prismaExtension({
        mode: "modern",
      }),
    ],
  },
});

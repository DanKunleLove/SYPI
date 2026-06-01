import { task, logger, metadata } from "@trigger.dev/sdk";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/index";
import { REFINEMENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { RefinementOutputSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getLiveblocks } from "@/lib/liveblocks";

interface RefinePayload {
  generationId: string;
  projectId: string;
  roomId: string;
  prompt: string;
  canvasContext: string;
}

export const refineArchitectureTask = task({
  id: "refine-architecture",
  maxDuration: 90,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: RefinePayload) => {
    const { generationId, projectId, roomId, prompt, canvasContext } = payload;

    logger.info("Refinement started", { generationId });

    await prisma.aIGeneration.update({
      where: { id: generationId },
      data: { status: "running" },
    });

    metadata.set("status", "analyzing");
    metadata.set("step", "Analyzing your request...");

    try {
      metadata.set("status", "generating");
      metadata.set("step", "Generating changes...");

      const result = await generateObject({
        model: getModel("pro"),
        schema: RefinementOutputSchema,
        system: REFINEMENT_SYSTEM_PROMPT,
        prompt: `User request: ${prompt}\n\n${canvasContext}`,
      });

      const refinement = result.object;

      logger.info("Refinement complete", {
        operationCount: refinement.operations.length,
      });

      metadata.set("status", "saving");
      metadata.set("step", "Applying changes...");

      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: {
          status: "completed",
          result: refinement as unknown as Prisma.InputJsonValue,
        },
      });

      const liveblocks = getLiveblocks();
      await liveblocks.broadcastEvent(roomId, {
        type: "AI_GENERATION_COMPLETE",
        generationId,
      });

      metadata.set("status", "complete");
      metadata.set("step", "Changes applied!");

      return {
        success: true,
        generationId,
        operationCount: refinement.operations.length,
      };
    } catch (error) {
      logger.error("Refinement failed", { error });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: { status: "failed", error: errorMessage },
      });

      metadata.set("status", "failed");
      metadata.set("step", "Refinement failed");

      throw error;
    }
  },
});

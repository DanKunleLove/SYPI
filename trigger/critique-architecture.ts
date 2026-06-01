import { task, logger, metadata } from "@trigger.dev/sdk";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/index";
import { CRITIQUE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { CritiqueOutputSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getLiveblocks } from "@/lib/liveblocks";

interface CritiquePayload {
  generationId: string;
  projectId: string;
  roomId: string;
  canvasContext: string;
}

export const critiqueArchitectureTask = task({
  id: "critique-architecture",
  maxDuration: 90,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: CritiquePayload) => {
    const { generationId, projectId, roomId, canvasContext } = payload;

    logger.info("Critique started", { generationId });

    await prisma.aIGeneration.update({
      where: { id: generationId },
      data: { status: "running" },
    });

    metadata.set("status", "analyzing");
    metadata.set("step", "Reviewing architecture...");

    try {
      const result = await generateObject({
        model: getModel("pro"),
        schema: CritiqueOutputSchema,
        system: CRITIQUE_SYSTEM_PROMPT,
        prompt: `Review this architecture and identify issues:\n\n${canvasContext}`,
      });

      const critique = result.object;

      logger.info("Critique complete", {
        issueCount: critique.issues.length,
      });

      metadata.set("status", "saving");
      metadata.set("step", "Saving review results...");

      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: {
          status: "completed",
          result: critique as unknown as Prisma.InputJsonValue,
        },
      });

      const liveblocks = getLiveblocks();
      await liveblocks.broadcastEvent(roomId, {
        type: "AI_GENERATION_COMPLETE",
        generationId,
      });

      metadata.set("status", "complete");
      metadata.set("step", "Review ready!");

      return {
        success: true,
        generationId,
        issueCount: critique.issues.length,
      };
    } catch (error) {
      logger.error("Critique failed", { error });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: { status: "failed", error: errorMessage },
      });

      metadata.set("status", "failed");
      metadata.set("step", "Review failed");

      throw error;
    }
  },
});

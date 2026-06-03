import { task, logger, metadata } from "@trigger.dev/sdk";
import { generateObject, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { resolveModelForProject } from "@/lib/ai/index";
import {
  GENERATION_SYSTEM_PROMPT,
  URL_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { ArchitectureOutputSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getLiveblocks } from "@/lib/liveblocks";

interface DesignAgentPayload {
  generationId: string;
  projectId: string;
  roomId: string;
  prompt: string;
  mode: "generate" | "url-analyze";
  url?: string;
  canvasContext?: string;
}

export const designAgentTask = task({
  id: "design-agent",
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: DesignAgentPayload) => {
    const { generationId, projectId, roomId, prompt, mode, url, canvasContext } =
      payload;

    logger.info("Design agent started", { generationId, mode });

    // Mark as running
    await prisma.aIGeneration.update({
      where: { id: generationId },
      data: { status: "running" },
    });

    // Broadcast progress to the room so the UI shows live status (not just
    // Trigger.dev-internal metadata, which never reaches the client).
    const liveblocks = getLiveblocks();
    const broadcastStatus = async (step: string, message: string) => {
      metadata.set("status", step);
      metadata.set("step", message);
      try {
        await liveblocks.broadcastEvent(roomId, {
          type: "AI_STATUS_UPDATE",
          step,
          message,
        });
      } catch (err) {
        logger.warn("Status broadcast failed", { err });
      }
    };

    await broadcastStatus("planning", "Analyzing your request...");

    try {
      let systemPrompt: string;
      let userPrompt: string;

      if (mode === "url-analyze" && url) {
        // URL analysis mode: first research the site, then generate architecture
        await broadcastStatus("researching", `Researching ${url}...`);

        // Use Gemini with google search to research the site's tech stack
        const googleProvider = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_AI_API_KEY,
        });

        const research = await generateText({
          // gemini-2.5-pro is unavailable on the free tier; default to flash.
          model: googleProvider(process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-flash"),
          tools: {
            google_search: googleProvider.tools.googleSearch({}),
          },
          system: `You are a tech stack researcher. Given a URL, research the company/product and identify their likely technology stack. Include: frontend framework, backend language/framework, databases, caching, CDN, real-time systems, hosting, and any other infrastructure. Be specific and cite sources when possible. If you can't find definitive info, make educated inferences based on the product type and scale.`,
          prompt: `Research the tech stack and architecture of: ${url}\n\nLook for engineering blogs, tech stack articles, job listings, and any public technical information.`,
        });

        systemPrompt = URL_ANALYSIS_SYSTEM_PROMPT;
        userPrompt = `Based on this research about ${url}:\n\n${research.text}\n\nDesign the system architecture for this product. User's additional context: ${prompt}`;
      } else {
        // Standard generation mode
        systemPrompt = GENERATION_SYSTEM_PROMPT;
        userPrompt = prompt;

        if (canvasContext) {
          userPrompt += `\n\n${canvasContext}`;
        }
      }

      // Generate the architecture
      await broadcastStatus("generating", "Generating architecture...");

      const result = await generateObject({
        model: await resolveModelForProject(projectId, "pro"),
        schema: ArchitectureOutputSchema,
        system: systemPrompt,
        prompt: userPrompt,
      });

      const architecture = result.object;

      logger.info("Architecture generated", {
        nodeCount: architecture.nodes.length,
        edgeCount: architecture.edges.length,
      });

      // Store result in DB
      await broadcastStatus("saving", "Saving results...");

      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: {
          status: "completed",
          result: architecture as unknown as Prisma.InputJsonValue,
        },
      });

      // Broadcast completion to the Liveblocks room
      await liveblocks.broadcastEvent(roomId, {
        type: "AI_GENERATION_COMPLETE",
        generationId,
      });

      metadata.set("status", "complete");
      metadata.set("step", "Architecture ready!");

      return {
        success: true,
        generationId,
        nodeCount: architecture.nodes.length,
        edgeCount: architecture.edges.length,
      };
    } catch (error) {
      logger.error("Design agent failed", { error });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: {
          status: "failed",
          error: errorMessage,
        },
      });

      metadata.set("status", "failed");
      metadata.set("step", "Generation failed");

      throw error; // Let Trigger.dev handle retry
    }
  },
});

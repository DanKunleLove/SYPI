import { task, logger } from "@trigger.dev/sdk";

export const helloWorldTask = task({
  id: "hello-world",
  maxDuration: 30,
  run: async (payload: { message: string }) => {
    logger.log("Hello world task started", { payload });

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.log("Hello world task completed");

    return {
      success: true,
      message: `Processed: ${payload.message}`,
    };
  },
});

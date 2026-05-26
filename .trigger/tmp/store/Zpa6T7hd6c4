import {
  logger,
  task
} from "../../../chunk-UUZS2L5G.mjs";
import "../../../chunk-5A54AS5L.mjs";
import {
  __name,
  init_esm
} from "../../../chunk-4DNCWKMJ.mjs";

// trigger/example.ts
init_esm();
var helloWorldTask = task({
  id: "hello-world",
  maxDuration: 30,
  run: /* @__PURE__ */ __name(async (payload) => {
    logger.log("Hello world task started", { payload });
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    logger.log("Hello world task completed");
    return {
      success: true,
      message: `Processed: ${payload.message}`
    };
  }, "run")
});
export {
  helloWorldTask
};
//# sourceMappingURL=example.mjs.map

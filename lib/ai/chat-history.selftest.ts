import assert from "node:assert/strict";
import { mergeChatMessages, restoreChatMessages, type ChatMessage } from "./chat-history";

const restored = restoreChatMessages([
  { id: "assistant-feed", createdAt: 20, data: { role: "assistant", content: "Saved reply", messageId: "reply", toolSummary: "addNode: output-available" } },
  { id: "user-feed", createdAt: 10, data: { role: "user", content: "My idea" } },
  { id: "system-feed", createdAt: 5, data: { role: "system", content: "Internal event" } },
]);
assert.equal(restored.length, 2, "internal events do not enter the conversation");
assert.equal(restored[0].id, "saved-user-feed", "legacy messages retain stable IDs");
assert.equal(restored[1].id, "reply", "new messages use the original SDK ID");
assert.ok(restored.every((message) => message.metadata?.restored));
assert.ok(restored.every((message) => message.parts.every((part) => part.type === "text")), "saved tool activity cannot execute on hydration");
assert.equal(restored[1].metadata?.toolSummary, "addNode: output-available");
const live: ChatMessage = { id: "reply", role: "assistant", parts: [{ type: "text", text: "Updated reply" }] };
const merged = mergeChatMessages(restored, [live]);
assert.equal(merged.length, 2, "feed acknowledgement does not duplicate a streamed reply");
assert.equal(merged[1], live, "live content wins while streaming");
assert.equal(restoreChatMessages([
  { id: "one", createdAt: 1, data: { role: "user", content: "First", messageId: "same" } },
  { id: "two", createdAt: 2, data: { role: "user", content: "Second", messageId: "same" } },
]).length, 1, "duplicate persistent receipts are deduplicated");
assert.deepEqual(mergeChatMessages([], []), []);
console.log("Chat history: 10 checks passed");

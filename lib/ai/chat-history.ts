import type { UIMessage } from "ai";

export interface ChatMetadata {
  restored?: boolean;
  savedAt?: number;
  toolSummary?: string;
  interrupted?: boolean;
}

export type ChatMessage = UIMessage<ChatMetadata>;

interface SavedMessage {
  id: string;
  createdAt: number;
  data: {
    role: "user" | "assistant" | "system";
    content: string;
    messageId?: string;
    toolSummary?: string;
    interrupted?: boolean;
  };
}

/** History is text-only in the agent context: loading it cannot replay tools. */
export function restoreChatMessages(saved: SavedMessage[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();
  for (const row of [...saved].sort((a, b) => a.createdAt - b.createdAt)) {
    if (row.data.role === "system") continue;
    const id = row.data.messageId ?? `saved-${row.id}`;
    messages.set(id, {
      id,
      role: row.data.role,
      parts: [{ type: "text", text: row.data.content || row.data.toolSummary || "No text reply was saved for this activity." }],
      metadata: {
        restored: true,
        savedAt: row.createdAt,
        toolSummary: row.data.toolSummary,
        interrupted: row.data.interrupted,
      },
    });
  }
  return [...messages.values()];
}

export function mergeChatMessages(saved: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
  const messages = new Map(saved.map((message) => [message.id, message]));
  for (const message of live) messages.set(message.id, message);
  return [...messages.values()];
}

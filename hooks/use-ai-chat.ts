"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import {
  useCreateFeed,
  useCreateFeedMessage,
  useFeedMessages,
} from "@liveblocks/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { serializeCanvasForAI } from "@/lib/ai/canvas-context";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

interface UseAiChatOptions {
  projectId: string;
  getNodes: () => CanvasNode[];
  getEdges: () => CanvasEdge[];
}

export function useAiChat({ projectId, getNodes, getEdges }: UseAiChatOptions) {
  const feedId = "ai-chat";
  const feedCreatedRef = useRef(false);
  const createFeed = useCreateFeed();
  const createFeedMessage = useCreateFeedMessage();
  const feedResult = useFeedMessages(feedId);
  const feedMessages = feedResult.isLoading ? [] : (feedResult.messages ?? []);

  // Input state — AI SDK v6 useChat no longer manages this
  const [input, setInput] = useState("");

  // Create the feed once if it doesn't exist
  useEffect(() => {
    if (feedCreatedRef.current) return;
    feedCreatedRef.current = true;
    createFeed(feedId, { metadata: { type: "ai-chat" } }).catch(() => {
      // Feed may already exist — that's fine
    });
  }, [createFeed]);

  // Vercel AI SDK v6 chat hook
  const {
    messages,
    sendMessage: sdkSendMessage,
    status,
    error,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
    onFinish: ({ message }) => {
      // Flatten text parts into the persisted feed message
      const text = message.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      createFeedMessage(feedId, {
        role: "assistant",
        content: text,
        sender: "AI Twin",
      }).catch(() => {});
    },
  });

  // Wrap sendMessage to also push user message to feed and include canvas context
  const sendMessage = useCallback(
    async (content: string) => {
      // Push user message to feed for all collaborators to see
      await createFeedMessage(feedId, {
        role: "user",
        content,
        sender: "You",
      }).catch(() => {});

      // Get current canvas context
      const nodes = getNodes();
      const edges = getEdges();
      const canvasContext = serializeCanvasForAI(nodes, edges);

      // Send to AI with canvas context (per-request body)
      await sdkSendMessage(
        { text: content },
        { body: { projectId, canvasContext } }
      );
    },
    [sdkSendMessage, createFeedMessage, projectId, getNodes, getEdges]
  );

  const isLoading = status === "submitted" || status === "streaming";

  return {
    /** All messages from the Vercel AI SDK (includes streaming) */
    messages,
    /** Persistent feed messages visible to all collaborators */
    feedMessages,
    /** Send a message to the AI */
    sendMessage,
    /** Current input value */
    input,
    /** Set input value */
    setInput,
    /** Whether the AI is currently responding */
    isLoading,
    /** Any error from the last request */
    error,
    /** Tool invocations from the AI response */
    toolInvocations: messages.flatMap((m) => m.parts ?? []).filter(isToolUIPart),
  };
}

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId, isToolUIPart } from "ai";
import {
  useCreateFeed,
  useCreateFeedMessage,
  useFeedMessages,
} from "@liveblocks/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeChatMessages, restoreChatMessages, type ChatMessage } from "@/lib/ai/chat-history";
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
  const feedMessages = useMemo(() => feedResult.messages ?? [], [feedResult.messages]);

  // Input state — AI SDK v6 useChat no longer manages this
  const [input, setInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sendingRef = useRef(false);
  const hydratedRef = useRef(false);
  const savedMessages = useMemo(
    () => restoreChatMessages(feedMessages),
    [feedMessages]
  );

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
    setMessages,
    stop,
  } = useChat<ChatMessage>({
    id: projectId,
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
    onFinish: ({ message, isAbort, isError }) => {
      const text = message.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      createFeedMessage(feedId, {
        role: "assistant",
        content: text,
        sender: "AI Twin",
        messageId: message.id,
        partsJson: JSON.stringify(message.parts),
        toolSummary: message.parts.filter(isToolUIPart)
          .map((part) => `${part.type.replace(/^tool-/, "")}: ${part.state}`).join("\n"),
        interrupted: isAbort || isError,
      }).catch(() => setSaveError("Your reply could not be saved. Keep this project open and check your connection."));
    },
  });

  useEffect(() => {
    if (feedResult.isLoading || feedResult.error || hydratedRef.current) return;
    hydratedRef.current = true;
    // Bound model context independently of the paginated visible transcript.
    setMessages(savedMessages.slice(-40));
  }, [feedResult.isLoading, feedResult.error, savedMessages, setMessages]);

  // Wrap sendMessage to also push user message to feed and include canvas context
  const sendMessage = useCallback(
    async (content: string) => {
      if (!hydratedRef.current || sendingRef.current || status === "submitted" || status === "streaming") return;
      sendingRef.current = true;
      setIsSaving(true);
      try {
        setSaveError(null);
        const messageId = generateId();
        // Persist before dispatch, so a failed save leaves the draft intact.
        await createFeedMessage(feedId, {
          role: "user",
          content,
          sender: "You",
          messageId,
        }).catch(() => {
          setSaveError("Your message could not be saved. Check your connection and send it again.");
          throw new Error("Message not saved");
        });
        setInput("");
        setIsSaving(false);

        const nodes = getNodes();
        const edges = getEdges();
        const canvasContext = serializeCanvasForAI(nodes, edges);
        setMessages((current) => current.slice(-40));

        await sdkSendMessage(
          { id: messageId, role: "user", parts: [{ type: "text", text: content }] },
          { body: { projectId, canvasContext } }
        );
      } finally {
        sendingRef.current = false;
        setIsSaving(false);
      }
    },
    [sdkSendMessage, createFeedMessage, projectId, getNodes, getEdges, status, setMessages]
  );

  const isLoading = status === "submitted" || status === "streaming";

  return {
    /** All messages from the Vercel AI SDK (includes streaming) */
    messages,
    displayMessages: mergeChatMessages(savedMessages, messages),
    historyLoading: feedResult.isLoading,
    historyError: feedResult.error,
    hasMoreHistory: !feedResult.isLoading && !feedResult.hasFetchedAll,
    loadingMoreHistory: feedResult.isFetchingMore,
    loadMoreHistory: feedResult.fetchMore,
    saveError,
    isSaving,
    stop,
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

"use client";

import {
  useCreateFeed,
  useCreateFeedMessage,
  useFeedMessages,
} from "@liveblocks/react";
import { useEventListener } from "@liveblocks/react";
import { useCallback, useEffect, useRef } from "react";

export interface StatusMessage {
  step: string;
  message: string;
  timestamp: number;
}

export function useAiStatus() {
  const feedId = "ai-status-feed";
  const feedCreatedRef = useRef(false);
  const createFeed = useCreateFeed();
  const createFeedMessage = useCreateFeedMessage();
  const feedResult = useFeedMessages(feedId);
  const feedMessages = feedResult.isLoading ? [] : (feedResult.messages ?? []);

  // Create the status feed once
  useEffect(() => {
    if (feedCreatedRef.current) return;
    feedCreatedRef.current = true;
    createFeed(feedId, { metadata: { type: "ai-status" } }).catch(() => {});
  }, [createFeed]);

  // Listen for AI_STATUS_UPDATE room events and push to feed
  useEventListener(({ event }) => {
    if (event.type === "AI_STATUS_UPDATE") {
      createFeedMessage(feedId, {
        role: "system",
        content: event.message,
        step: event.step,
      }).catch(() => {});
    }
  });

  // Get the latest status message
  const latestStatus: StatusMessage | null =
    feedMessages.length > 0
      ? {
          step: (feedMessages[feedMessages.length - 1].data as Record<string, unknown>).step as string ?? "",
          message: (feedMessages[feedMessages.length - 1].data as Record<string, unknown>).content as string ?? "",
          timestamp: feedMessages[feedMessages.length - 1].createdAt ?? Date.now(),
        }
      : null;

  const pushStatus = useCallback(
    (step: string, message: string) => {
      createFeedMessage(feedId, {
        role: "system",
        content: message,
        step,
      }).catch(() => {});
    },
    [createFeedMessage]
  );

  return {
    latestStatus,
    statusMessages: feedMessages,
    pushStatus,
  };
}

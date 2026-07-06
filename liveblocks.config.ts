declare global {
  interface Liveblocks {
    // Each user's Presence — tracks realtime state in the room
    Presence: {
      cursor: { x: number; y: number } | null;
      selectedNodeIds: string[];
      isThinking: boolean;
      /** Hold L — cursor becomes a laser pointer for everyone. */
      laser: boolean;
    };

    // Storage is managed by @liveblocks/react-flow via useLiveblocksFlow.
    // Declaring it empty here so the config compiles; the react-flow package
    // extends it at runtime with its own node/edge LiveMaps.
    Storage: {};

    // Custom user info set during authentication
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        cursorColor: string;
      };
    };

    // Custom events for broadcasting actions across the room
    RoomEvent:
      | { type: "AI_GENERATION_START"; generationId: string }
      | { type: "AI_GENERATION_COMPLETE"; generationId: string }
      | { type: "AI_STATUS_UPDATE"; message: string; step: string }
      | { type: "NODE_HIGHLIGHT"; nodeId: string };

    // Custom metadata set on threads — canvas-anchored pins carry flow coords.
    // Optional so panel-created (unanchored) threads keep working.
    ThreadMetadata: {
      x?: number;
      y?: number;
    };

    // Feed metadata (ai-chat, ai-status, and the human team chat)
    FeedMetadata: {
      type: "ai-chat" | "ai-status" | "team-chat";
    };

    // Feed message data shape
    FeedMessageData: {
      role: "user" | "assistant" | "system";
      content: string;
      sender?: string;
      step?: string;
    };

    // Custom room info set with resolveRoomsInfo
    RoomInfo: {
      title: string;
    };
  }
}

export {};

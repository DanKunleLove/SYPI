declare global {
  interface Liveblocks {
    // Each user's Presence — tracks realtime state in the room
    Presence: {
      cursor: { x: number; y: number } | null;
      selectedNodeIds: string[];
      isThinking: boolean;
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
      | { type: "AI_GENERATION_START" }
      | { type: "AI_GENERATION_COMPLETE" }
      | { type: "NODE_HIGHLIGHT"; nodeId: string };

    // Custom metadata set on threads
    ThreadMetadata: {};

    // Custom room info set with resolveRoomsInfo
    RoomInfo: {
      title: string;
    };
  }
}

export {};

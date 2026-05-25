"use client";

import type { ReactNode } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react/suspense";
import { Loader2 } from "lucide-react";

interface LiveblocksRoomProps {
  roomId: string;
  children: ReactNode;
}

function LoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-muted)]">
          Connecting to workspace...
        </span>
      </div>
    </div>
  );
}

export function LiveblocksRoom({ roomId, children }: LiveblocksRoomProps) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider
        id={roomId}
        initialPresence={{
          cursor: null,
          selectedNodeIds: [],
          isThinking: false,
        }}
      >
        <ClientSideSuspense fallback={<LoadingFallback />}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

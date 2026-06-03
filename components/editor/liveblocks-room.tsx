"use client";

import { useCallback, useRef, type ReactNode } from "react";
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

interface Member {
  id: string;
  name: string;
  avatar: string;
  cursorColor: string;
  email: string;
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
  // Cache the members fetch per room so resolveUsers / resolveMentionSuggestions
  // don't refetch on every lookup.
  const cache = useRef<{ roomId: string; promise: Promise<Member[]> } | null>(null);

  const fetchMembers = useCallback((): Promise<Member[]> => {
    if (!cache.current || cache.current.roomId !== roomId) {
      const promise = fetch(`/api/projects/${roomId}/members`)
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((d) => (d.members ?? []) as Member[])
        .catch(() => [] as Member[]);
      cache.current = { roomId, promise };
    }
    return cache.current.promise;
  }, [roomId]);

  const resolveUsers = useCallback(
    async ({ userIds }: { userIds: readonly string[] }) => {
      const members = await fetchMembers();
      const byId = new Map(members.map((m) => [m.id, m]));
      return userIds.map((id) => {
        const m = byId.get(id);
        return m
          ? { name: m.name, avatar: m.avatar, cursorColor: m.cursorColor }
          : undefined;
      });
    },
    [fetchMembers]
  );

  const resolveMentionSuggestions = useCallback(
    async ({ text }: { text: string }) => {
      const members = await fetchMembers();
      const q = text?.trim().toLowerCase();
      const matched = q
        ? members.filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q)
          )
        : members;
      return matched.map((m) => m.id);
    },
    [fetchMembers]
  );

  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      resolveUsers={resolveUsers}
      resolveMentionSuggestions={resolveMentionSuggestions}
    >
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

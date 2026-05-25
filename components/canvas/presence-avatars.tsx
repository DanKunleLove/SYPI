"use client";

import { useState } from "react";
import { useOthers, useSelf } from "@liveblocks/react/suspense";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 2;

export function PresenceAvatars() {
  const others = useOthers();
  const self = useSelf();
  const [expanded, setExpanded] = useState(false);

  const allUsers = [
    ...(self
      ? [
          {
            id: self.id,
            name: (self.info as { name?: string })?.name ?? "You",
            avatar: (self.info as { avatar?: string })?.avatar ?? "",
            cursorColor: (self.info as { cursorColor?: string })?.cursorColor ?? "#6366f1",
            isSelf: true,
          },
        ]
      : []),
    ...others.map((other) => ({
      id: other.id,
      name: (other.info as { name?: string })?.name ?? "Anonymous",
      avatar: (other.info as { avatar?: string })?.avatar ?? "",
      cursorColor: (other.info as { cursorColor?: string })?.cursorColor ?? "#a1a1aa",
      isSelf: false,
    })),
  ];

  const visibleUsers = allUsers.slice(0, MAX_VISIBLE);
  const overflowCount = allUsers.length - MAX_VISIBLE;

  if (allUsers.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-20">
      <div className="relative">
        {/* Avatar stack */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center -space-x-2 cursor-pointer"
          aria-label={`${allUsers.length} user${allUsers.length !== 1 ? "s" : ""} online`}
        >
          {visibleUsers.map((user, i) => (
            <div
              key={user.id ?? i}
              className="relative h-8 w-8 rounded-full border-2 border-[var(--bg-base)] overflow-hidden"
              style={{ zIndex: MAX_VISIBLE - i }}
              title={user.isSelf ? `${user.name} (you)` : user.name}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: user.cursorColor }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Online dot */}
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-base)] bg-[var(--state-success)]" />
            </div>
          ))}

          {overflowCount > 0 && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--bg-base)] bg-[var(--bg-surface-raised)] text-[10px] font-semibold text-[var(--text-secondary)]"
              style={{ zIndex: 0 }}
            >
              +{overflowCount}
            </div>
          )}
        </button>

        {/* Expanded dropdown */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-xl shadow-black/20"
            >
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Active ({allUsers.length})
              </p>
              <div className="space-y-0.5">
                {allUsers.map((user, i) => (
                  <div
                    key={user.id ?? i}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    {/* Avatar */}
                    <div className="relative h-6 w-6 shrink-0 rounded-full overflow-hidden">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: user.cursorColor }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Name + cursor color indicator */}
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-xs text-[var(--text-primary)]">
                        {user.name}
                        {user.isSelf && (
                          <span className="ml-1 text-[var(--text-muted)]">(you)</span>
                        )}
                      </span>
                    </div>

                    {/* Cursor color dot */}
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: user.cursorColor }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

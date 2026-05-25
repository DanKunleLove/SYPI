"use client";

import { useOther } from "@liveblocks/react";

interface CursorsCursorProps {
  userId: string;
  connectionId: number;
}

/**
 * Custom cursor for Liveblocks React Flow.
 * Small SVG arrow with colored name label.
 * Must be a plain function component (no memo — Liveblocks useStableComponent requires it).
 */
export function CustomCursor({ connectionId }: CursorsCursorProps) {
  const info = useOther(connectionId, (other) => other.info) as
    | { name?: string; avatar?: string; cursorColor?: string }
    | undefined;

  const color = info?.cursorColor ?? "#6366f1";
  const name = info?.name ?? "Anonymous";

  return (
    <div className="pointer-events-none relative" style={{ zIndex: 9999 }}>
      {/* Small 16px cursor arrow */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
      >
        <path
          d="M0.928711 0.0715332L15.0713 11.8491L8.13998 12.8527L4.85123 19.3276L0.928711 0.0715332Z"
          fill={color}
        />
        <path
          d="M0.928711 0.0715332L15.0713 11.8491L8.13998 12.8527L4.85123 19.3276L0.928711 0.0715332Z"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.8"
        />
      </svg>

      {/* Name pill */}
      <div
        className="absolute left-3.5 top-4 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-medium text-white shadow-sm"
        style={{
          backgroundColor: color,
          maxWidth: 80,
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: "14px",
        }}
      >
        {name}
      </div>
    </div>
  );
}

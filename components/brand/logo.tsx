import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Show the "SYPI" wordmark next to the glyph */
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { box: "h-7 w-7", icon: "h-3.5 w-3.5", text: "text-sm" },
  md: { box: "h-8 w-8", icon: "h-4 w-4", text: "text-sm" },
  lg: { box: "h-9 w-9", icon: "h-5 w-5", text: "text-xl" },
} as const;

/**
 * Unified SYPI brand mark — a GitBranch glyph in an accent box + wordmark.
 * Single source of truth for the logo across the app. Inside a `group`
 * parent the box picks up the hover-accent color.
 */
export function Logo({ showText = true, size = "md", className }: LogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("flex items-center gap-2.5 select-none", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)] transition-colors group-hover:bg-[var(--accent-hover)]",
          s.box
        )}
      >
        <GitBranch className={cn("text-white", s.icon)} />
      </span>
      {showText && (
        <span className={cn("whitespace-nowrap font-bold tracking-tight text-[var(--text-primary)]", s.text)}>
          SYPI
        </span>
      )}
    </span>
  );
}

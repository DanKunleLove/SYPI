"use client";

import { Check, Copy, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportRow({
  icon: Icon,
  label,
  description,
  actionLabel,
  loading,
  copied,
  onClick,
  onCopy,
}: {
  icon: typeof FileText;
  label: string;
  description: string;
  actionLabel: string;
  loading?: boolean;
  copied?: boolean;
  onClick?: () => void;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]">
        <Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onCopy && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={onCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[var(--state-success)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
        {onClick && (
          <Button
            variant="ghost"
            disabled={loading}
            onClick={onClick}
            className="h-6 px-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

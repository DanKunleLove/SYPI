"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Bug, MessageSquareWarning, Lightbulb, MessageCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "spi:open-feedback";

/** Open the global feedback dialog from anywhere (sidebar, help panel, palette). */
export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const TYPES = [
  { id: "bug", label: "Bug", icon: Bug },
  { id: "complaint", label: "Complaint", icon: MessageSquareWarning },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "other", label: "Other", icon: MessageCircle },
] as const;

type FeedbackType = (typeof TYPES)[number]["id"];

/**
 * Global feedback dialog. Mounted once in the workspace layout; opened via
 * the spi:open-feedback window event.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  const canSubmit = message.trim().length > 0 && !sending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim(), path: pathname }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send feedback");
      }
      setOpen(false);
      setMessage("");
      setType("bug");
      toast.success("Feedback sent — we read every one.", {
        description: "Thank you for helping make SYPI better.",
      });
    } catch (error) {
      toast.error("Couldn't send feedback", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Something broken, missing, or annoying? Tell us — it lands directly with the
            team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                  type === id
                    ? "border-[var(--accent-ai)]/50 bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                    : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
            placeholder={
              type === "bug"
                ? "What happened, and what did you expect instead?"
                : type === "idea"
                  ? "What would make SYPI better for you?"
                  : "Tell us what's on your mind…"
            }
            rows={5}
            autoFocus
          />
          <p className="text-right text-[11px] text-[var(--text-muted)]">
            {message.length}/2000
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

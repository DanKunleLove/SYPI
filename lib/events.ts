"use client";

import { track } from "@vercel/analytics";

/** Client-side event types accepted by POST /api/events (server events are recorded directly). */
export type ClientUsageEvent =
  | "spec_exported"
  | "png_exported"
  | "mermaid_exported"
  | "bundle_exported"
  | "share_invited"
  | "onboarding_done"
  | "checklist_step"
  | "palette_used"
  | "domain_selected";

/**
 * Record a product usage event. Fire-and-forget: writes to our own UsageEvent
 * table (the activation/retention source of truth) and mirrors to Vercel
 * Analytics when the plan supports custom events.
 */
export function recordEvent(type: ClientUsageEvent, meta?: Record<string, string>) {
  try {
    track(type, meta);
  } catch {
    // Vercel Analytics unavailable — our own table still records it.
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, meta }),
    keepalive: true,
  }).catch(() => {});
}

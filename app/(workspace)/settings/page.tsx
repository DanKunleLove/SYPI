import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModelSettings } from "@/components/settings/model-settings";
import { InstructionsSettings } from "@/components/settings/instructions-settings";

export default function SettingsPage() {
  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <h1 className="text-xl font-semibold text-[var(--text-primary)]">AI settings</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Bring your own keys to power generation with Claude, GPT, or Gemini, and teach your AI
        Twin how you like to work. Keys are encrypted at rest and never leave the server.
      </p>

      <div className="mt-8 space-y-6">
        <InstructionsSettings />
        <ModelSettings />
      </div>
    </div>
  );
}

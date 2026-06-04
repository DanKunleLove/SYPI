import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ShareCanvasViewer } from "@/components/share/share-canvas-viewer";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/share/${token}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { title: "Shared Architecture — spi AI" };
  const data = await res.json();
  return {
    title: `${data.name} — spi AI`,
    description: `View this system architecture shared from spi AI.`,
    openGraph: data.thumbnailUrl ? { images: [data.thumbnailUrl] } : undefined,
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/share/${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) notFound();

  const { name, canvasJsonPath } = await res.json() as {
    name: string;
    canvasJsonPath: string | null;
  };

  // Load canvas data from Vercel Blob
  let nodes: unknown[] = [];
  let edges: unknown[] = [];
  if (canvasJsonPath) {
    try {
      const canvas = await fetch(canvasJsonPath, { cache: "no-store" });
      if (canvas.ok) {
        const data = await canvas.json();
        nodes = data.nodes ?? [];
        edges = data.edges ?? [];
      }
    } catch {
      // Canvas not available — show empty view
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div className="h-4 w-px bg-[var(--border-default)]" />
          <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[300px]">
            {name}
          </span>
          <span className="rounded-full bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
            View only
          </span>
        </div>
        <Link
          href="/sign-up"
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-ai)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-ai)]/90 transition-colors"
        >
          Build yours free
          <ExternalLink className="h-3 w-3" />
        </Link>
      </header>

      {/* Canvas viewer */}
      <div className="flex-1 overflow-hidden">
        <ShareCanvasViewer nodes={nodes} edges={edges} />
      </div>

      {/* Footer */}
      <footer className="flex h-8 shrink-0 items-center justify-center border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-[10px] text-[var(--text-muted)]">
          Shared via{" "}
          <Link href="/welcome" className="text-[var(--accent-ai)] hover:underline">
            spi AI
          </Link>{" "}
          — design systems at the speed of thought
        </p>
      </footer>
    </div>
  );
}

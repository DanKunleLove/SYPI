import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Sparkles,
  GitBranch,
  Users,
  FileText,
  Zap,
  Shield,
  Package,
  ArrowRight,
  Check,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "spi AI — Design systems at the speed of thought",
  description:
    "Describe your system architecture in plain English. spi AI maps it to a real-time collaborative canvas your whole team can refine.",
};

export default async function WelcomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Nav */}
      <nav className="flex h-16 items-center justify-between border-b border-[var(--border-default)] px-6 md:px-12">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <ThemeToggle className="h-9 w-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          <Link
            href="/sign-in"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-8 overflow-hidden px-6 py-24 text-center md:py-36">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(ellipse, rgba(37,99,235,0.28) 0%, rgba(147,197,253,0.12) 40%, transparent 70%)",
          }}
        />

        <div className="relative space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-ai)]/30 bg-[var(--accent-ai)]/10 px-4 py-1.5 text-xs font-medium text-[var(--accent-ai)]">
            <Sparkles className="h-3 w-3" />
            AI-powered system architecture
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Design systems at the{" "}
            <span className="bg-gradient-to-r from-[var(--accent-ai)] to-[var(--accent-primary)] bg-clip-text text-transparent">
              speed of thought
            </span>
          </h1>

          <p className="mx-auto max-w-xl text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
            Describe your architecture in plain English. spi AI maps it to a
            real-time collaborative canvas — then exports a spec, a Mermaid
            diagram, or a full agent bundle your AI coding agent can implement.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent-primary)]/25 hover:bg-[var(--accent-hover)] transition-all"
            >
              Start designing free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Canvas preview mockup */}
        <div className="relative mt-8 w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl shadow-black/50">
          <div className="flex h-10 items-center gap-1.5 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--state-error)]/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--state-warning)]/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--state-success)]/60" />
            <span className="ml-3 text-xs text-[var(--text-muted)]">spi AI · E-Commerce Platform</span>
          </div>
          <div
            className="h-64 w-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.04) 0%, transparent 60%)",
              backgroundImage:
                "radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {/* Simplified architecture illustration */}
            <div className="flex h-full items-center justify-center gap-4 p-6 opacity-80">
              {[
                { label: "Web Client", cat: "CLIENT", color: "#0ea5e9" },
                { label: "API Gateway", cat: "GATEWAY", color: "#2563eb" },
                { label: "Order Service", cat: "SERVICE", color: "#1d4ed8" },
                { label: "PostgreSQL", cat: "DATABASE", color: "#16a34a" },
              ].map((n, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-16 w-28 flex-col items-start gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] p-2.5 shadow-lg">
                    <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate w-full">{n.label}</p>
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-medium"
                      style={{ background: `${n.color}20`, color: n.color }}
                    >
                      {n.cat}
                    </span>
                  </div>
                  {i < 3 && (
                    <div className="absolute translate-x-16 h-px w-8 bg-[var(--border-subtle)]" style={{ marginTop: -28 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--border-default)] px-6 py-20 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight md:text-3xl">
            Everything you need to go from idea to implementation
          </h2>
          <p className="mb-12 text-center text-sm text-[var(--text-muted)]">
            Built for developers, architects, and technical teams.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Sparkles,
                color: "var(--accent-ai)",
                title: "AI generation",
                body: "Describe your system and the AI Twin drafts a plan, gets your approval, then builds the canvas — with labels on every connection.",
              },
              {
                icon: Users,
                color: "var(--accent-primary)",
                title: "Real-time collaboration",
                body: "Live cursors, presence avatars, inline comments, and @mentions. Multiple people on the same canvas simultaneously.",
              },
              {
                icon: Shield,
                color: "var(--state-success)",
                title: "AI design review",
                body: "One-click critique surfaces single points of failure, missing layers, and security gaps — with a Fix All with AI button.",
              },
              {
                icon: Zap,
                color: "var(--state-warning)",
                title: "Smart suggestions",
                body: "Pattern detection flags missing caches, ungated services, and direct client-to-database connections as you build.",
              },
              {
                icon: Package,
                color: "var(--accent-ai)",
                title: "Agent bundle export",
                body: "Export a ZIP with CLAUDE.md, ARCHITECTURE.md, spi-schema.json, and TASKS.md — ready for Claude Code, Codex, or any AI agent.",
              },
              {
                icon: FileText,
                color: "var(--accent-primary)",
                title: "Multiple export formats",
                body: "PNG image for slides, Mermaid for GitHub docs, Markdown spec for humans, Lovable/v0 prompts for vibe-coding.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-subtle)] transition-colors"
              >
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${f.color} 15%, transparent)` }}
                >
                  <f.icon className="h-4.5 w-4.5" style={{ color: f.color }} />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-[var(--text-primary)]">{f.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-20 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
            From idea to implementation in minutes
          </h2>
          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Describe your system",
                body: "Type what you want to build. The AI Twin drafts a plan and shows it to you before touching the canvas.",
              },
              {
                step: "02",
                title: "Approve and generate",
                body: "Review the plan, make edits if needed, then approve. Nodes appear on the canvas with connections and labels.",
              },
              {
                step: "03",
                title: "Refine with your team",
                body: "Edit nodes, add connections, invite collaborators. Run a design review to catch issues before they become problems.",
              },
              {
                step: "04",
                title: "Export and hand off",
                body: "Download a PNG for slides, a Markdown spec for docs, or the Agent Bundle for your AI coding agent to implement.",
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-raised)] text-xs font-bold text-[var(--accent-ai)]">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{s.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border-default)] px-6 py-20 text-center md:px-12">
        <div className="mx-auto max-w-xl space-y-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Start designing your first system
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Free to use. No credit card required.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent-primary)]/25 hover:bg-[var(--accent-hover)] transition-all"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="flex flex-wrap justify-center gap-4 text-xs text-[var(--text-muted)]">
            {["No credit card", "Real-time collaboration", "Export to any format", "BYOK support"].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-[var(--state-success)]" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-default)] px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Logo size="sm" />
          <p className="text-xs text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} spi AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Sparkles,
  FileText,
  Zap,
  Shield,
  Package,
  ArrowRight,
  Check,
  Boxes,
  Cloud,
  Network,
  Workflow,
  KeyRound,
  MessageSquare,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroDiagram } from "@/components/marketing/hero-diagram";

export const metadata = {
  title: "spi AI — Design systems you can see and control",
  description:
    "Describe your architecture in plain English. spi AI drafts a plan, waits for your approval, then maps it to a real-time collaborative canvas your whole team can refine — and exports a spec your AI coding agent can build.",
};

const STACK = ["Claude", "Next.js", "Liveblocks", "Trigger.dev", "Vercel"];

const TEMPLATES = [
  { icon: Network, name: "Microservices", meta: "11 nodes", desc: "API gateway, services, Redis, Kafka, and split datastores." },
  { icon: Cloud, name: "Serverless", meta: "8 nodes", desc: "CDN, API Gateway, Lambdas, DynamoDB, S3, and queues." },
  { icon: Workflow, name: "Event-driven", meta: "9 nodes", desc: "CQRS + event sourcing with a dead-letter queue." },
  { icon: Boxes, name: "API Gateway", meta: "10 nodes", desc: "Kong gateway, services, cache, and an analytics store." },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Smart suggestions",
    body: "Pattern detection flags missing caches, ungated services, and direct client-to-database links as you build.",
  },
  {
    icon: KeyRound,
    title: "Bring your own model",
    body: "Use your own Claude, GPT, or Gemini key. Pick a default model per account — your keys are encrypted at rest.",
  },
  {
    icon: Package,
    title: "Agent bundle export",
    body: "Export a ZIP with CLAUDE.md, ARCHITECTURE.md, spi-schema.json, and TASKS.md — ready for Claude Code or any agent.",
  },
  {
    icon: FileText,
    title: "Every format you need",
    body: "PNG for slides, Mermaid for GitHub docs, a Markdown spec for humans, and prompts for Lovable or v0.",
  },
  {
    icon: MessageSquare,
    title: "Inline comments",
    body: "Threaded comments with @mentions and email notifications — discuss the design right on the canvas.",
  },
  {
    icon: Boxes,
    title: "Template library",
    body: "Start from microservices, serverless, event-driven, or API-gateway patterns instead of a blank page.",
  },
];

const STEPS = [
  { step: "01", title: "Describe your system", body: "Type what you want to build. The AI Twin reads it and drafts a plan — before touching the canvas." },
  { step: "02", title: "Approve the plan", body: "Review the components and flows, edit anything, then approve. Nothing is generated until you say so." },
  { step: "03", title: "Refine with your team", body: "Edit nodes, add connections, invite collaborators, and run a design review to catch issues early." },
  { step: "04", title: "Export and hand off", body: "Ship a PNG, a Markdown spec, or the Agent Bundle your AI coding agent can implement directly." },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
      {children}
    </span>
  );
}

export default async function WelcomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* ───────── Nav ───────── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-base)_85%,transparent)] backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo size="md" />
          <div className="hidden items-center gap-8 md:flex">
            {[
              { label: "Features", href: "#features" },
              { label: "Templates", href: "#templates" },
              { label: "How it works", href: "#how" },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
            <Link
              href="/sign-in"
              className="hidden rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden border-b border-[var(--border-default)]">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at center top, color-mix(in srgb, var(--accent-ai-glow) 35%, transparent) 0%, transparent 65%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Plan-then-execute AI · bring your own model
            </div>

            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Design systems you can{" "}
              <span className="text-[var(--accent-primary)]">see and control</span>
            </h1>

            <p className="max-w-xl text-pretty text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
              Describe your architecture in plain English. spi AI drafts a plan,
              waits for your approval, then maps it to a real-time collaborative
              canvas — every decision yours, then exported as a spec your AI
              coding agent can build.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent-primary)]/20 transition-all hover:bg-[var(--accent-hover)]"
              >
                Start designing free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
              >
                See how it works
              </Link>
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs text-[var(--text-muted)]">
              {["No credit card", "Real-time collaboration", "Export to any format"].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <HeroDiagram />
        </div>
      </section>

      {/* ───────── Trust strip (honest: the real stack) ───────── */}
      <section className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 md:flex-row md:justify-between">
          <p className="text-sm text-[var(--text-muted)]">Built on the tools you already trust</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {STACK.map((name) => (
              <span key={name} className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Control narrative — Plan first ───────── */}
      <section className="border-b border-[var(--border-default)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-24 lg:grid-cols-2">
          <div className="space-y-5">
            <SectionEyebrow>Plan first, build second</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              The AI proposes. You approve.
            </h2>
            <p className="text-base leading-relaxed text-[var(--text-secondary)]">
              No black box. The AI Twin reads your prompt and writes a plain
              human-readable plan — the components, the key flows, the trade-offs.
              You read it, edit it, and only then does it build. Every connection
              on the canvas carries a label so the design explains itself.
            </p>
            <ul className="space-y-3 pt-1">
              {[
                "See the reasoning before any node is placed",
                "Edit or re-plan without regenerating from scratch",
                "Follow-up prompts refine the canvas instead of wiping it",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/12">
                    <Check className="h-3 w-3 text-[var(--accent-primary)]" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Plan card mock */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xl shadow-black/5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary)]/12">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              </div>
              <span className="text-sm font-semibold">Proposed plan</span>
              <span className="ml-auto rounded-full bg-[var(--state-success)]/12 px-2 py-0.5 text-[11px] font-medium text-[var(--state-success)]">
                Awaiting approval
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-[var(--text-secondary)]">
                A horizontally-scalable e-commerce backend with a cache layer and
                async order processing.
              </p>
              <div className="space-y-2">
                {[
                  { label: "API Gateway", note: "auth, rate limiting" },
                  { label: "Order Service", note: "writes to Postgres" },
                  { label: "Redis", note: "read-through cache" },
                  { label: "Kafka", note: "order events → workers" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2"
                  >
                    <span className="font-medium text-[var(--text-primary)]">{row.label}</span>
                    <span className="text-xs text-[var(--text-muted)]">{row.note}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="flex-1 rounded-lg bg-[var(--accent-primary)] py-2 text-center text-sm font-semibold text-white">
                Approve &amp; generate
              </span>
              <span className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-center text-sm text-[var(--text-secondary)]">
                Refine
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Collaboration ───────── */}
      <section className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-24 lg:grid-cols-2">
          {/* Visual */}
          <div className="order-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-6 shadow-xl shadow-black/5 lg:order-1">
            <div className="flex items-center gap-2">
              {[
                { initial: "A", color: "#2563eb" },
                { initial: "M", color: "#0891b2" },
                { initial: "K", color: "#16a34a" },
              ].map((u) => (
                <div
                  key={u.initial}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-[var(--bg-base)]"
                  style={{ background: u.color }}
                >
                  {u.initial}
                </div>
              ))}
              <span className="ml-2 text-xs text-[var(--text-muted)]">3 people editing</span>
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold" style={{ color: "#2563eb" }}>Ada</span>
                  <span className="text-[var(--text-muted)]">commented on Order Service</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--text-primary)]">
                  Should this go through the queue instead of writing directly?
                  <span className="ml-1 rounded bg-[var(--accent-primary)]/12 px-1 text-[var(--accent-primary)]">@maya</span>
                </p>
              </div>
              <div className="ml-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold" style={{ color: "#0891b2" }}>Maya</span>
                  <span className="text-[var(--text-muted)]">replied</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--text-primary)]">Agreed — routing it through Kafka now.</p>
              </div>
            </div>
          </div>

          <div className="order-1 space-y-5 lg:order-2">
            <SectionEyebrow>Built for teams</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Your whole team, one canvas
            </h2>
            <p className="text-base leading-relaxed text-[var(--text-secondary)]">
              Live cursors, presence avatars, and threaded comments with
              @mentions — multiple people refining the same architecture at the
              same time. Mention a teammate and they get an email. No more
              screenshots in Slack.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── Design review ───────── */}
      <section className="border-b border-[var(--border-default)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-24 lg:grid-cols-2">
          <div className="space-y-5">
            <SectionEyebrow>AI design review</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Catch problems before they ship
            </h2>
            <p className="text-base leading-relaxed text-[var(--text-secondary)]">
              One click runs a critique across your design — single points of
              failure, missing layers, and security gaps — grouped by severity,
              each with a concrete fix. Hit <span className="font-medium text-[var(--text-primary)]">Fix all with AI</span> and the
              Twin applies them.
            </p>
          </div>

          {/* Critique mock */}
          <div className="space-y-3">
            {[
              { sev: "Critical", color: "var(--state-error)", title: "Single point of failure", body: "PostgreSQL has no replica. Add a read replica or failover." },
              { sev: "Warning", color: "var(--state-warning)", title: "No cache layer", body: "Order Service reads Postgres directly on every request." },
              { sev: "Suggestion", color: "var(--accent-primary)", title: "Ungated service", body: "Auth Service is reachable without the gateway." },
            ].map((issue) => (
              <div
                key={issue.title}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: `color-mix(in srgb, ${issue.color} 14%, transparent)`, color: issue.color }}
                  >
                    {issue.sev}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{issue.title}</span>
                  <Shield className="ml-auto h-4 w-4 text-[var(--text-muted)]" />
                </div>
                <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{issue.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Templates ───────── */}
      <section id="templates" className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] scroll-mt-16">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="mb-12 max-w-2xl space-y-3">
            <SectionEyebrow>Templates</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Start from a proven pattern
            </h2>
            <p className="text-base text-[var(--text-secondary)]">
              Load a complete architecture in one click and adapt it — or describe
              your own and let the AI Twin draft it.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.name}
                className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-5 transition-all hover:border-[var(--border-subtle)] hover:shadow-lg hover:shadow-black/5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10">
                  <t.icon className="h-5 w-5 text-[var(--accent-primary)]" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</h3>
                  <span className="text-[11px] text-[var(--text-muted)]">{t.meta}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Feature grid ───────── */}
      <section id="features" className="border-b border-[var(--border-default)] scroll-mt-16">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="mb-12 max-w-2xl space-y-3">
            <SectionEyebrow>Everything else</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              From idea to implementation
            </h2>
            <p className="text-base text-[var(--text-secondary)]">
              The details that turn a diagram into something your team — and your
              AI agent — can actually build.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[var(--bg-surface)] p-6 transition-colors hover:bg-[var(--bg-surface-raised)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10">
                  <f.icon className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-[var(--text-primary)]">{f.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="how" className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] scroll-mt-16">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <div className="mb-12 max-w-2xl space-y-3">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              From idea to implementation in minutes
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.step} className="flex gap-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-sm font-bold text-[var(--accent-primary)]">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="border-b border-[var(--border-default)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div
            className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] px-8 py-16 text-center"
            style={{ background: "color-mix(in srgb, var(--powder) 30%, var(--bg-surface))" }}
          >
            <div className="relative mx-auto max-w-xl space-y-6">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Design your first system today
              </h2>
              <p className="text-base text-[var(--text-secondary)]">
                Free to use. Bring your own model. No credit card required.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent-primary)]/25 transition-all hover:bg-[var(--accent-hover)]"
              >
                Start designing free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="space-y-3">
              <Logo size="md" />
              <p className="max-w-xs text-sm text-[var(--text-muted)]">
                The real-time collaborative workspace for system architecture.
                Design it, review it, ship the spec.
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Product</h4>
              <ul className="space-y-2 text-sm">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Templates", href: "#templates" },
                  { label: "How it works", href: "#how" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Get started</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/sign-up" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[var(--border-default)] pt-6 sm:flex-row">
            <p className="text-xs text-[var(--text-muted)]">
              &copy; {new Date().getFullYear()} spi AI. All rights reserved.
            </p>
            <p className="text-xs text-[var(--text-muted)]">Design systems at the speed of thought.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

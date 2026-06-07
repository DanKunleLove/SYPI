import { Cpu, Users, FileText } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  {
    icon: Cpu,
    title: "AI Architecture Generation",
    description:
      "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    description:
      "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: FileText,
    title: "Instant Spec Generation",
    description:
      "Export a complete Markdown technical spec directly from the canvas graph.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[var(--bg-surface)] p-14">
        {/* Logo */}
        <Logo size="lg" />

        {/* Tagline + features */}
        <div className="space-y-12">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--text-primary)]">
              Design systems at the
              <br />
              speed of thought.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-[var(--text-secondary)]">
              Describe your architecture in plain English. SYPI maps it to a
              shared canvas your whole team can refine in real time.
            </p>
          </div>

          <ul className="space-y-6">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-raised)]">
                  <feature.icon className="h-5 w-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-base font-medium text-[var(--text-primary)]">
                    {feature.title}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-sm text-[var(--text-muted)]">
          &copy; {new Date().getFullYear()} SYPI. All rights reserved.
        </p>
      </div>

      {/* Right panel — Clerk form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {/* Mobile logo (hidden on desktop) */}
        <Logo size="lg" className="mb-10 lg:hidden" />

        {children}
      </div>
    </div>
  );
}

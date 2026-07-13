import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
] as const;

/** Tab nav shared by the admin pages. */
export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mt-4 flex gap-1 border-b border-[var(--border-default)]">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-1.5 text-[13px] transition-colors",
            active === t.href
              ? "border-[var(--accent-ai)] font-medium text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function DashboardNavbar({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  return (
    <nav className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-6">
      {/* Logo */}
      <Link href="/" className="group flex items-center">
        <Logo />
      </Link>

      {/* Search */}
      <div className="relative ml-auto max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] py-1.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--border-subtle)]"
        />
      </div>

      {/* User */}
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-8 w-8",
          },
        }}
      >
        <UserButton.MenuItems>
          <UserButton.Link
            label="Models & API keys"
            labelIcon={<SlidersHorizontal className="h-4 w-4" />}
            href="/settings"
          />
        </UserButton.MenuItems>
      </UserButton>
    </nav>
  );
}

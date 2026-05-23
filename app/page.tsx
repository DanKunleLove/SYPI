import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold text-[var(--text-primary)]">spi AI</h1>
      <p className="text-[var(--text-secondary)]">
        AI-powered system architecture design
      </p>
      <Link
        href="/sign-in"
        className="rounded-lg bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
      >
        Get Started
      </Link>
    </div>
  );
}

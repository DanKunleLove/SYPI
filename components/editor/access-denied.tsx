"use client";

import { motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)]">
          <ShieldX className="h-8 w-8 text-[var(--state-error)]" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Access Denied
        </h1>
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">
          This project doesn&apos;t exist or you don&apos;t have permission to
          view it.
        </p>
        <Link href="/" className={buttonVariants({ className: "mt-2" })}>
          Back to Projects
        </Link>
      </motion.div>
    </div>
  );
}

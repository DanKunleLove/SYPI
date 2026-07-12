import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { FeedbackBoard, type AdminFeedbackItem } from "@/components/admin/feedback-board";
import { ComplaintRadar, type RadarItem } from "@/components/admin/complaint-radar";
import { MetricsPanel } from "@/components/admin/metrics-panel";
import { getPlatformMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const [feedbackRows, downvoted, metrics] = await Promise.all([
    prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.aIGeneration.findMany({
      where: { rating: -1 },
      orderBy: { updatedAt: "desc" },
      take: 25,
      include: {
        project: { select: { name: true, user: { select: { email: true } } } },
      },
    }),
    getPlatformMetrics(),
  ]);

  const feedback: AdminFeedbackItem[] = feedbackRows.map((f) => ({
    id: f.id,
    type: f.type,
    message: f.message,
    path: f.path,
    status: f.status,
    adminNote: f.adminNote,
    createdAt: f.createdAt.toISOString(),
    userEmail: f.user.email,
    userName: f.user.name,
  }));

  const radar: RadarItem[] = downvoted.map((g) => ({
    id: g.id,
    prompt: g.prompt,
    type: g.type,
    createdAt: g.createdAt.toISOString(),
    projectName: g.project.name,
    ownerEmail: g.project.user.email,
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Feedback, complaints, and platform signals — visible only to admins.
        </p>

        <div className="mt-6 space-y-8">
          <MetricsPanel metrics={metrics} />
          <FeedbackBoard initial={feedback} />
          <ComplaintRadar items={radar} />
        </div>
      </div>
    </div>
  );
}

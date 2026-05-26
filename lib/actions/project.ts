"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";

/** Get the internal DB user from Clerk auth — auto-creates if missing */
async function requireUser() {
  const user = await getDbUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/** Fetch all projects owned by the current user */
export async function getMyProjects() {
  const user = await requireUser();

  return prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { collaborators: true } },
    },
  });
}

/** Fetch all projects shared with the current user */
export async function getSharedProjects() {
  const user = await requireUser();

  const collaborations = await prisma.collaborator.findMany({
    where: {
      OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
    },
    include: {
      project: {
        include: {
          user: { select: { name: true, imageUrl: true, email: true } },
          _count: { select: { collaborators: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return collaborations.map((c) => ({
    ...c.project,
    role: c.role,
    owner: c.project.user,
  }));
}

/** Create a new project */
export async function createProject(data: { name: string; description?: string }) {
  const user = await requireUser();

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: data.name.trim() || "Untitled Project",
      description: data.description?.trim() || null,
    },
  });

  revalidatePath("/");
  return project;
}

/** Rename a project */
export async function renameProject(projectId: string, name: string) {
  const user = await requireUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== user.id) throw new Error("Forbidden");

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return updated;
}

/** Duplicate a project */
export async function duplicateProject(projectId: string) {
  const user = await requireUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== user.id) throw new Error("Forbidden");

  const copy = await prisma.project.create({
    data: {
      userId: user.id,
      name: `${project.name} (Copy)`,
      description: project.description,
    },
  });

  revalidatePath("/");
  return copy;
}

/** Delete a project */
export async function deleteProject(projectId: string) {
  const user = await requireUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== user.id) throw new Error("Forbidden");

  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/");
  return { success: true };
}

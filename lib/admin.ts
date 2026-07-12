import { getDbUser } from "@/lib/project-access";

/**
 * Admin gating via ADMIN_EMAILS env (comma-separated, case-insensitive).
 * Returns the DB user when they are an admin, null otherwise.
 */
export async function getAdminUser() {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return null;

  const user = await getDbUser();
  if (!user) return null;

  const admins = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(user.email.toLowerCase()) ? user : null;
}

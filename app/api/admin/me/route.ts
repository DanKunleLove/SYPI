import { getAdminUser } from "@/lib/admin";

/** Whether the current user is an admin — used to show the sidebar Admin link. */
export async function GET() {
  const admin = await getAdminUser();
  return Response.json({ admin: !!admin });
}

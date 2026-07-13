import { notFound } from "next/navigation";
import { getAdminUser, getAdminUsers } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { UsersTable } from "@/components/admin/users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const users = await getAdminUsers();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage users: roles, suspensions, and per-user generation limits.
        </p>
        <AdminNav active="/admin/users" />
        <div className="mt-6">
          <UsersTable initial={users} />
        </div>
      </div>
    </div>
  );
}

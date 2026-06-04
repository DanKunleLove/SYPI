import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Root redirect: authed → /dashboard, unauthed → /welcome (landing). */
export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  redirect("/welcome");
}

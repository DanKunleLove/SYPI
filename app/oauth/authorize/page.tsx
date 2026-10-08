import { headers } from "next/headers";
import { getDbUser } from "@/lib/project-access";
import { OAuthConfigError, resolveClient, resourceIsOurs, sign } from "@/lib/mcp/oauth";

/**
 * The consent screen. Reached from an MCP client (ChatGPT, Claude) after it
 * discovered us; Clerk sends a signed-out visitor to sign in first and back here.
 *
 * Every parameter is validated BEFORE anything is shown, and a bad client or
 * redirect URI renders an error here rather than redirecting — redirecting to an
 * unvalidated URI is exactly the open-redirect this page exists to prevent.
 */

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Can&apos;t connect</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{children}</p>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const clientId = one(q.client_id);
  const redirectUri = one(q.redirect_uri);
  const challenge = one(q.code_challenge);

  if (one(q.response_type) !== "code" || !clientId || !redirectUri) {
    return <Problem>The connecting app sent an incomplete request. Try connecting again from the app.</Problem>;
  }
  if (!challenge || one(q.code_challenge_method) !== "S256") {
    return <Problem>The connecting app did not use PKCE (S256), which SYPI requires.</Problem>;
  }

  let client;
  try {
    client = resolveClient(clientId, redirectUri);
  } catch (e) {
    if (e instanceof OAuthConfigError) return <Problem>{e.message}</Problem>;
    throw e;
  }
  if (!client) {
    return <Problem>SYPI doesn&apos;t recognise that app or where it wants to send you, so nothing was approved.</Problem>;
  }

  // The origin this request arrived on — the same one the discovery metadata
  // advertised — rather than an env var that could disagree with it.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host && !resourceIsOurs(one(q.resource), `${proto}://${host}`)) {
    return <Problem>That app asked for access to a different server.</Problem>;
  }

  const user = await getDbUser();
  const returnHost = new URL(redirectUri).host;
  const ticket = sign(
    "ticket",
    { cid: clientId, ru: redirectUri, cc: challenge, st: one(q.state) ?? "", cn: client.name },
    600
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          Connect {client.name} to SYPI?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          {client.name} will be able to <strong>read and edit your SYPI projects</strong> — create
          projects, run planning, answer open decisions and fetch hand-off files — as{" "}
          <strong>{user?.email ?? "you"}</strong>. It won&apos;t see your password or your own AI
          provider keys.
        </p>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          You&apos;ll be sent back to <span className="font-mono">{returnHost}</span>. You can disconnect
          any time under Settings → Agent access.
        </p>

        <form action="/api/oauth/approve" method="post" className="mt-5 flex gap-2">
          <input type="hidden" name="ticket" value={ticket} />
          <button
            type="submit"
            name="decision"
            value="allow"
            className="flex-1 rounded-lg bg-[var(--accent-ai)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Allow
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="flex-1 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-base)]"
          >
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}

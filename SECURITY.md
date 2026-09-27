# Security policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub:
**[Report a vulnerability](https://github.com/DanKunleLove/SYPI/security/advisories/new)**
(Security tab → "Report a vulnerability").

Include what you found, how to reproduce it, and what an attacker could do with it.
You should get a first response within 5 days. Please give us a reasonable window
to ship a fix before disclosing publicly.

## Scope

In scope: this repository and the hosted instance at `sypi-dev.vercel.app`.

Areas we care most about:

- Authorisation — reaching another user's projects, specs or canvases
- The MCP endpoint and personal access tokens (`app/api/mcp`, `lib/mcp`)
- BYOK key storage (`lib/crypto.ts`) — keys are AES-256-GCM encrypted at rest
- Server-side URL fetching (`lib/ai/url-research.ts`) — SSRF
- Prompt injection that causes data to leak across projects

Out of scope: rate-limit bypasses on your own account, missing security headers
without a demonstrated impact, and issues in third-party services (Clerk,
Liveblocks, Neon, Vercel) — report those to the vendor.

## Supported versions

Only the latest commit on `main` receives security fixes.

# P6 — Deployment

## Goal

Deploy spi AI to production on Vercel with all services configured: database, Clerk auth, Liveblocks, Trigger.dev, and Claude API.

## Dependencies

- All previous phases complete and verified

## Scope

### Configure

- **Vercel project** — import `spi-ai` repo, connect to GitHub for auto-deploys
- **Environment variables** — all secrets configured in Vercel dashboard
- **Database** — Neon PostgreSQL accessible from Vercel's servers, production migration run
- **Clerk** — production API keys, redirect URLs updated for production domain
- **Liveblocks** — production API keys, allowed origins updated
- **Trigger.dev** — production environment configured, tasks deployed
- **Prisma** — `postinstall: prisma generate` in package.json

### Production Checklist

- [ ] `npm run build` passes locally with production env vars
- [ ] All environment variables set in Vercel dashboard
- [ ] `prisma migrate deploy` run against production database
- [ ] Clerk webhook endpoint updated to production URL
- [ ] Liveblocks allowed origins include production domain

### Verify End-to-End

- [ ] Landing page loads
- [ ] Sign up / sign in works
- [ ] Dashboard shows projects
- [ ] Create project -> navigate to workspace
- [ ] Canvas renders with real-time sync (test 2 browsers)
- [ ] AI generation produces nodes on canvas
- [ ] AI critique returns feedback
- [ ] Spec export downloads Markdown
- [ ] Templates load onto canvas
- [ ] No console errors in production

## Environment Variables

```bash
# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# Real-time (Liveblocks)
LIVEBLOCKS_SECRET_KEY=sk_live_...

# AI (Anthropic Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Background Jobs (Trigger.dev)
TRIGGER_SECRET_KEY=tr_prod_...

# Google AI Studio (canvas animations - optional)
GOOGLE_AI_API_KEY=...
```

## Common Issues

| Issue | Fix |
|-------|-----|
| `prisma: command not found` | Add `"postinstall": "prisma generate"` to package.json |
| `PrismaClientInitializationError` | Ensure DATABASE_URL set in Vercel env vars |
| Clerk redirect loop | Add production URL to Clerk allowed redirect URLs |
| Liveblocks connection refused | Add production domain to Liveblocks allowed origins |
| Trigger.dev tasks not found | Run `npx trigger.dev deploy` for production |
| Build timeout | Check for heavy imports, ensure no dev-only code in production |

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Verify — postinstall script |
| `.env.example` | Finalize — all required variables documented |
| `next.config.ts` | Verify — production-ready settings |
| `vercel.json` | Create if needed — Vercel config |

## Acceptance Criteria

- [ ] Push to main triggers successful Vercel build
- [ ] Production URL accessible, landing page renders
- [ ] Full auth flow works in production
- [ ] Canvas real-time sync works between two browsers
- [ ] AI generation completes successfully
- [ ] All features functional — no degradation from local dev
- [ ] No console errors in production
- [ ] All env vars documented in `.env.example`

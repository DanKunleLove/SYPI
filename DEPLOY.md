# Deploying spi AI to Production

## Prerequisites

- GitHub repo (connect it to Vercel)
- Accounts: Vercel, Neon, Clerk, Liveblocks, Google AI Studio, Trigger.dev
- Optional: Resend (email notifications), custom domain

---

## Step 1 — Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import from GitHub: **DanKunleLove/spi-ai**
3. Framework: **Next.js** (auto-detected)
4. Root directory: ` . ` (repo root — not `/docs`)
5. **Do not deploy yet** — set env vars first (Step 3)

---

## Step 2 — Neon Database

1. Go to [neon.tech](https://neon.tech) → create or use existing project
2. Get the **pooled** connection string (for `DATABASE_URL`) and the **direct** connection string (for `DIRECT_URL`)
3. After Vercel env vars are set, run migrations (Step 4)

---

## Step 3 — Environment Variables in Vercel

In Vercel → your project → **Settings → Environment Variables**, add all variables from `.env.example`:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | clerk.com dashboard → API Keys |
| `CLERK_SECRET_KEY` | clerk.com dashboard → API Keys |
| `DATABASE_URL` | Neon → Connection details (pooled) |
| `DIRECT_URL` | Neon → Connection details (direct/non-pooled) |
| `LIVEBLOCKS_SECRET_KEY` | liveblocks.io dashboard → API Keys |
| `LIVEBLOCKS_WEBHOOK_SECRET_KEY` | liveblocks.io → Webhooks (add after deploy) |
| `GOOGLE_AI_API_KEY` | aistudio.google.com → Get API key |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → create store |
| `TRIGGER_SECRET_KEY` | cloud.trigger.dev → API Keys |
| `ENCRYPTION_SECRET` | `openssl rand -base64 32` in terminal |
| `NEXT_PUBLIC_APP_URL` | Your production URL e.g. `https://spi.ai` |
| `RESEND_API_KEY` | resend.com (optional) |
| `EMAIL_FROM` | Your verified Resend domain email (optional) |

---

## Step 4 — Run Database Migrations

After setting `DATABASE_URL` and `DIRECT_URL` in your local `.env.local` (pointing to production Neon):

```bash
npx prisma migrate deploy
```

This applies all migrations to the production database. Run this once before the first deploy, and after any future schema changes.

---

## Step 5 — Deploy

Click **Deploy** in Vercel. The build runs `next build`. Expected time: ~2–3 minutes.

After deploy succeeds, visit your Vercel URL and test:
1. Visit `/welcome` → landing page renders
2. Sign up → redirects to `/dashboard`
3. Create project → canvas opens
4. Generate architecture → nodes appear
5. Save → thumbnail captures

---

## Step 6 — Configure Trigger.dev Production

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev) → your project → **Environments**
2. Add all environment variables from `.env.example` to the **Production** environment
   - Especially: `DATABASE_URL`, `GOOGLE_AI_API_KEY`, `LIVEBLOCKS_SECRET_KEY`, `ENCRYPTION_SECRET`, `BLOB_READ_WRITE_TOKEN`
3. Deploy workers: `npx trigger.dev@latest deploy` (from your local machine with production env vars)
4. Test generation from the Trigger.dev dashboard → **Test** tab

---

## Step 7 — Configure Clerk Webhook (Production)

In the Clerk dashboard → **Webhooks** → **Add endpoint**:
- URL: `https://yourdomain.com/api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`

This syncs Clerk users to the Neon database. Without it, users are auto-created on first login (dev convenience) but the webhook is more reliable for production.

---

## Step 8 — Configure Liveblocks Webhook

In the Liveblocks dashboard → **Webhooks** → **Add endpoint**:
- URL: `https://yourdomain.com/api/webhooks/liveblocks`
- Events: **Notification** (for @mention emails)

Copy the **Signing Secret** → add as `LIVEBLOCKS_WEBHOOK_SECRET_KEY` in Vercel env vars.

---

## Step 9 — Mintlify Docs (Optional)

1. Go to [dashboard.mintlify.com](https://dashboard.mintlify.com) → **Connect GitHub**
2. Select repo **DanKunleLove/spi-ai**, set docs root to `/docs`
3. Set custom domain: `docs.yourdomain.com`
4. Update `docs/mint.json`: change all URLs from `https://spi.ai/...` to your actual domain

---

## Step 10 — Custom Domain (Optional)

In Vercel → your project → **Settings → Domains**:
- Add `yourdomain.com` and `www.yourdomain.com`
- Follow DNS configuration instructions
- Update `NEXT_PUBLIC_APP_URL` in Vercel env vars to your custom domain
- Redeploy

---

## Production Checklist

- [ ] All 13 env vars set in Vercel
- [ ] `npx prisma migrate deploy` run against production DB
- [ ] Trigger.dev workers deployed with production env vars
- [ ] Tested: sign-up → generate → save → export
- [ ] Clerk webhook configured
- [ ] Liveblocks webhook configured (for email notifications)
- [ ] Custom domain added (optional)
- [ ] Mintlify docs connected (optional)
- [ ] GitHub repo set to Private (GitHub Settings → Danger Zone → Change visibility)

---

## Rollback

If a deploy breaks production:
1. In Vercel → **Deployments** → find the last good deploy → **Promote to Production**

Database migrations cannot be automatically rolled back. Keep a Neon backup point before each deploy that includes schema changes.

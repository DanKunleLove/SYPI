# Unit 03 — Authentication (Clerk)

## Goal

Add user authentication using Clerk. Users must sign in before accessing the editor or dashboard. Unauthenticated users see a landing/sign-in page.

## Why this matters

Every feature after this is user-scoped — projects belong to users, canvas sessions are tied to users, AI history is per-user. Auth is the foundation for all of that.

## Dependencies

- Spec 01 (Design System) — DONE
- Spec 02 (Editor Chrome) — provides the shell to protect

## What you'll learn

- How Clerk works with Next.js (middleware-based auth)
- Protected routes via `clerkMiddleware()`
- Server-side auth with `auth()` and `currentUser()`
- Client-side auth with `useUser()` and `<UserButton />`

## External setup (you do this manually)

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application called "spi AI"
3. Enable sign-in methods: Email + Google OAuth
4. Copy your API keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
5. Add them to `.env.local` (I'll create the file template)

## Scope

### Build

- **Clerk provider** wrapping the app in `layout.tsx`
- **Middleware** (`middleware.ts`) protecting `/editor` and `/dashboard` routes
- **Sign-in page** at `/sign-in` using Clerk's `<SignIn />` component, styled to match spi AI theme
- **Sign-up page** at `/sign-up` using Clerk's `<SignUp />` component
- **User button** in the sidebar (replacing the placeholder from spec 02)
- **Auth redirect** — unauthenticated users hitting `/editor` get sent to `/sign-in`
- **Environment variables** template (`.env.example`)

### Do NOT build

- User profiles or settings page
- Role-based access control
- Team/organization features

## Files to create/modify

| File | Action |
|------|--------|
| `middleware.ts` | Create — Clerk middleware with protected route matchers |
| `app/layout.tsx` | Modify — wrap with `<ClerkProvider>` |
| `app/sign-in/[[...sign-in]]/page.tsx` | Create — sign-in page |
| `app/sign-up/[[...sign-up]]/page.tsx` | Create — sign-up page |
| `components/editor/sidebar.tsx` | Modify — replace placeholder user area with `<UserButton />` |
| `.env.example` | Create — template for required env vars |
| `.env.local` | Create — actual env vars (gitignored) |

## Packages to install

```bash
npm install @clerk/nextjs
```

## Acceptance criteria

- [ ] Visiting `/editor` while signed out redirects to `/sign-in`
- [ ] Sign-in page renders with spi AI branding (dark theme)
- [ ] After sign-in, user is redirected to `/dashboard`
- [ ] `<UserButton />` appears in sidebar showing user avatar
- [ ] Sign-out works and redirects to home
- [ ] `.env.example` documents all required keys
- [ ] `npm run build` passes clean

## Key concepts to understand

### Middleware-based auth
Clerk uses Next.js middleware (`middleware.ts` in root) to intercept requests BEFORE they reach your pages. This is more secure than checking auth inside each page because the request never even gets to your code if the user isn't authenticated.

### ClerkProvider
This is a React context provider that makes auth state available to all components in your app. It wraps your entire app in `layout.tsx`, similar to how `TooltipProvider` wraps the app for tooltips.

### `auth()` vs `currentUser()`
- `auth()` — lightweight, returns just the user ID. Use in server components/actions when you just need to know WHO is making the request.
- `currentUser()` — heavier, returns full user object (name, email, avatar). Use when you need to display user info.

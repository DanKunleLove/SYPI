import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/welcome(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/share/(.*)",
  "/api/share/(.*)",
  "/api/webhooks(.*)",
  "/api/mcp", // authenticates with its own bearer token (lib/mcp/tokens.ts), not a Clerk session
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

/**
 * Wraps Clerk so its auth/user UI follows the app theme (light/dark) instead of
 * being hardcoded to dark. Reads the resolved theme from next-themes.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/welcome"
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          colorPrimary: isDark ? "#3b82f6" : "#1d4ed8",
          colorBackground: isDark ? "#111827" : "#ffffff",
          colorInputBackground: isDark ? "#1c2740" : "#f6f8fb",
          colorInputText: isDark ? "#f1f5f9" : "#0b1b33",
          colorForeground: isDark ? "#f1f5f9" : "#0b1b33",
          colorTextOnPrimaryBackground: "#ffffff",
          fontFamily: "Inter, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

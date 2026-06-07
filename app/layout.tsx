import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-ui",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://spi-ai-dev.vercel.app";

export const metadata: Metadata = {
  title: { default: "spi AI", template: "%s — spi AI" },
  description:
    "Describe your system in plain English. spi AI maps it to a real-time collaborative canvas, critiques the design, and exports a spec your AI coding agent can implement.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    siteName: "spi AI",
    title: "spi AI — Design systems at the speed of thought",
    description:
      "Describe your architecture in plain English. spi AI maps it to a live canvas, runs an AI design review, and exports a spec for Claude Code or any AI agent.",
    url: APP_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "spi AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "spi AI — Design systems at the speed of thought",
    description: "AI-powered real-time system architecture workspace.",
    images: ["/og.png"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  keywords: ["system design", "architecture diagram", "AI", "real-time collaboration"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/welcome"
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#6366f1",
              colorBackground: "#18181b",
              colorInputBackground: "#27272a",
              colorInputText: "#fafafa",
              colorForeground: "#fafafa",
              colorTextOnPrimaryBackground: "#ffffff",
              fontFamily: "Inter, sans-serif",
            },
            elements: {
              socialButtonsBlockButtonText: { color: "#fafafa" },
              socialButtonsBlockButton: { borderColor: "#3f3f46" },
              userButtonPopoverActionButton: { color: "#fafafa" },
              userButtonPopoverActionButtonIcon: { color: "#a1a1aa" },
              badge: { color: "#fafafa" },
              profileSectionContent: { color: "#fafafa" },
              activeDeviceListItem: { color: "#fafafa" },
            },
          }}
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

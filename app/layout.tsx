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

export const metadata: Metadata = {
  title: "spi AI",
  description:
    "Real-time collaborative system architecture workspace powered by AI",
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

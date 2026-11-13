import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { PageviewTracker } from "@/components/analytics-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "GiftyJifty: holiday gift planner and budget tracker", template: "%s · GiftyJifty" },
  description:
    "Plan holiday gifts without overspending: a budget for every person, gift ideas, a shared family list so nobody buys the same thing, and return reminders.",
  applicationName: "GiftyJifty",
  appleWebApp: { capable: true, title: "GiftyJifty", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: "GiftyJifty", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#221b17" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" />
          <PageviewTracker />
        </ThemeProvider>
      </body>
    </html>
  );
}

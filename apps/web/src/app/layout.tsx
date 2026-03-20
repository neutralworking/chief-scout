import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import { AuthProvider } from "@/components/AuthProvider";
import { isProduction } from "@/lib/env";

export const metadata: Metadata = {
  title: "Chief Scout — Player Intelligence Platform",
  description:
    "Role-fit scoring, personality profiling, and transfer intelligence for 19,000+ football players. The scouting platform that thinks like a Director of Football.",
  openGraph: {
    title: "Chief Scout — Player Intelligence Platform",
    description:
      "Role-fit scoring, personality profiling, and transfer intelligence for 19,000+ football players.",
    type: "website",
    siteName: "Chief Scout",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chief Scout — Player Intelligence Platform",
    description:
      "Role-fit scoring, personality profiling, and transfer intelligence for 19,000+ football players.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {isProduction() && (
          <Script
            defer
            data-domain="chief-scout-prod.vercel.app"
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <MobileBottomNav />
            <ServiceWorkerRegistration />
            <main className="flex-1 min-w-0 p-4 pb-24 lg:pb-8 lg:pt-8 lg:ml-64 lg:p-8">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

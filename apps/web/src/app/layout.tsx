import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import { Topbar } from "@/components/Topbar";
import { AuthProvider } from "@/components/AuthProvider";
import { isProduction } from "@/lib/env";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const clash = localFont({
  src: "../fonts/ClashDisplay-Variable.woff2",
  variable: "--font-clash",
  display: "swap",
});

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
    <html lang="en" className={`dark ${bricolage.variable} ${clash.variable}`}>
      <head>
        {isProduction() && (
          <Script
            defer
            data-domain="chief-scout-prod.vercel.app"
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
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
            <div className="flex-1 min-w-0 flex flex-col lg:ml-64">
              <Topbar />
              <main className="flex-1 min-w-0 p-4 pb-24 lg:pb-8 lg:p-8">{children}</main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

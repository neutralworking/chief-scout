import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Chief Scout",
  description: "Player Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
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
            <ServiceWorkerRegistration />
            <main className="flex-1 min-w-0 p-4 pt-16 lg:pt-8 lg:ml-64 lg:p-8">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kickoff Clash",
  description: "The football card game powered by Chief Scout",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] antialiased">
        <header className="border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <h1 className="text-xl font-black tracking-tight uppercase">
              <span className="text-[var(--accent-primary)]">Kickoff</span>{" "}
              <span className="text-[var(--accent-secondary)]">Clash</span>
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

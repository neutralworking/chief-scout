import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kickoff Clash",
  description: "The football card game powered by Chief Scout",
};

export default function KickoffClashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Hide the parent Chief Scout chrome (sidebar, topbar, padding) */}
      <style>{`
        /* Hide sidebar, topbar, mobile nav */
        nav, [data-sidebar], [data-topbar], [data-mobilenav] { display: none !important; }
        /* Reset the parent layout constraints */
        .lg\\:ml-64 { margin-left: 0 !important; }
        main { padding: 0 !important; }
        /* KC theming */
        :root {
          --felt: #0b1a10;
          --felt-light: #122118;
          --leather: #1a1510;
          --leather-light: #241e16;
          --amber: #e8621a;
          --amber-glow: rgba(232, 98, 26, 0.4);
          --amber-soft: #c4530f;
          --gold: #d4a035;
          --gold-glow: rgba(212, 160, 53, 0.35);
          --pitch-green: #2d8a4e;
          --pitch-dark: #1a5c33;
          --pitch-light: #3ba55d;
          --danger: #c0392b;
          --cream: #f5f0e0;
          --cream-soft: #d9d0b8;
          --dust: #9a8b73;
          --ink: #5c5040;
          --radius: 10px;
          --radius-sm: 6px;
          --radius-lg: 14px;
          --font-display: 'Arial Black', 'Helvetica Neue', sans-serif;
          --font-flavour: 'Georgia', serif;
        }
        body {
          background: var(--felt) !important;
          color: var(--cream) !important;
          overflow: hidden;
        }
      `}</style>
      {children}
    </>
  );
}

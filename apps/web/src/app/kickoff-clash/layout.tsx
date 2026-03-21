import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Kickoff Clash — Card Battler',
  description: 'Roguelike football card battler. 500 players. 5 matches. One shot.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function KickoffClashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="kc-root" style={{
      /* Override web app vars with KC game theme */
      '--color-bg-base': '#0a0a0f',
      '--color-bg-surface': '#12121a',
      '--color-bg-elevated': '#1a1a2e',
      '--color-bg-card': '#16213e',
      '--color-border-subtle': '#2a2a4a',
      '--color-border-glow': '#6fc3df',
      '--color-accent-primary': '#e74c3c',
      '--color-accent-secondary': '#6fc3df',
      '--color-accent-gold': '#f1c40f',
      '--color-accent-green': '#2ecc71',
      '--color-text-primary': '#f0f0f5',
      '--color-text-secondary': '#8888aa',
      '--color-text-muted': '#555570',
    } as React.CSSProperties}>
      <style>{`
        .kc-root {
          background: #0a0a0f;
          color: #f0f0f5;
          min-height: 100vh;
          font-family: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        .kc-root .phase-setup {
          background: linear-gradient(135deg, #0a0a0f 0%, #0d1117 30%, #0a0a0f 60%, #111122 100%);
          background-size: 400% 400%;
          animation: setupGradient 12s ease infinite;
        }
        @keyframes setupGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .kc-root .phase-match {
          background: linear-gradient(180deg, rgba(20,60,30,0.25) 0%, transparent 30%, #0a0a0f 100%);
        }
        .kc-root .phase-match .commentary-feed {
          background: rgba(10,10,15,0.8);
          border-left: 3px solid #2ecc71;
        }
        .kc-root .phase-shop {
          background: linear-gradient(180deg, rgba(80,60,20,0.15) 0%, transparent 25%, #0a0a0f 100%);
        }
        .kc-root .phase-postmatch {
          background: radial-gradient(ellipse at center top, rgba(255,255,255,0.06) 0%, transparent 50%, #0a0a0f 100%);
        }
        .kc-root .commentary-goal-yours {
          color: #2ecc71 !important;
          font-size: 13px !important;
          font-weight: 700 !important;
        }
        .kc-root .commentary-goal-opponent {
          color: #e74c3c !important;
          font-size: 13px !important;
          font-weight: 700 !important;
        }
        @keyframes pulseButton {
          0%, 100% { box-shadow: 0 0 10px rgba(231,76,60,0.3); }
          50% { box-shadow: 0 0 25px rgba(231,76,60,0.6), 0 0 50px rgba(231,76,60,0.2); }
        }
        .kc-root .advance-btn-pulse {
          animation: pulseButton 1.5s ease-in-out infinite;
        }
        .kc-root .sub-card {
          background: linear-gradient(135deg, rgba(46,204,113,0.15) 0%, rgba(46,204,113,0.05) 100%) !important;
          border-color: #2ecc71 !important;
        }
      `}</style>
      {children}
    </div>
  );
}

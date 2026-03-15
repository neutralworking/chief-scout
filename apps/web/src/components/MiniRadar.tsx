interface MiniRadarProps {
  values: number[];        // 6 (or 4 for GK), 0-100
  size?: number;           // default 64
  color?: string;          // polygon fill/stroke color (hex)
  showLabels?: boolean;    // false at card size
  labels?: string[];       // DEF/CRE/ATK/PWR/PAC/DRV
}

export function MiniRadar({ values, size = 64, color = "#4ade80", showLabels = false, labels }: MiniRadarProps) {
  const n = values.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const labelPad = showLabels ? 14 : 2;
  const radius = size / 2 - labelPad;

  function polarToXY(index: number, value: number): [number, number] {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function polygonPoints(vals: number[]): string {
    return vals.map((v, i) => polarToXY(i, v).join(",")).join(" ");
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {/* Grid rings: 50% and 100% */}
      {[50, 100].map((ring) => (
        <polygon
          key={ring}
          points={polygonPoints(Array(n).fill(ring))}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={0.5}
          opacity={0.35}
        />
      ))}

      {/* Axis lines */}
      {values.map((_, i) => {
        const [x, y] = polarToXY(i, 100);
        return (
          <line
            key={i}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke="var(--border-subtle)"
            strokeWidth={0.3}
            opacity={0.25}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polygonPoints(values)}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />

      {/* Axis labels (only when showLabels=true) */}
      {showLabels && labels && labels.map((label, i) => {
        const [x, y] = polarToXY(i, 125);
        return (
          <text
            key={i}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--text-muted)"
            fontSize={6.5}
            fontWeight={600}
            fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

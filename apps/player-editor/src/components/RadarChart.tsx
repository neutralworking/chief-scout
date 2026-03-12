"use client";

interface RadarDataPoint {
  label: string;
  value: number;
  max?: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  color?: string;
  showLabels?: boolean;
  className?: string;
}

export default function RadarChart({
  data,
  size = 200,
  color = "var(--accent-tactical)",
  showLabels = true,
  className,
}: RadarChartProps) {
  const n = data.length;
  if (n < 3 || n > 12) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const labelOffset = size * 0.46;
  const angleStep = (2 * Math.PI) / n;
  // Start from top (12 o'clock) by offsetting -90 degrees
  const startAngle = -Math.PI / 2;

  function pointOnAxis(index: number, r: number): [number, number] {
    const angle = startAngle + index * angleStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function polygonPoints(r: number): string {
    return Array.from({ length: n }, (_, i) => pointOnAxis(i, r).join(",")).join(" ");
  }

  const gridLevels = [0.33, 0.66, 1];

  const normalized = data.map((d) => Math.min(1, Math.max(0, d.value / (d.max ?? 100))));
  const dataPoints = normalized.map((v, i) => pointOnAxis(i, radius * v).join(",")).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Radar chart"
    >
      {/* Grid polygons */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={polygonPoints(radius * level)}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pointOnAxis(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints}
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={1.5}
      />

      {/* Data points */}
      {normalized.map((v, i) => {
        const [x, y] = pointOnAxis(i, radius * v);
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}

      {/* Labels */}
      {showLabels &&
        data.map((d, i) => {
          const [x, y] = pointOnAxis(i, labelOffset);
          const angle = startAngle + i * angleStep;
          const cos = Math.cos(angle);

          let anchor: "start" | "middle" | "end" = "middle";
          if (cos > 0.1) anchor = "start";
          else if (cos < -0.1) anchor = "end";

          // Vertical nudge: push labels above/below based on position
          const sin = Math.sin(angle);
          const dy = sin > 0.1 ? "1em" : sin < -0.1 ? "-0.3em" : "0.35em";

          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor={anchor}
              dy={dy}
              fill="var(--text-muted)"
              fontSize={size * 0.05}
              fontFamily="inherit"
            >
              {d.label}
            </text>
          );
        })}
    </svg>
  );
}

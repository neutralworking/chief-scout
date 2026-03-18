"use client";

interface RadarLayer {
  values: number[]; // 0-100 per axis
  color: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

interface RadarChartProps {
  labels?: string[];
  tooltips?: string[];
  layers?: RadarLayer[];
  // Legacy API (player detail page)
  data?: Array<{ label: string; value: number }>;
  color?: string;
  size?: number;
}

export function RadarChart({ labels: labelsProp, tooltips, layers: layersProp, data, color, size = 200 }: RadarChartProps) {
  // Support legacy { data, color } API
  const labels = labelsProp ?? (data?.map((d) => d.label) ?? []);
  const layers = layersProp ?? (data && color ? [{ values: data.map((d) => d.value), color }] : []);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 24;
  const n = labels.length;

  function polarToXY(index: number, value: number): [number, number] {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function polygonPoints(values: number[]): string {
    return values.map((v, i) => polarToXY(i, v).join(",")).join(" ");
  }

  const rings = [25, 50, 75, 100];
  const topLayer = layers.length > 0 ? layers[layers.length - 1] : null;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="block mx-auto max-w-full" style={{ maxHeight: size }}>
      {/* Glow filter for vertex dots */}
      <defs>
        <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={polygonPoints(Array(n).fill(ring))}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={ring === 50 ? 0.8 : 0.4}
          strokeDasharray={ring === 50 ? "3,2" : "none"}
          opacity={0.6}
        />
      ))}

      {/* Axis lines */}
      {labels.map((_, i) => {
        const [x, y] = polarToXY(i, 100);
        return (
          <line
            key={i}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke="var(--border-subtle)"
            strokeWidth={0.4}
            opacity={0.4}
          />
        );
      })}

      {/* Data layers */}
      {layers.map((layer, li) => (
        <polygon
          key={li}
          points={polygonPoints(layer.values)}
          fill={layer.color}
          fillOpacity={li === layers.length - 1 ? (layer.fillOpacity ?? 0.30) : (layer.fillOpacity ?? 0.12)}
          stroke={layer.color}
          strokeWidth={li === layers.length - 1 ? (layer.strokeWidth ?? 2.5) : (layer.strokeWidth ?? 1)}
          strokeLinejoin="round"
          strokeOpacity={li === layers.length - 1 ? 1 : 0.7}
        />
      ))}

      {/* Vertex dots on top layer with glow */}
      {topLayer && topLayer.values.map((v, i) => {
        const [x, y] = polarToXY(i, v);
        return (
          <circle
            key={i}
            cx={x} cy={y} r={3}
            fill={topLayer.color}
            filter="url(#dot-glow)"
          />
        );
      })}

      {/* Value labels next to vertex dots */}
      {topLayer && topLayer.values.map((v, i) => {
        if (v <= 0) return null;
        const [dotX, dotY] = polarToXY(i, v);
        // Offset the label slightly inward from the dot
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const offsetR = 8;
        const lx = dotX - offsetR * Math.cos(angle);
        const ly = dotY - offsetR * Math.sin(angle);
        return (
          <text
            key={`val-${i}`}
            x={lx} y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={6.5}
            fontWeight={600}
            fontFamily="monospace"
            fill={topLayer.color}
            opacity={0.85}
          >
            {Math.round(v)}
          </text>
        );
      })}

      {/* Axis labels with tooltips */}
      {labels.map((label, i) => {
        const [x, y] = polarToXY(i, 125);
        return (
          <text
            key={i}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[var(--text-secondary)] cursor-default"
            fontSize={8}
            fontWeight={500}
          >
            {tooltips?.[i] && <title>{tooltips[i]}</title>}
            {label}
          </text>
        );
      })}
    </svg>
  );
}

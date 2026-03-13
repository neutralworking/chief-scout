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

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block mx-auto">
      {/* Grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={polygonPoints(Array(n).fill(ring))}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={ring === 50 ? 0.8 : 0.4}
          opacity={0.5}
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
          fillOpacity={layer.fillOpacity ?? 0.15}
          stroke={layer.color}
          strokeWidth={layer.strokeWidth ?? 1.5}
          strokeLinejoin="round"
        />
      ))}

      {/* Vertex dots on top layer */}
      {layers.length > 0 && layers[layers.length - 1].values.map((v, i) => {
        const [x, y] = polarToXY(i, v);
        return (
          <circle
            key={i}
            cx={x} cy={y} r={2}
            fill={layers[layers.length - 1].color}
          />
        );
      })}

      {/* Axis labels with tooltips */}
      {labels.map((label, i) => {
        const [x, y] = polarToXY(i, 120);
        return (
          <text
            key={i}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[var(--text-muted)] cursor-default"
            fontSize={7.5}
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

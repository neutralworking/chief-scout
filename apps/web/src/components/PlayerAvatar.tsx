"use client";

/**
 * PlayerAvatar — Procedural SVG football player portraits for KC cards.
 *
 * Generates a unique cartoon avatar from name + position + archetype.
 * Deterministic: same inputs always produce the same face.
 * No external API, no image files, pure SVG.
 */

// ── Seed hash ────────────────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ── Palette ──────────────────────────────────────────────────────────────────

const SKIN_TONES = [
  "#FDDCB5", "#F5C9A0", "#E8B48A", "#D19E6D", "#C08A5C",
  "#A67449", "#8B5E3C", "#6B4226", "#4A2E1A", "#3B2314",
];

const HAIR_COLORS = [
  "#1a1a1a", "#2c1b0e", "#4a3020", "#6b4423", "#8b6914",
  "#c49a3b", "#d4a44c", "#e8c96b", "#a03020", "#d44b2e",
  "#f5f5f0", "#c0c0c0",
];

const KIT_COLORS: Record<string, string> = {
  GK: "#eab308", CD: "#0ea5e9", WD: "#10b981", DM: "#14b8a6",
  CM: "#6366f1", WM: "#8b5cf6", AM: "#f97316", WF: "#f43f5e", CF: "#ef4444",
};

const KIT_PATTERNS = ["solid", "stripes", "hoops", "sash", "halves"];

// ── Hairstyles ───────────────────────────────────────────────────────────────

type HairStyle = "short" | "buzz" | "mohawk" | "curly" | "long" | "bald" | "afro" | "slick";
const HAIR_STYLES: HairStyle[] = ["short", "buzz", "mohawk", "curly", "long", "bald", "afro", "slick"];

function renderHair(style: HairStyle, color: string, _size: number) {
  const cx = 50, headTop = 18;

  switch (style) {
    case "buzz":
      return <ellipse cx={cx} cy={headTop + 8} rx={20} ry={14} fill={color} opacity={0.7} />;
    case "short":
      return (
        <path d={`M30,${headTop + 14} Q30,${headTop - 2} 50,${headTop - 4} Q70,${headTop - 2} 70,${headTop + 14}`}
          fill={color} />
      );
    case "mohawk":
      return (
        <path d={`M44,${headTop + 12} Q44,${headTop - 10} 50,${headTop - 12} Q56,${headTop - 10} 56,${headTop + 12}`}
          fill={color} />
      );
    case "curly":
      return (
        <g fill={color}>
          <circle cx={35} cy={headTop + 4} r={7} />
          <circle cx={45} cy={headTop - 1} r={7} />
          <circle cx={55} cy={headTop - 1} r={7} />
          <circle cx={65} cy={headTop + 4} r={7} />
          <circle cx={40} cy={headTop + 8} r={6} />
          <circle cx={60} cy={headTop + 8} r={6} />
        </g>
      );
    case "afro":
      return <ellipse cx={cx} cy={headTop + 4} rx={25} ry={20} fill={color} />;
    case "long":
      return (
        <path d={`M28,${headTop + 10} Q28,${headTop - 4} 50,${headTop - 6} Q72,${headTop - 4} 72,${headTop + 10} L72,${headTop + 30} Q72,${headTop + 36} 65,${headTop + 38} L35,${headTop + 38} Q28,${headTop + 36} 28,${headTop + 30} Z`}
          fill={color} />
      );
    case "slick":
      return (
        <path d={`M30,${headTop + 14} Q28,${headTop - 4} 50,${headTop - 6} Q72,${headTop - 4} 70,${headTop + 14} L68,${headTop + 6} Q50,${headTop} 32,${headTop + 6} Z`}
          fill={color} />
      );
    case "bald":
    default:
      return null;
  }
}

// ── Face features ────────────────────────────────────────────────────────────

type FaceShape = "round" | "square" | "long" | "wide";
const FACE_SHAPES: FaceShape[] = ["round", "square", "long", "wide"];

function getFaceRx(shape: FaceShape): number {
  switch (shape) { case "round": return 18; case "square": return 19; case "long": return 16; case "wide": return 21; }
}
function getFaceRy(shape: FaceShape): number {
  switch (shape) { case "round": return 20; case "square": return 18; case "long": return 23; case "wide": return 18; }
}

type EyeStyle = "normal" | "narrow" | "wide" | "angry" | "chill";
const EYE_STYLES: EyeStyle[] = ["normal", "narrow", "wide", "angry", "chill"];

function renderEyes(style: EyeStyle, cx: number, cy: number) {
  const lx = cx - 8, rx = cx + 8;
  switch (style) {
    case "narrow":
      return (
        <g>
          <ellipse cx={lx} cy={cy} rx={3} ry={1.5} fill="#1a1a1a" />
          <ellipse cx={rx} cy={cy} rx={3} ry={1.5} fill="#1a1a1a" />
        </g>
      );
    case "wide":
      return (
        <g>
          <circle cx={lx} cy={cy} r={3.5} fill="white" />
          <circle cx={rx} cy={cy} r={3.5} fill="white" />
          <circle cx={lx} cy={cy} r={2} fill="#1a1a1a" />
          <circle cx={rx} cy={cy} r={2} fill="#1a1a1a" />
        </g>
      );
    case "angry":
      return (
        <g>
          <circle cx={lx} cy={cy} r={2.5} fill="#1a1a1a" />
          <circle cx={rx} cy={cy} r={2.5} fill="#1a1a1a" />
          <line x1={lx - 3} y1={cy - 4} x2={lx + 3} y2={cy - 2.5} stroke="#1a1a1a" strokeWidth={1.5} strokeLinecap="round" />
          <line x1={rx + 3} y1={cy - 4} x2={rx - 3} y2={cy - 2.5} stroke="#1a1a1a" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
    case "chill":
      return (
        <g>
          <path d={`M${lx - 3},${cy} Q${lx},${cy - 2} ${lx + 3},${cy}`} stroke="#1a1a1a" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <path d={`M${rx - 3},${cy} Q${rx},${cy - 2} ${rx + 3},${cy}`} stroke="#1a1a1a" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={lx} cy={cy} r={2.5} fill="#1a1a1a" />
          <circle cx={rx} cy={cy} r={2.5} fill="#1a1a1a" />
        </g>
      );
  }
}

type MouthStyle = "smile" | "grin" | "serious" | "smirk" | "open";
const MOUTH_STYLES: MouthStyle[] = ["smile", "grin", "serious", "smirk", "open"];

function renderMouth(style: MouthStyle, cx: number, cy: number) {
  switch (style) {
    case "grin":
      return <path d={`M${cx - 8},${cy} Q${cx},${cy + 8} ${cx + 8},${cy}`} stroke="#1a1a1a" strokeWidth={1.5} fill="none" strokeLinecap="round" />;
    case "serious":
      return <line x1={cx - 5} y1={cy + 2} x2={cx + 5} y2={cy + 2} stroke="#1a1a1a" strokeWidth={1.5} strokeLinecap="round" />;
    case "smirk":
      return <path d={`M${cx - 4},${cy + 2} Q${cx + 2},${cy + 5} ${cx + 6},${cy}`} stroke="#1a1a1a" strokeWidth={1.5} fill="none" strokeLinecap="round" />;
    case "open":
      return <ellipse cx={cx} cy={cy + 3} rx={5} ry={4} fill="#1a1a1a" />;
    default: // smile
      return <path d={`M${cx - 6},${cy + 1} Q${cx},${cy + 5} ${cx + 6},${cy + 1}`} stroke="#1a1a1a" strokeWidth={1.5} fill="none" strokeLinecap="round" />;
  }
}

// ── Kit pattern ──────────────────────────────────────────────────────────────

function renderKit(pattern: string, color: string, _size: number) {
  const bodyTop = 62, bodyBot = 95;
  const white = "#f8f8f0";

  switch (pattern) {
    case "stripes":
      return (
        <g>
          <rect x={30} y={bodyTop} width={40} height={bodyBot - bodyTop} rx={4} fill={color} />
          {[35, 43, 51, 59].map((x) => (
            <rect key={x} x={x} y={bodyTop} width={3} height={bodyBot - bodyTop} fill={white} opacity={0.3} />
          ))}
        </g>
      );
    case "hoops":
      return (
        <g>
          <rect x={30} y={bodyTop} width={40} height={bodyBot - bodyTop} rx={4} fill={color} />
          {[bodyTop + 4, bodyTop + 12, bodyTop + 20].map((y) => (
            <rect key={y} x={30} y={y} width={40} height={4} fill={white} opacity={0.3} />
          ))}
        </g>
      );
    case "sash":
      return (
        <g>
          <rect x={30} y={bodyTop} width={40} height={bodyBot - bodyTop} rx={4} fill={color} />
          <polygon points={`56,${bodyTop} 70,${bodyTop} 44,${bodyBot} 30,${bodyBot}`} fill={white} opacity={0.25} />
        </g>
      );
    case "halves":
      return (
        <g>
          <rect x={30} y={bodyTop} width={40} height={bodyBot - bodyTop} rx={4} fill={color} />
          <rect x={50} y={bodyTop} width={20} height={bodyBot - bodyTop} rx={0} fill={white} opacity={0.25} />
        </g>
      );
    default: // solid
      return <rect x={30} y={bodyTop} width={40} height={bodyBot - bodyTop} rx={4} fill={color} />;
  }
}

// ── Facial hair ──────────────────────────────────────────────────────────────

type BeardStyle = "none" | "stubble" | "goatee" | "full";
const BEARD_STYLES: BeardStyle[] = ["none", "none", "none", "stubble", "goatee", "full"]; // weighted toward clean

function renderBeard(style: BeardStyle, color: string, cx: number, jawY: number) {
  switch (style) {
    case "stubble":
      return <ellipse cx={cx} cy={jawY + 2} rx={12} ry={6} fill={color} opacity={0.2} />;
    case "goatee":
      return <ellipse cx={cx} cy={jawY + 4} rx={6} ry={5} fill={color} opacity={0.5} />;
    case "full":
      return <ellipse cx={cx} cy={jawY + 3} rx={14} ry={8} fill={color} opacity={0.4} />;
    default:
      return null;
  }
}

// ── Main component ───────────────────────────────────────────────────────────

interface PlayerAvatarProps {
  name: string;
  position?: string | null;
  archetype?: string | null;
  size?: number;
  accentColor?: string;
}

export function PlayerAvatar({
  name,
  position,
  archetype,
  size = 100,
  accentColor,
}: PlayerAvatarProps) {
  const s = hash(name);
  const s2 = hash(name + (position || ""));
  const s3 = hash(name + (archetype || ""));

  const skinTone = pick(SKIN_TONES, s);
  const hairColor = pick(HAIR_COLORS, s2);
  const hairStyle = pick(HAIR_STYLES, s3);
  const faceShape = pick(FACE_SHAPES, s + 7);
  const eyeStyle = pick(EYE_STYLES, s2 + 3);
  const mouthStyle = pick(MOUTH_STYLES, s3 + 5);
  const beardStyle = pick(BEARD_STYLES, s + 11);
  const kitPattern = pick(KIT_PATTERNS, s2 + 13);
  const kitColor = KIT_COLORS[position || "CM"] || accentColor || "#6366f1";

  const cx = 50, headCy = 36;
  const faceRx = getFaceRx(faceShape);
  const faceRy = getFaceRy(faceShape);
  const eyeY = headCy - 2;
  const mouthY = headCy + 8;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ borderRadius: "50%", overflow: "hidden" }}
    >
      {/* Background */}
      <rect width={100} height={100} fill="#18181b" />

      {/* Kit / body */}
      {renderKit(kitPattern, kitColor, size)}

      {/* Neck */}
      <rect x={44} y={52} width={12} height={14} rx={3} fill={skinTone} />

      {/* Hair behind head (for long styles) */}
      {hairStyle === "long" && renderHair(hairStyle, hairColor, size)}

      {/* Head */}
      <ellipse cx={cx} cy={headCy} rx={faceRx} ry={faceRy} fill={skinTone} />

      {/* Ears */}
      <ellipse cx={cx - faceRx - 2} cy={headCy + 2} rx={3} ry={5} fill={skinTone} />
      <ellipse cx={cx + faceRx + 2} cy={headCy + 2} rx={3} ry={5} fill={skinTone} />

      {/* Beard */}
      {renderBeard(beardStyle, hairColor, cx, headCy + faceRy - 8)}

      {/* Eyes */}
      {renderEyes(eyeStyle, cx, eyeY)}

      {/* Nose */}
      <path
        d={`M${cx - 1},${headCy + 1} L${cx - 3},${headCy + 6} Q${cx},${headCy + 7} ${cx + 3},${headCy + 6} L${cx + 1},${headCy + 1}`}
        fill="none" stroke={skinTone} strokeWidth={1} filter="brightness(0.85)"
        opacity={0.4}
      />

      {/* Mouth */}
      {renderMouth(mouthStyle, cx, mouthY)}

      {/* Hair on top */}
      {hairStyle !== "long" && renderHair(hairStyle, hairColor, size)}

      {/* Number on kit */}
      <text
        x={cx}
        y={80}
        textAnchor="middle"
        fill="white"
        fontSize={10}
        fontWeight="bold"
        opacity={0.6}
        fontFamily="monospace"
      >
        {(s % 99) + 1}
      </text>
    </svg>
  );
}

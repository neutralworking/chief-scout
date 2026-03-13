/**
 * Club-based theme accents
 * Maps supported clubs to accent color overrides applied via CSS custom properties
 */

export interface ClubTheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

// Top clubs with distinctive color palettes
export const CLUB_THEMES: Record<string, ClubTheme> = {
  // English
  arsenal: { name: "Arsenal", primary: "#EF0107", secondary: "#063672", accent: "#EF0107" },
  chelsea: { name: "Chelsea", primary: "#034694", secondary: "#DBA111", accent: "#034694" },
  liverpool: { name: "Liverpool", primary: "#C8102E", secondary: "#00A398", accent: "#C8102E" },
  "manchester-city": { name: "Manchester City", primary: "#6CABDD", secondary: "#1C2C5B", accent: "#6CABDD" },
  "manchester-united": { name: "Manchester United", primary: "#DA291C", secondary: "#FBE122", accent: "#DA291C" },
  tottenham: { name: "Tottenham", primary: "#132257", secondary: "#FFFFFF", accent: "#132257" },
  "aston-villa": { name: "Aston Villa", primary: "#670E36", secondary: "#95BFE5", accent: "#95BFE5" },
  newcastle: { name: "Newcastle", primary: "#241F20", secondary: "#FFFFFF", accent: "#41B6E6" },
  // Spanish
  barcelona: { name: "Barcelona", primary: "#A50044", secondary: "#004D98", accent: "#A50044" },
  "real-madrid": { name: "Real Madrid", primary: "#FEBE10", secondary: "#00529F", accent: "#FEBE10" },
  "atletico-madrid": { name: "Atletico Madrid", primary: "#CB3524", secondary: "#272E61", accent: "#CB3524" },
  // German
  "bayern-munich": { name: "Bayern Munich", primary: "#DC052D", secondary: "#0066B2", accent: "#DC052D" },
  dortmund: { name: "Borussia Dortmund", primary: "#FDE100", secondary: "#000000", accent: "#FDE100" },
  // Italian
  "ac-milan": { name: "AC Milan", primary: "#FB090B", secondary: "#000000", accent: "#FB090B" },
  inter: { name: "Inter Milan", primary: "#010E80", secondary: "#000000", accent: "#009FE3" },
  juventus: { name: "Juventus", primary: "#000000", secondary: "#FFFFFF", accent: "#C9A96E" },
  napoli: { name: "Napoli", primary: "#12A0D7", secondary: "#FFFFFF", accent: "#12A0D7" },
  // French
  psg: { name: "Paris Saint-Germain", primary: "#004170", secondary: "#DA291C", accent: "#DA291C" },
  // Portuguese
  benfica: { name: "Benfica", primary: "#FF0000", secondary: "#FFFFFF", accent: "#FF0000" },
  porto: { name: "Porto", primary: "#003893", secondary: "#FFFFFF", accent: "#003893" },
  sporting: { name: "Sporting CP", primary: "#00843D", secondary: "#FFFFFF", accent: "#00843D" },
  // Dutch
  ajax: { name: "Ajax", primary: "#D2122E", secondary: "#FFFFFF", accent: "#D2122E" },
  // None
  none: { name: "No club", primary: "#3dba6f", secondary: "#4a90d9", accent: "#3dba6f" },
};

/** Apply club theme to CSS custom properties on document root */
export function applyClubTheme(clubSlug: string | null) {
  if (typeof document === "undefined") return;
  const theme = CLUB_THEMES[clubSlug ?? "none"] ?? CLUB_THEMES.none;
  document.documentElement.style.setProperty("--accent-club", theme.accent);
  document.documentElement.style.setProperty("--accent-club-primary", theme.primary);
  document.documentElement.style.setProperty("--accent-club-secondary", theme.secondary);
}

/** Get sorted list of clubs for selection UI */
export function getClubList(): { slug: string; name: string }[] {
  return Object.entries(CLUB_THEMES)
    .filter(([slug]) => slug !== "none")
    .map(([slug, theme]) => ({ slug, name: theme.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

// Elitr's own type: Inter + Geist Mono (apps/web/app/layout.tsx); one italic serif accent word per line.
export const sans = loadInter("normal", { weights: ["300", "400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const serif = loadSerif("italic", { weights: ["400"], subsets: ["latin"] }).fontFamily;

/** Elitr's design tokens (apps/web/app/globals.css): Binance yellow on ink or paper, deep gold as text on light. */
export const C = {
  gold: "#f0b90b",
  goldHi: "#fcd535",
  goldDeep: "#7f6100",
  goldWash: "#fef6d8",
  ink: "#0b0e11",
  night: "#0b0e11",
  panel: "#14181d",
  panel2: "#1b2027",
  paper: "#f6f6f4",
  white: "#ffffff",
  text: "#f6f6f4",
  muted: "#9aa1a8",
  faint: "#6b7378",
  dim: "#4a5056",
  line: "#e7e7e4",
  pos: "#03a66d",
  posDeep: "#047857",
  neg: "#cf304a",
  negDeep: "#a8213a",
  info: "#2f6fe4",
  flow: "#7c4ddb",
  lineDark: "rgba(246,246,244,0.10)",
  lineLight: "rgba(11,14,17,0.12)",
};

export type Tone = "dark" | "paper" | "gold";
export const TONE: Record<Tone, { bg: string; ink: string; muted: string; line: string; acc: string; pill: string }> = {
  dark: { bg: C.night, ink: C.text, muted: "rgba(246,246,244,0.55)", line: C.lineDark, acc: C.gold, pill: "rgba(11,14,17,0.66)" },
  paper: { bg: C.paper, ink: C.ink, muted: "rgba(11,14,17,0.55)", line: C.lineLight, acc: C.goldDeep, pill: "rgba(255,255,255,0.86)" },
  gold: { bg: C.gold, ink: C.ink, muted: "rgba(11,14,17,0.62)", line: "rgba(11,14,17,0.18)", acc: C.ink, pill: "rgba(240,185,11,0.88)" },
};

/** Which look each scene uses; the corner chrome and captions follow it. */
export const SCENE_TONE: Record<string, Tone> = {
  open: "dark", clock: "paper", gap: "gold", turn: "dark", sellers: "paper", pay: "dark",
  trust: "paper", risk: "dark", live: "paper", shop: "dark", unique: "gold", close: "dark",
};

export const SCENE_LABEL: Record<string, string> = {
  open: "01 · http 402", clock: "02 · after the bell", gap: "03 · the gap", turn: "04 · elitr",
  sellers: "05 · the sellers", pay: "06 · b402", trust: "07 · keeping score", risk: "08 · fail closed",
  live: "09 · mainnet", shop: "10 · open market", unique: "11 · why it's different", close: "12 · elitr.xyz",
};

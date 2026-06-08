// The two tappable alphabets for the Templum Serpens sequence helper. A "token" is one
// tappable thing: a Phase-1 element or a Phase-2 column. The sequence model (engine/
// sequence.ts) stores token ids; this maps an id back to its label, colour and icon.
import type { ElementIconName } from "./icons";

export interface Token {
  id: string;
  label: string;
  /** Elements draw a bespoke SVG; columns are shown by their L/R label. */
  icon?: ElementIconName;
  /** Per-token accent, surfaced to CSS as `--c`. */
  color: string;
  /** Phase-2 columns sit on the left or right wall. */
  side?: "L" | "R";
}

// Phase 1 — the four Templum Serpens elements (earth, not lightning; earth is yellow).
export const ELEMENTS: Token[] = [
  { id: "fire", label: "Fire", icon: "fire", color: "#ff6b3d" },
  { id: "ice", label: "Ice", icon: "ice", color: "#5cc6ff" },
  { id: "earth", label: "Earth", icon: "earth", color: "#f3c63a" },
  { id: "wind", label: "Wind", icon: "wind", color: "#7ce0a3" },
];

// Phase 2 — six columns on two walls (fixed 3+3), matching the Italian-community notation
// d1-d2-d3-s1-s2-s3 (destra/right, sinistra/left). Coloured by side so the two groups read
// at a glance; the L/R + number is the thing players jot down.
export const COLUMNS: Token[] = [
  { id: "l1", label: "L1", color: "#5cc6ff", side: "L" },
  { id: "l2", label: "L2", color: "#5cc6ff", side: "L" },
  { id: "l3", label: "L3", color: "#5cc6ff", side: "L" },
  { id: "r1", label: "R1", color: "#ff8a3d", side: "R" },
  { id: "r2", label: "R2", color: "#ff8a3d", side: "R" },
  { id: "r3", label: "R3", color: "#ff8a3d", side: "R" },
];

export const findToken = (alphabet: Token[], id: string): Token =>
  alphabet.find((t) => t.id === id)!;

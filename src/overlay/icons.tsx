// Bespoke icon set — small hand-drawn SVGs so the UI reads with one visual language
// instead of cross-platform emoji. Each icon is monochrome and draws itself in
// `currentColor`, so a caller can tint it via `color` (e.g. per-element `--c`). Sized in
// `em` so the parent font-size controls the icon size.
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
};

/** Flame with a hollow inner core for depth. */
function FireIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path
        d="M12 2C9 6 6 8 6 13a6 6 0 0012 0c0-3-2-5-3-7-.3 1.2-1.1 2-2 2 .6-3-1-6-1-6z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M12 13c-1.6 1-2.2 2.1-2.2 3.6a2.2 2.2 0 004.4 0c0-1.5-.6-2.6-2.2-3.6z"
        fill="#000"
        opacity="0.28"
      />
    </svg>
  );
}

/** Six-armed snowflake with branch tips. */
function IceIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5v19M3.77 7.25l16.46 9.5M20.23 7.25L3.77 16.75" />
        <path d="M12 6l-2.2-2.2M12 6l2.2-2.2M12 18l-2.2 2.2M12 18l2.2 2.2" />
        <path d="M6.6 9l-3-.8M6.6 9l-.8-3M17.4 15l3 .8M17.4 15l.8 3" />
        <path d="M17.4 9l3-.8M17.4 9l.8-3M6.6 15l-3 .8M6.6 15l-.8 3" />
      </g>
    </svg>
  );
}

/** Mountain range — the earth element. */
function EarthIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path
        d="M2 20h20L14.5 6.5l-4 6.5-2.5-3L2 20z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Three curling gusts of wind. */
function WindIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M3 8h10a2.6 2.6 0 10-2.6-2.6" />
        <path d="M3 12h14a2.8 2.8 0 11-2.8 2.8" />
        <path d="M3 16h7a2.3 2.3 0 11-2.3 2.3" />
      </g>
    </svg>
  );
}

/** Mid-drain hourglass — the expiring-items glyph (replaces the too-basic ⧗ char):
 *  a little sand left up top, a falling stream, a settled mound below. */
export function HourglassIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M6 3h12M6 21h12" />
        <path d="M7.5 3c0 4.2 1.9 5.7 4.5 9-2.6 3.3-4.5 4.8-4.5 9" />
        <path d="M16.5 3c0 4.2-1.9 5.7-4.5 9 2.6 3.3 4.5 4.8 4.5 9" />
      </g>
      {/* sand: remaining wedge above the waist, the stream, the mound below */}
      <path d="M9.6 8.8h4.8L12 11.8 9.6 8.8z" fill="currentColor" />
      <path d="M12 12.5v3.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M12 15.8l3.3 3.6c.4.4.1 1.1-.5 1.1H9.2c-.6 0-.9-.7-.5-1.1l3.3-3.6z" fill="currentColor" />
    </svg>
  );
}

/** Ticked checkbox — the routine glyph (replaces the bare ✓ char): a rounded box with the
 *  tick inside, so it reads as a checklist item rather than a loose check mark. */
export function CheckboxIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" strokeWidth="1.7" />
        <path d="M8 12.4l2.9 2.9 5.4-6" strokeWidth="1.9" />
      </g>
    </svg>
  );
}

/** Two-way swap arrows — flips between the Phase 1 / Phase 2 tools. */
export function SwapIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9h15M15 6l3 3-3 3" />
        <path d="M21 15H6M9 12l-3 3 3 3" />
      </g>
    </svg>
  );
}

/** Curved back-arrow — undo the last tap. */
export function UndoIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6 3.5 10.5 8 15" />
        <path d="M3.5 10.5H14a6 6 0 0 1 0 12h-3" />
      </g>
    </svg>
  );
}

/** Trash can — clear the whole sequence. */
export function TrashIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16" />
        <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
        <path d="M6.2 7l.9 12.2A2 2 0 0 0 9.1 21h5.8a2 2 0 0 0 2-1.8L17.8 7" />
        <path d="M10 11v6M14 11v6" />
      </g>
    </svg>
  );
}

const ELEMENT_ICONS = {
  fire: FireIcon,
  ice: IceIcon,
  earth: EarthIcon,
  wind: WindIcon,
} as const;

export type ElementIconName = keyof typeof ELEMENT_ICONS;

/** Render an element icon by name; inherits color via `currentColor`. */
export function ElementIcon({ name, ...props }: { name: ElementIconName } & SVGProps<SVGSVGElement>) {
  const Icon = ELEMENT_ICONS[name];
  return <Icon {...props} />;
}

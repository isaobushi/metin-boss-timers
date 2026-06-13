// The curated + ADD TRAINING picker (design walk): the TRAINING section's add no longer blank-adds —
// it drops a curtain of the active character's full catalog subset (skillCatalog.subsetFor), banded
// like the dock's ✓ accordion (#57): Skill Books sub-grouped under "Race - School" heads, then
// Languages, then Utilities. Already-present chores stay listed but dim behind a ✓, so the list
// doubles as "what exists for my class"; the footer's "+ custom training" row keeps the old
// blank-add as the escape hatch. LocaleSettings' curtain sibling — same rung-menu skin, no
// edge-aware anchoring — but it opens UPWARD: the trigger sits at the settings tab's bottom, so a
// downward menu would land out of view. Cap gating lives upstream (useConfig consults `allows`
// before minting), so a Lite over-cap pick raises the CapNudge like any other refused add.
import { useEffect, useRef, useState } from "react";
import { displayName } from "../engine/contentCatalog";
import { buildKey, raceKey, recurringKey } from "../engine/contentKeys";
import type { ChorePreform } from "../engine/skillCatalog";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  /** The active character's full catalog subset (`subsetFor`), in catalog order. */
  entries: ChorePreform[];
  /** The catalog keys already in the character's bag — rendered dimmed-✓, not addable. */
  present: ReadonlySet<string>;
  /** Add this preform to the active character (cap-checked upstream in useConfig). */
  onPick: (p: ChorePreform) => void;
  /** The old blank-add — the "+ custom training" escape hatch. */
  onCustom: () => void;
  /** The trigger label (the section's localized "+ ADD TRAINING"). */
  addLabel: string;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

export function TrainingPicker({ entries, present, onPick, onCustom, addLabel, locale }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Close on an outside click, like the overlay's dropdowns.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => {
    if (open) inputRef.current?.focus(); // type-to-filter straight away
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (p: ChorePreform) => {
    onPick(p);
    close();
  };

  // Filter on the LOCALIZED chore name — what the user actually reads in the list.
  const q = query.trim().toLowerCase();
  const shown = q ? entries.filter((p) => displayName(recurringKey(p.name), locale).toLowerCase().includes(q)) : entries;

  // Band like the ✓ accordion (#57): Abilities first, then Languages, then the universal chores.
  const books = shown.filter((p) => p.category === "class-ability");
  const languages = shown.filter((p) => p.category === "language");
  const chores = shown.filter((p) => p.category !== "class-ability" && p.category !== "language");
  // Band heads only when more than one band shows — an unclassified character's chores-only list reads flat.
  const showHeads = [books, languages, chores].filter((b) => b.length > 0).length > 1;

  // The Skill Books band sub-grouped by school under a "Race - School" head, keeping catalog order
  // (mirrors RoutineAccordion's renderBooks — there a school head only ever follows a real school).
  const schools: { head: string; rows: ChorePreform[] }[] = [];
  for (const p of books) {
    const race = p.race ? displayName(raceKey(p.race), locale) : "";
    const school = p.build ? displayName(buildKey(p.build), locale) : "";
    const head = race && school ? `${race} - ${school}` : school;
    const last = schools[schools.length - 1];
    if (last && last.head === head) last.rows.push(p);
    else schools.push({ head, rows: [p] });
  }

  const row = (p: ChorePreform) => {
    const key = recurringKey(p.name);
    const added = present.has(key);
    const name = displayName(key, locale);
    return (
      <button
        key={key}
        className={`rung-menu__item${added ? " is-added" : ""}`}
        disabled={added}
        aria-label={added ? `${name} — ${t("recurring.alreadyAdded", locale)}` : name}
        onClick={() => pick(p)}
      >
        <span>{name}</span>
        {added && <span aria-hidden>✓</span>}
      </button>
    );
  };

  return (
    <div className="training-curtain" ref={rootRef}>
      <button className="btn-dashed" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {addLabel}
      </button>
      {open && (
        <div className="rung-menu training-curtain__menu">
          <input
            ref={inputRef}
            className="rung-menu__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("recurring.pickerFilter", locale)}
            aria-label={t("recurring.pickerFilter", locale)}
          />
          <div className="rung-menu__list" role="listbox">
            {shown.length === 0 && <div className="rung-menu__empty">{t("rung.noMatch", locale)}</div>}
            {books.length > 0 && showHeads && (
              <div className="training-curtain__band-head">{t("routine.sectionBooks", locale)}</div>
            )}
            {schools.map((s) => (
              <div className="training-curtain__school" key={s.head || "_"}>
                {s.head && <div className="training-curtain__school-head">{s.head}</div>}
                {s.rows.map(row)}
              </div>
            ))}
            {languages.length > 0 && showHeads && (
              <div className="training-curtain__band-head">{t("routine.sectionLanguages", locale)}</div>
            )}
            {languages.map(row)}
            {chores.length > 0 && showHeads && (
              <div className="training-curtain__band-head">{t("routine.sectionChores", locale)}</div>
            )}
            {chores.map(row)}
          </div>
          <button
            className="rung-menu__item training-curtain__custom"
            onClick={() => {
              onCustom();
              close();
            }}
          >
            {t("recurring.customTraining", locale)}
          </button>
        </div>
      )}
    </div>
  );
}

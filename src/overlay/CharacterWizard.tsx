// The create-character flow (PRD #47, #54): a short wizard that walks name → empire → race → build
// and, on completion, mints a Character whose recurring chores are seeded from the skillCatalog
// subset for those axes (the work happens in `addCharacter`; this only collects the draft). The
// build step is skipped for single-build races (Lycan → Instinct), honouring "no second-build
// prompt". Reused for two entry points: "+ New character" from the switcher (cancellable) and
// first-run when no character exists (no cancel — there's nothing to fall back to). Renders as an
// inline panel below the dock, width-matched to the other dock surfaces.
import { useMemo, useState } from "react";
import { type Build, type Empire, type Race, buildsFor } from "../engine/skillCatalog";
import { displayName, type Locale } from "../engine/contentCatalog";
import { buildKey, empireKey, raceKey } from "../engine/contentKeys";
import type { CharacterDraft } from "../engine/config";
import { t } from "../engine/chrome";

const EMPIRES: Empire[] = ["Shinsoo", "Chunjo", "Jinno"];
const RACES: Race[] = ["Warrior", "Ninja", "Sura", "Shaman", "Lycan"];

type Step = "name" | "empire" | "race" | "build";

type Props = {
  /** "new" appends a fresh character; "edit" classifies/renames the one passed via `initial`. */
  mode?: "new" | "edit";
  /** Pre-fill for the edit flow — the character's current name + class axes. */
  initial?: { name: string; empire?: Empire; race?: Race; builds?: Build[] };
  /** The active content locale — Empire/Race/Build names resolve per-locale (slice #83). Required so a new call site can't silently un-localize. */
  locale: Locale;
  /** Commit the collected draft (the caller runs `createCharacter`/`editCharacter` and closes the panel). */
  onCreate: (draft: CharacterDraft) => void;
  /** Dismiss without saving — omitted on first-run, where there's nothing to return to. */
  onCancel?: () => void;
};

export function CharacterWizard({ mode = "new", initial, locale, onCreate, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [empire, setEmpire] = useState<Empire | undefined>(initial?.empire);
  const [race, setRace] = useState<Race | undefined>(initial?.race);
  const [builds, setBuilds] = useState<Build[]>(initial?.builds ?? []);
  const [stepIdx, setStepIdx] = useState(0);

  // The build step only exists once a multi-build race is chosen; a single-build race (Lycan) drops
  // it, so its `race` step is the last — that's where "no second-build prompt" falls out.
  const steps = useMemo<Step[]>(() => {
    const base: Step[] = ["name", "empire", "race"];
    if (race && buildsFor(race).length > 1) base.push("build");
    return base;
  }, [race]);

  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const isLast = stepIdx >= steps.length - 1;
  const canAdvance =
    step === "name" ? name.trim() !== "" : step === "empire" ? empire != null : step === "race" ? race != null : true;

  const chooseRace = (r: Race) => {
    setRace(r);
    // Single-build races (Lycan) auto-take their sole build; multi-build races reset to an empty pick.
    setBuilds(buildsFor(r).length === 1 ? buildsFor(r) : []);
  };
  const toggleBuild = (b: Build) =>
    setBuilds((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  const primary = () => {
    if (!canAdvance) return;
    if (isLast) onCreate({ name: name.trim(), empire, race, builds });
    else setStepIdx((i) => i + 1);
  };

  return (
    <div className="dock-acc char-wizard">
      <div className="char-wizard__head">
        <span className="char-wizard__title">{mode === "edit" ? t("wizard.editCharacter", locale) : t("wizard.newCharacter", locale)}</span>
        <span className="char-wizard__steps">
          {steps.map((s, i) => (
            <span key={s} className={`char-wizard__dot${i === stepIdx ? " is-active" : ""}`} />
          ))}
        </span>
        {onCancel && (
          <button className="char-wizard__x" onClick={onCancel} title={t("wizard.cancel", locale)}>
            ✕
          </button>
        )}
      </div>

      {step === "name" && (
        <input
          className="char-wizard__name"
          value={name}
          autoFocus
          placeholder={t("wizard.namePlaceholder", locale)}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") primary();
          }}
          aria-label={t("wizard.nameAriaLabel", locale)}
        />
      )}

      {step === "empire" && (
        <div className="char-wizard__opts">
          {EMPIRES.map((e) => (
            <button
              key={e}
              className={`char-wizard__opt${empire === e ? " is-sel" : ""}`}
              onClick={() => setEmpire(e)}
            >
              {displayName(empireKey(e), locale)}
            </button>
          ))}
        </div>
      )}

      {step === "race" && (
        <div className="char-wizard__opts">
          {RACES.map((r) => (
            <button
              key={r}
              className={`char-wizard__opt${race === r ? " is-sel" : ""}`}
              onClick={() => chooseRace(r)}
            >
              {displayName(raceKey(r), locale)}
            </button>
          ))}
        </div>
      )}

      {step === "build" && race && (
        <div className="char-wizard__opts">
          {buildsFor(race).map((b) => (
            <button
              key={b}
              className={`char-wizard__opt${builds.includes(b) ? " is-sel" : ""}`}
              onClick={() => toggleBuild(b)}
            >
              {displayName(buildKey(b), locale)}
            </button>
          ))}
        </div>
      )}

      <div className="char-wizard__foot">
        {stepIdx > 0 ? (
          <button className="char-wizard__back" onClick={() => setStepIdx((i) => i - 1)}>
            {t("wizard.back", locale)}
          </button>
        ) : (
          <span />
        )}
        <button className="char-wizard__next" onClick={primary} disabled={!canAdvance}>
          {isLast ? (mode === "edit" ? t("wizard.save", locale) : t("wizard.create", locale)) : t("wizard.next", locale)}
        </button>
      </div>
    </div>
  );
}

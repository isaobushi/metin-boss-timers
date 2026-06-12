import { type RecurringDef, type RecurringKind, ladderCapLabel, ladderProgress, ladderText } from "../engine/recurring";
import type { ChorePreform } from "../engine/skillCatalog";
import { displayName } from "../engine/contentCatalog";
import { readNum } from "./numberInput";
import { t } from "../engine/chrome";
import { tip, tipHint } from "./Tooltip";
import { RungCurtain } from "./RungCurtain";
import { TrainingPicker } from "./TrainingPicker";
import type { Locale } from "../engine/localeTypes";

type Props = {
  recurring: RecurringDef[];
  /** Which flavour this section edits — `deadline` (EXPIRING ITEMS) or `gate` (ROUTINE). */
  kind: RecurringKind;
  onAdd: () => void;
  onRename: (defId: string, name: string) => void;
  onSetDuration: (defId: string, durationMs: number) => void;
  onRemove: (defId: string) => void;
  /**
   * The done-forever toggle (#69), passed only by the ROUTINE (`gate`) call site — a perfected task
   * is retired reversibly, not deleted. Absent on the EXPIRING ITEMS section: no trophy column there.
   */
  onSetMaxed?: (defId: string, maxed: boolean) => void;
  /**
   * The curated picker (TRAINING call site only, design walk): when present, the footer + ADD drops
   * the active character's catalog curtain instead of blank-adding — `onAdd` becomes the curtain's
   * "+ custom training" escape hatch. Absent on EXPIRING ITEMS, which keeps the plain blank-add.
   */
  picker?: { entries: ChorePreform[]; present: ReadonlySet<string>; onPick: (p: ChorePreform) => void };
  /**
   * The rank column (TRAINING call site only, design walk): replaces the duration editor — every
   * in-game readable has a FIXED cadence (24h, or the ladder's late tier), so a d/h/m control was
   * a lie waiting to happen. Ladder rows show the set-rung curtain (#46, same gesture as the dock
   * accordion); ladder-less custom rows show a quiet dash (fixed daily cadence).
   */
  rank?: { position: (defId: string) => number; onSetRung: (defId: string, rungLabel: string) => void };
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * The recurring-catalog editor (issue #37/#38) — the day-scale sibling of `CooldownSettings`,
 * rendered once per kind: an EXPIRING ITEMS section over the `deadline` definitions (pet, costume,
 * mount) and a ROUTINE section over the `gate` ones (biologist, book reading). Each row renames the
 * definition, edits the duration, or removes the entry; the footer adds a blank one of this
 * section's kind. `kind` only selects which definitions show and what a new one is — the row
 * editing is identical for both. Unlike `CooldownSettings` there is no Tag column: recurring items
 * show their full name in the accordion, so there's nothing to abbreviate.
 *
 * Duration is edited on a DAYS / HOURS / MINUTES control — the cooldown editor's h/m control
 * extended with a days field, because these chores run hours to weeks. The three number inputs
 * are split out of the stored ms and recombined on edit; the engine clamps the result to the
 * day-scale [1m, 365d] band (overlay/useConfig → setRecurringDuration), so an empty/zero entry
 * snaps back to 1 minute. The TRAINING call site swaps this column for a RANK one (`rank` prop,
 * design walk) — readables have fixed cadences, so there the rung is what's worth editing.
 *
 * The ROUTINE call site also passes `onSetMaxed` (#69): a "P" (Perfect-Master) toggle per row retires a perfected
 * task done-forever — the row stays listed here (dimmed, struck) so it can be restored, while the
 * ✓ accordion and the `x/n` nudge drop it. Distinct from ✕, which discards the definition.
 */
export function RecurringSettings({
  recurring,
  kind,
  onAdd,
  onRename,
  onSetDuration,
  onRemove,
  onSetMaxed,
  picker,
  rank,
  locale,
}: Props) {
  const items = recurring.filter((d) => d.kind === kind);
  const title = kind === "deadline" ? t("recurring.titleItems", locale) : t("recurring.titleRoutine", locale);
  const addLabel = kind === "deadline" ? t("recurring.addItem", locale) : t("recurring.addRoutine", locale);
  const emptyLabel = kind === "deadline" ? t("recurring.noItems", locale) : t("recurring.noRoutine", locale);
  return (
    <div className="panel cooldown-settings cooldown-settings--dhm">
      <div className="settings-head">
        <span className="cooldown-settings__title">{title}</span>
      </div>

      <div className="cd-head">
        <span className="cd-head__name">{t("recurring.colName", locale)}</span>
        <span className="cd-head__dur">{t(rank ? "recurring.colRank" : "recurring.colDuration", locale)}</span>
        {onSetMaxed && <span className="cd-head__x" />}
        <span className="cd-head__x" />
      </div>

      {items.map((d) => {
        const days = Math.floor(d.durationMs / MS_PER_DAY);
        const h = Math.floor((d.durationMs % MS_PER_DAY) / MS_PER_HOUR);
        const m = Math.round((d.durationMs % MS_PER_HOUR) / MS_PER_MIN);
        const setDHM = (dd: number, hh: number, mm: number) =>
          onSetDuration(d.id, dd * MS_PER_DAY + hh * MS_PER_HOUR + mm * MS_PER_MIN);
        return (
          <div className={`cd-row${d.maxed ? " cd-row--maxed" : ""}`} key={d.id}>
            <input
              className="cd-name"
              value={d.name}
              onChange={(e) => onRename(d.id, e.target.value)}
              placeholder={t("recurring.namePlaceholder", locale)}
            />
            {rank ? (
              d.ladderId ? (
                <div className="cd-rank">
                  <RungCurtain
                    text={ladderText(d.ladderId, rank.position(d.id), (k) => displayName(k, locale))!}
                    ladderId={d.ladderId}
                    currentRung={ladderProgress(d.ladderId, rank.position(d.id))!.rungLabel}
                    onPick={(label) => rank.onSetRung(d.id, label)}
                    locale={locale}
                  />
                </div>
              ) : (
                <div className="cd-rank cd-rank--none">—</div> // custom chore: fixed daily cadence, no rank
              )
            ) : (
              <div className="cd-dur" {...tipHint(t("recurring.durationTitle", locale))}>
                <input
                  className="cd-dur__n"
                  type="number"
                  min={0}
                  max={365}
                  value={days}
                  onChange={(e) => setDHM(readNum(e.target), h, m)}
                />
                <span className="cd-dur__u">d</span>
                <input
                  className="cd-dur__n"
                  type="number"
                  min={0}
                  max={23}
                  value={h}
                  onChange={(e) => setDHM(days, readNum(e.target), m)}
                />
                <span className="cd-dur__u">h</span>
                <input
                  className="cd-dur__n"
                  type="number"
                  min={0}
                  max={59}
                  value={m}
                  onChange={(e) => setDHM(days, h, readNum(e.target))}
                />
                <span className="cd-dur__u">m</span>
              </div>
            )}
            {onSetMaxed && (
              <button
                className={`icon-btn icon-btn--maxed${d.maxed ? " icon-btn--maxed-on" : ""}`}
                onClick={() => onSetMaxed(d.id, !d.maxed)}
                {...tip(t(d.maxed ? "recurring.restoreMaxed" : "recurring.markMaxed", locale))}
              >
                {/* the button names the rank it grants — "P" mostly, "M1" on languages (their ceiling) */}
                {ladderCapLabel(d.ladderId) ?? "P"}
              </button>
            )}
            <button className="icon-btn icon-btn--danger" onClick={() => onRemove(d.id)} {...tip(t("recurring.removeItem", locale))}>
              ✕
            </button>
          </div>
        );
      })}
      {items.length === 0 && <div className="empty">{emptyLabel}</div>}

      {picker ? (
        <TrainingPicker
          entries={picker.entries}
          present={picker.present}
          onPick={picker.onPick}
          onCustom={onAdd}
          addLabel={addLabel}
          locale={locale}
        />
      ) : (
        <button className="btn-dashed" onClick={onAdd}>
          {addLabel}
        </button>
      )}
    </div>
  );
}

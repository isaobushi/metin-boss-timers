import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { BackIcon, ElementIcon, SwapIcon, UndoIcon, TrashIcon } from "./icons";
import { COLUMNS, ELEMENTS, findToken, type Token } from "./sequenceTokens";
import { useSequence, type SequenceController } from "./useSequence";
import { playSelect } from "./audio";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  onBack: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

type Tool = "elements" | "columns";

/**
 * The Templum Serpens sequence-memory helper. Modeless and tap-only: tap a picker to append
 * a step, tap a recall chip to tick it off as destroyed/opened, and the next-to-do step
 * auto-highlights. A swap control flips between the two tools — Phase 1 elements and Phase 2
 * columns — each keeping its own sequence so flipping never loses what was recorded. State
 * is in-memory: leaving the screen starts fresh (same as the timer screens).
 */
export function SequenceScreen({ onBack, locale }: Props) {
  const elements = useSequence(4); // Phase 1 — at most four metin groups
  const columns = useSequence(); // Phase 2
  const [tool, setTool] = useState<Tool>("elements");
  const swap = () => setTool((cur) => (cur === "elements" ? "columns" : "elements"));

  const isElements = tool === "elements";
  const c = isElements ? elements : columns;
  const alphabet = isElements ? ELEMENTS : COLUMNS;

  return (
    <div className="panel sequence">
      <div className="seq-head">
        <button className="icon-btn" onClick={onBack} title={t("sequence.back", locale)}>
          <BackIcon />
        </button>
        {/* Labeled destination toggle: the text is where you'll land, so the control says
            what tapping does — not just "swap". Accent-filled to read as the primary action. */}
        <button
          className="seq-swap"
          onClick={swap}
          aria-label={isElements ? t("sequence.switchToColumns", locale) : t("sequence.switchToElements", locale)}
          title={isElements ? t("sequence.switchToColumnsTitle", locale) : t("sequence.switchToElementsTitle", locale)}
        >
          <SwapIcon />
          <span className="seq-swap__label">{isElements ? t("sequence.columnsLabel", locale) : t("sequence.elementsLabel", locale)}</span>
        </button>
        {/* doubles as the window's drag handle */}
        <span className="seq-head__title" data-tauri-drag-region>
          {isElements ? t("sequence.titleElements", locale) : t("sequence.titleColumns", locale)}
        </span>
        <span className="seq-count">{c.state.steps.length}</span>
        <button className="icon-btn" onClick={c.undo} disabled={!c.state.steps.length} title={t("sequence.undo", locale)}>
          <UndoIcon />
        </button>
        <button
          className="icon-btn icon-btn--danger"
          onClick={c.clear}
          disabled={!c.state.steps.length}
          title={t("sequence.clear", locale)}
        >
          <TrashIcon />
        </button>
      </div>

      {isElements ? <ElementPicker c={elements} /> : <ColumnPad c={columns} />}

      <RecallTrack
        c={c}
        alphabet={alphabet}
        locale={locale}
        trailing={
          isElements ? (
            <button
              className="icon-btn icon-btn--queen"
              onClick={elements.rotate}
              disabled={elements.state.steps.length < 2}
              aria-label={t("sequence.queenShift", locale)}
              title={t("sequence.queenShiftTitle", locale)}
            />
          ) : undefined
        }
      />
    </div>
  );
}

/** Phase 1: a row of element pills; duplicates allowed (the four groups can share one). */
function ElementPicker({ c }: { c: SequenceController }) {
  return (
    <div className="elt-row">
      {ELEMENTS.map((tok) => (
        <button
          key={tok.id}
          className="elt-pill"
          style={{ "--c": tok.color } as CSSProperties}
          onClick={() => {
            playSelect();
            c.append(tok.id);
          }}
        >
          <span className="elt-pill__icon">{tok.icon && <ElementIcon name={tok.icon} />}</span>
          <span className="elt-pill__name">{tok.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Phase 2: a compact L1-3 ┊ R1-3 pad; each column is tapped once and badged with its order. */
function ColumnPad({ c }: { c: SequenceController }) {
  const left = COLUMNS.filter((tok) => tok.side === "L");
  const right = COLUMNS.filter((tok) => tok.side === "R");
  return (
    <div className="col-pad">
      <div className="col-group">
        {left.map((tok) => (
          <ColumnNode key={tok.id} tok={tok} c={c} />
        ))}
      </div>
      <div className="col-divider" />
      <div className="col-group">
        {right.map((tok) => (
          <ColumnNode key={tok.id} tok={tok} c={c} />
        ))}
      </div>
    </div>
  );
}

function ColumnNode({ tok, c }: { tok: Token; c: SequenceController }) {
  const order = c.state.steps.indexOf(tok.id); // -1 until tapped (each column tapped once)
  const picked = order >= 0;
  const isNext = c.nextIndex >= 0 && c.state.steps[c.nextIndex] === tok.id;
  return (
    <button
      className={`col-node${picked ? " is-picked" : ""}${isNext ? " is-next" : ""}`}
      style={{ "--c": tok.color } as CSSProperties}
      disabled={picked}
      onClick={() => c.append(tok.id)}
    >
      <span className="col-node__label">{tok.label}</span>
      {picked && <span className="col-node__order">{order + 1}</span>}
    </button>
  );
}

/**
 * Shared recall track: the recorded order as chips; tap a chip to tick it off. `trailing`
 * sits inline after the chips (the Elements tool puts its Queen-shift button there).
 */
function RecallTrack({
  c,
  alphabet,
  locale,
  trailing,
}: {
  c: SequenceController;
  alphabet: Token[];
  locale: Locale;
  trailing?: ReactNode;
}) {
  if (c.state.steps.length === 0) {
    return <div className="empty">{t("sequence.empty", locale)}</div>;
  }
  return (
    <div className="track">
      {c.state.steps.map((id, i) => {
        const tok = findToken(alphabet, id);
        const done = c.state.done[i];
        const current = i === c.nextIndex;
        return (
          <button
            key={i}
            className={`track-chip${done ? " is-done" : ""}${current ? " is-current" : ""}`}
            style={{ "--c": tok.color } as CSSProperties}
            onClick={() => c.toggleDone(i)}
            title={t("sequence.chipTitle", locale)}
          >
            <b>{i + 1}</b>
            {tok.icon ? <ElementIcon name={tok.icon} /> : tok.label}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

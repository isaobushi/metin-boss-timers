import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { ElementIcon, SwapIcon, UndoIcon, TrashIcon } from "./icons";
import { COLUMNS, ELEMENTS, findToken, type Token } from "./sequenceTokens";
import { useSequence, type SequenceController } from "./useSequence";
import { playSelect } from "./audio";

type Props = { onBack: () => void };

type Tool = "elements" | "columns";

/**
 * The Templum Serpens sequence-memory helper. Modeless and tap-only: tap a picker to append
 * a step, tap a recall chip to tick it off as destroyed/opened, and the next-to-do step
 * auto-highlights. A swap control flips between the two tools — Phase 1 elements and Phase 2
 * columns — each keeping its own sequence so flipping never loses what was recorded. State
 * is in-memory: leaving the screen starts fresh (same as the timer screens).
 */
export function SequenceScreen({ onBack }: Props) {
  const elements = useSequence(4); // Phase 1 — at most four metin groups
  const columns = useSequence(); // Phase 2
  const [tool, setTool] = useState<Tool>("elements");
  const swap = () => setTool((t) => (t === "elements" ? "columns" : "elements"));

  const isElements = tool === "elements";
  const c = isElements ? elements : columns;
  const alphabet = isElements ? ELEMENTS : COLUMNS;

  return (
    <div className="panel sequence">
      <div className="seq-head">
        <button className="icon-btn" onClick={onBack} title="back to boss select">
          ←
        </button>
        {/* Labeled destination toggle: the text is where you'll land, so the control says
            what tapping does — not just "swap". Accent-filled to read as the primary action. */}
        <button
          className="seq-swap"
          onClick={swap}
          aria-label={isElements ? "Switch to Columns (Phase 2)" : "Switch to Elements (Phase 1)"}
          title={isElements ? "switch to columns (Phase 2)" : "switch to elements (Phase 1)"}
        >
          <SwapIcon />
          <span className="seq-swap__label">{isElements ? "Columns" : "Elements"}</span>
        </button>
        {/* doubles as the window's drag handle */}
        <span className="seq-head__title" data-tauri-drag-region>
          {isElements ? "TEMPLUM · ELEMENTS" : "TEMPLUM · COLUMNS"}
        </span>
        <span className="seq-count">{c.state.steps.length}</span>
        <button className="icon-btn" onClick={c.undo} disabled={!c.state.steps.length} title="undo last">
          <UndoIcon />
        </button>
        <button
          className="icon-btn icon-btn--danger"
          onClick={c.clear}
          disabled={!c.state.steps.length}
          title="clear"
        >
          <TrashIcon />
        </button>
      </div>

      {isElements ? <ElementPicker c={elements} /> : <ColumnPad c={columns} />}

      <RecallTrack
        c={c}
        alphabet={alphabet}
        trailing={
          isElements ? (
            <button
              className="icon-btn icon-btn--queen"
              onClick={elements.rotate}
              disabled={elements.state.steps.length < 2}
              aria-label="Queen shift"
              title="queen: shift the order one place (1·2·3·4 → 4·1·2·3)"
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
      {ELEMENTS.map((t) => (
        <button
          key={t.id}
          className="elt-pill"
          style={{ "--c": t.color } as CSSProperties}
          onClick={() => {
            playSelect();
            c.append(t.id);
          }}
        >
          <span className="elt-pill__icon">{t.icon && <ElementIcon name={t.icon} />}</span>
          <span className="elt-pill__name">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Phase 2: a compact L1-3 ┊ R1-3 pad; each column is tapped once and badged with its order. */
function ColumnPad({ c }: { c: SequenceController }) {
  const left = COLUMNS.filter((t) => t.side === "L");
  const right = COLUMNS.filter((t) => t.side === "R");
  return (
    <div className="col-pad">
      <div className="col-group">
        {left.map((t) => (
          <ColumnNode key={t.id} t={t} c={c} />
        ))}
      </div>
      <div className="col-divider" />
      <div className="col-group">
        {right.map((t) => (
          <ColumnNode key={t.id} t={t} c={c} />
        ))}
      </div>
    </div>
  );
}

function ColumnNode({ t, c }: { t: Token; c: SequenceController }) {
  const order = c.state.steps.indexOf(t.id); // -1 until tapped (each column tapped once)
  const picked = order >= 0;
  const isNext = c.nextIndex >= 0 && c.state.steps[c.nextIndex] === t.id;
  return (
    <button
      className={`col-node${picked ? " is-picked" : ""}${isNext ? " is-next" : ""}`}
      style={{ "--c": t.color } as CSSProperties}
      disabled={picked}
      onClick={() => c.append(t.id)}
    >
      <span className="col-node__label">{t.label}</span>
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
  trailing,
}: {
  c: SequenceController;
  alphabet: Token[];
  trailing?: ReactNode;
}) {
  if (c.state.steps.length === 0) {
    return <div className="empty">tap above to record the order — tap a chip to tick it off</div>;
  }
  return (
    <div className="track">
      {c.state.steps.map((id, i) => {
        const t = findToken(alphabet, id);
        const done = c.state.done[i];
        const current = i === c.nextIndex;
        return (
          <button
            key={i}
            className={`track-chip${done ? " is-done" : ""}${current ? " is-current" : ""}`}
            style={{ "--c": t.color } as CSSProperties}
            onClick={() => c.toggleDone(i)}
            title="tap when destroyed / opened"
          >
            <b>{i + 1}</b>
            {t.icon ? <ElementIcon name={t.icon} /> : t.label}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

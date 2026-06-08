import { useCallback, useMemo, useState } from "react";
import * as seq from "../engine/sequence";
import type { SeqState } from "../engine/sequence";

export type SequenceController = {
  state: SeqState;
  /** First not-done step, or -1 when empty / all done (drives the "next" highlight). */
  nextIndex: number;
  append: (id: string) => void;
  undo: () => void;
  clear: () => void;
  toggleDone: (i: number) => void;
  /** Cycle the order one place right (the Templum "queen" shift). */
  rotate: () => void;
};

/**
 * Thin React control layer over the pure sequence model — same pattern as useConfig, but
 * in-memory only: a recorded sequence is ephemeral per visit (leaving the screen unmounts
 * it, matching the app's "switching screens starts fresh" behaviour). Each call owns one
 * independent sequence, so the Elements and Columns tools can each keep their own.
 */
export function useSequence(capacity?: number): SequenceController {
  const [state, setState] = useState<SeqState>(seq.emptySeq);

  const append = useCallback(
    (id: string) => setState((s) => seq.append(s, id, capacity)),
    [capacity],
  );
  const undo = useCallback(() => setState((s) => seq.undo(s)), []);
  const clear = useCallback(() => setState(seq.clear()), []);
  const toggleDone = useCallback((i: number) => setState((s) => seq.toggleDone(s, i)), []);
  const rotate = useCallback(() => setState((s) => seq.rotate(s)), []);

  const nextIndex = useMemo(() => seq.nextIndex(state), [state]);

  return { state, nextIndex, append, undo, clear, toggleDone, rotate };
}

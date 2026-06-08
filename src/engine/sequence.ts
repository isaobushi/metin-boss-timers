// Pure model for the Templum Serpens sequence-memory helper. Like the timer and config
// engines it owns no React and no storage: a sequence is just an ordered list of token ids
// with a parallel "done" flag per step, and every operation is a pure transform. That keeps
// the record/recall logic unit-testable with no DOM. The React layer (overlay/useSequence)
// holds the state and calls these; the token ids it stores come from overlay/sequenceTokens.

export type SeqState = {
  /** Token ids in the order they were tapped (Phase-1 repeats allowed). */
  steps: string[];
  /** Parallel to `steps`: whether each step has been ticked off during recall. */
  done: boolean[];
};

export const emptySeq = (): SeqState => ({ steps: [], done: [] });

/** Append a step, not-yet-done. */
export function append(s: SeqState, id: string): SeqState {
  return { steps: [...s.steps, id], done: [...s.done, false] };
}

/** Drop the last step (no-op on an empty sequence). */
export function undo(s: SeqState): SeqState {
  return { steps: s.steps.slice(0, -1), done: s.done.slice(0, -1) };
}

/** Forget everything. */
export const clear = (): SeqState => emptySeq();

/** Flip one step's done flag (out-of-range index is a no-op). */
export function toggleDone(s: SeqState, i: number): SeqState {
  return { ...s, done: s.done.map((v, idx) => (idx === i ? !v : v)) };
}

/**
 * Index of the next step to tick off — the first not-done step. Returns -1 when the
 * sequence is empty or every step is already done, so the UI can stop highlighting.
 */
export function nextIndex(s: SeqState): number {
  if (s.steps.length === 0) return -1;
  return s.done.findIndex((d) => !d);
}

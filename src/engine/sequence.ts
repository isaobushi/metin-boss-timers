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

/**
 * Append a step, not-yet-done. With `max` set, the sequence is capped: once it holds `max`
 * steps the append is a no-op (the Elements tool records at most four — one per metin group).
 */
export function append(s: SeqState, id: string, max?: number): SeqState {
  if (max !== undefined && s.steps.length >= max) return s;
  return { steps: [...s.steps, id], done: [...s.done, false] };
}

/**
 * Rotate the sequence one place to the right — the last step (and its done flag) becomes the
 * first, e.g. 1·2·3·4 → 4·1·2·3. Models the Templum "queen" shift, where the metin order
 * cycles by one but each one keeps whether it was already destroyed. No-op below two steps.
 */
export function rotate(s: SeqState): SeqState {
  const n = s.steps.length;
  if (n < 2) return s;
  return {
    steps: [s.steps[n - 1], ...s.steps.slice(0, n - 1)],
    done: [s.done[n - 1], ...s.done.slice(0, n - 1)],
  };
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

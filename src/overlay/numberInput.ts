/**
 * Read a controlled number input's value as a number, scrubbing "032"-style leading zeros
 * from the DOM. React skips rewriting a number input whose parsed value is unchanged (to
 * preserve the caret), so a typed leading zero would otherwise stick on screen forever.
 * The rewrite happens only when a leading zero is actually present — an in-progress clear
 * (empty field) is left alone so typing isn't fought.
 */
export function readNum(input: HTMLInputElement): number {
  const n = Number(input.value) || 0;
  if (/^0\d/.test(input.value)) input.value = String(n);
  return n;
}

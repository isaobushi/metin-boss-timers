// Impure global-hotkey adapter — the OS boundary for slice #6, mirroring configStore's
// split: all combo logic is pure in `engine/hotkey.ts`; this only registers/unregisters
// real shortcuts and routes a fired key to the timer's `trigger` action.
//
// In the Tauri app it uses the global-shortcut plugin, so a bound key fires even while
// the GAME window has focus (the whole point — you press the skill key in-game and the
// overlay re-arms). Under plain-browser dev (`npm run dev`) there's no OS shortcut, so
// it falls back to an in-window `keydown` listener; the two never both run, so a key
// can't double-fire. Either way it's best-effort: a registration failure (e.g. a combo
// the OS reserves) must never break the overlay.
import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { eventToCombo, toAccelerator } from "../engine/hotkey";
import type { SkillCfg } from "../engine/config";

/** True while a text field is focused, so capture/fire never hijack normal typing. */
export function inTextField(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/**
 * Register the active boss's bound shortcuts; a fired shortcut calls `onFire(skillId)`
 * (wired to the timer `trigger`). Mount this only where the active boss's timers live
 * (the timer screen), so exactly that boss's bindings are registered and a boss switch —
 * which unmounts/remounts the screen — re-registers from scratch. Re-runs whenever the
 * set of bindings changes.
 */
export function useHotkeys(skills: SkillCfg[], onFire: (skillId: string) => void) {
  // Keep the latest onFire without making it a dependency, so the effect is keyed purely
  // on the bindings and never re-registers on an unrelated re-render. Refreshed in an
  // effect (not during render) so the ref-write stays a side effect.
  const fire = useRef(onFire);
  useEffect(() => {
    fire.current = onFire;
  });

  const bindings = skills.flatMap((s) => (s.hotkey ? [{ combo: s.hotkey, skillId: s.id }] : []));
  const sig = bindings.map((b) => `${b.combo}:${b.skillId}`).join("|");

  useEffect(() => {
    if (isTauri()) {
      let cancelled = false;
      void (async () => {
        try {
          await unregisterAll(); // clear the previous boss's bindings first
          for (const b of bindings) {
            if (cancelled) break;
            await register(toAccelerator(b.combo), (e) => {
              // global-shortcut emits Pressed and Released; act on Pressed only
              if (e.state === "Pressed" && !inTextField()) fire.current(b.skillId);
            });
          }
        } catch {
          /* OS refused a combo / plugin unavailable — overlay keeps working without it */
        }
      })();
      return () => {
        cancelled = true;
        void unregisterAll().catch(() => {});
      };
    }

    // browser-dev fallback: in-window keydown (only fires while the overlay is focused)
    const byCombo = new Map(bindings.map((b) => [b.combo, b.skillId]));
    const onKey = (e: KeyboardEvent) => {
      if (inTextField()) return;
      const combo = eventToCombo(e);
      if (!combo) return;
      const id = byCombo.get(combo);
      if (id) {
        e.preventDefault();
        fire.current(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // bindings is derived from sig; re-registering is keyed on the binding set alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}

// Cross-window TRANSIENT messaging — the impure sibling of configSync for one-shot intents
// that must never touch durable state. configSync carries the persisted config (every payload
// is also on disk); this carries fire-and-forget commands between windows — "navigate to this
// settings tab" (#72), and the tour-replay request when slice 5 (#73) lands. A transient
// message that misses its window (nothing open, nothing subscribed) is correctly LOST — that's
// the contract; anything that must survive a miss belongs in configSync/configStore instead.
//
// Transport mirrors configSync exactly: the Tauri event bus (emit fans out to every webview
// including the sender, so payloads carry the sender's label and listeners drop their own
// echoes) or a BroadcastChannel under plain-browser dev — which by spec never delivers to the
// posting instance, but DOES deliver to other instances in the same document, so the overlay's
// inline settings modal (browser mode) receives these too. Every call is best-effort: a
// missing bus must never break the sender.
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isSettingsTab, type SettingsTab } from "../engine/settingsLink";

const EVENT = "transient://message"; // Tauri event name
const CHANNEL = "metin-boss-timers:transient"; // browser BroadcastChannel name

/** The one-shot intents windows send each other. #73 adds `{ kind: "tour-replay" }`. */
export type TransientMsg = { kind: "settings-navigate"; tab: SettingsTab };

type Wire = { from: string; payload: TransientMsg };

/** Runtime guard for wire payloads — a malformed message is dropped, never dispatched. */
function isTransientMsg(value: unknown): value is TransientMsg {
  const msg = value as TransientMsg | null;
  return msg?.kind === "settings-navigate" && isSettingsTab(msg.tab);
}

/** Send a one-shot intent to the other window(s). Fire-and-forget; lost if nobody listens. */
export function emitTransient(msg: TransientMsg): void {
  try {
    if (isTauri()) {
      void emit(EVENT, { from: getCurrentWindow().label, payload: msg } satisfies Wire);
      return;
    }
    new BroadcastChannel(CHANNEL).postMessage(msg);
  } catch {
    /* no bus available — the intent is simply lost; senders must not depend on delivery */
  }
}

/** Subscribe to intents from *other* windows; returns an unsubscribe. */
export function subscribeTransient(cb: (msg: TransientMsg) => void): () => void {
  try {
    if (isTauri()) {
      const me = getCurrentWindow().label;
      const unlisten = listen<Wire>(EVENT, (e) => {
        if (e.payload.from !== me && isTransientMsg(e.payload.payload)) cb(e.payload.payload); // ignore our own echo
      });
      return () => void unlisten.then((off) => off()).catch(() => {});
    }
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      if (isTransientMsg(e.data)) cb(e.data);
    };
    return () => channel.close();
  } catch {
    return () => {}; // no bus — nothing to clean up
  }
}

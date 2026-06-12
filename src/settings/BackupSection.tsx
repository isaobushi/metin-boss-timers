import { useRef, useState } from "react";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";
import { DownloadIcon, UploadIcon } from "../overlay/icons";

type Props = {
  /** Serialize the live config to a portable backup string. */
  onExport: () => string;
  /** Apply an imported backup string; returns false if it isn't a valid backup (no change made). */
  onImport: (text: string) => boolean;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

const FILENAME = "dragonsaid-backup.json";

/**
 * The backup buttons (PRD #48, issue #56) — export the full config to a portable file, or import one
 * back. A backup/trust feature, not an upgrade bridge. Over-cap data round-trips intact; the gate
 * freezes any excess as a read-only view, so importing a Pro backup into Lite loses nothing.
 *
 * Renders as two icon buttons for the settings header strip (design walk); the long explainer
 * lives in each button's tooltip, and the result note pops as a transient chip under the strip.
 *
 * File I/O uses plain DOM (Blob download + file input), which works in both the Tauri webview and the
 * browser demo — no native dialog dependency.
 */
export function BackupSection({ onExport, onImport, locale }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const doExport = () => {
    const blob = new Blob([onExport()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILENAME;
    a.click();
    URL.revokeObjectURL(url);
    setNote(t("backup.exported", locale));
  };

  const onFile = async (file: File) => {
    const ok = onImport(await file.text());
    setNote(ok ? t("backup.imported", locale) : t("backup.invalid", locale));
    if (fileRef.current) fileRef.current.value = ""; // allow re-importing the same file
  };

  return (
    <>
      <button
        className="settings-icon-btn"
        onClick={doExport}
        title={`${t("backup.export", locale)} — ${t("backup.hint", locale)}`}
        aria-label={t("backup.export", locale)}
      >
        <DownloadIcon />
      </button>
      <button
        className="settings-icon-btn"
        onClick={() => fileRef.current?.click()}
        title={`${t("backup.import", locale)} — ${t("backup.hint", locale)}`}
        aria-label={t("backup.import", locale)}
      >
        <UploadIcon />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      {note && <span className="backup-note">{note}</span>}
    </>
  );
}

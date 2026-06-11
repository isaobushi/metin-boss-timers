import { useRef, useState } from "react";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

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
 * The backup section (PRD #48, issue #56) — export the full config to a portable file, or import one
 * back. A backup/trust feature, not an upgrade bridge. Over-cap data round-trips intact; the gate
 * freezes any excess as a read-only view, so importing a Pro backup into Lite loses nothing.
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
    <div className="backup-section">
      <div className="backup-section__row">
        <button className="btn-dashed" onClick={doExport}>
          {t("backup.export", locale)}
        </button>
        <button className="btn-dashed" onClick={() => fileRef.current?.click()}>
          {t("backup.import", locale)}
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
      </div>
      <p className="backup-section__hint">
        {t("backup.hint", locale)}
      </p>
      {note && <p className="backup-section__note">{note}</p>}
    </div>
  );
}

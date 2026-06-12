// Locale selector for the Settings window (PRD #77, slice #83, Story 6). Reworked in the
// design walk from one-button-per-locale to a searchable curtain (RungCurtain's idiom):
// the pre-launch language push (#99) takes the list to ~16 entries, where a button row
// stops scaling. Receives values + callbacks as props, lets `SettingsApp` drive through
// `useConfig`; only the open/query state is local.
import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LOCALES, type Locale } from "../engine/contentCatalog";
import { LOCALE_LABELS } from "../engine/localeTypes";
import { t } from "../engine/chrome";

type Props = {
  /** The currently active locale. */
  locale: Locale;
  /** Called when the user selects a different locale. */
  onChange: (locale: Locale) => void;
};

/**
 * The locale-selector section inside Settings: a trigger showing the current language that
 * drops a filterable curtain of every `SUPPORTED_LOCALES` entry (new locales appear here
 * automatically as their content tables land). Picking fires `onChange` immediately — the
 * overlay re-resolves seeded content on the next render via the live locale from `useConfig`.
 *
 * No edge-aware anchoring (unlike RungCurtain): settings is a normal scrollable window, so
 * the curtain always opens downward.
 */
export function LocaleSettings({ locale, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Close on an outside click, like the overlay's dropdowns.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => {
    if (open) inputRef.current?.focus(); // type-to-filter straight away
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = SUPPORTED_LOCALES.filter((l) => LOCALE_LABELS[l].toLowerCase().includes(q));

  const pick = (l: Locale) => {
    onChange(l);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="panel locale-settings">
      <div className="settings-head">
        <span className="locale-settings__title">{t("locale.title", locale)}</span>
      </div>
      <div className="rung-curtain locale-curtain" ref={rootRef}>
        <button
          className="locale-curtain__trigger"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {LOCALE_LABELS[locale]}
          <span className="locale-curtain__chev" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <div className="rung-menu locale-curtain__menu">
            <input
              ref={inputRef}
              className="rung-menu__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("locale.filterPlaceholder", locale)}
              aria-label={t("locale.filterAriaLabel", locale)}
            />
            <div className="rung-menu__list" role="listbox">
              {shown.length === 0 ? (
                <div className="rung-menu__empty">{t("rung.noMatch", locale)}</div>
              ) : (
                shown.map((l) => (
                  <button
                    key={l}
                    role="option"
                    aria-selected={locale === l}
                    className={`rung-menu__item${locale === l ? " is-current" : ""}`}
                    onClick={() => pick(l)}
                  >
                    {LOCALE_LABELS[l]}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <p className="locale-settings__hint">{t("locale.hint", locale)}</p>
    </div>
  );
}

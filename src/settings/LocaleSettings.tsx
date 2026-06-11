// Locale selector for the Settings window (PRD #77, slice #83, Story 6). A minimal
// section that shows the current locale and lets the user choose from the supported list.
// Mirrors the BackupSection / RecurringSettings idiom: receives values + callbacks as props,
// owns no state, lets the caller (`SettingsApp`) drive through `useConfig`.
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
 * The locale-selector section inside Settings. Renders one button per supported locale,
 * highlighting the current choice. Switching fires `onChange` immediately — the overlay
 * re-resolves seeded content on the next render via the live locale from `useConfig`.
 *
 * Only `en` is available until Slice 5; the selector is still shown so the wiring is
 * testable and the UX is in place for when more locales land.
 */
export function LocaleSettings({ locale, onChange }: Props) {
  return (
    <div className="panel locale-settings">
      <div className="settings-head">
        <span className="locale-settings__title">{t("locale.title", locale)}</span>
      </div>
      <div className="locale-settings__opts">
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            className={`locale-settings__opt${locale === l ? " is-active" : ""}`}
            onClick={() => onChange(l)}
            aria-pressed={locale === l}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
      <p className="locale-settings__hint">
        {t("locale.hint", locale)}
      </p>
    </div>
  );
}

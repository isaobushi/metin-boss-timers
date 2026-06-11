import type { Mutation } from "../engine/entitlement";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  mutation: Mutation;
  onUpgrade: () => void;
  onDismiss: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The cap-hit nudge (PRD #48, issue #56) — shown when a Lite user bumps a cap. It names the limit and
 * the Pro unlock, with one path up (Upgrade → subscribe screen) and a plain dismiss. No dark patterns:
 * the cap is stated honestly, the close is always there, nothing is pre-checked or guilt-framed.
 */
export function CapNudge({ mutation, onUpgrade, onDismiss, locale }: Props) {
  const text =
    mutation === "addBoss" ? t("cap.addBoss", locale) :
    mutation === "addCharacter" ? t("cap.addCharacter", locale) :
    t("cap.addReminder", locale);
  return (
    <div className="cap-nudge" role="alert">
      <p className="cap-nudge__text">{text}</p>
      <div className="cap-nudge__actions">
        <button className="cap-nudge__upgrade" onClick={onUpgrade}>
          {t("cap.seePro", locale)}
        </button>
        <button className="cap-nudge__dismiss" onClick={onDismiss}>
          {t("cap.dismiss", locale)}
        </button>
      </div>
    </div>
  );
}

// One-off (#99 slices 2–5): emit translator reference files under scripts/.gen/.
//   ref-content.json — the content keys a translator must hand-author (EN + IT example), split
//     into `translate` (free render) and `verbatim` (proper nouns kept as-is, shown for context).
//   ref-chrome.json — every chrome key (EN + IT example) plus the `omit` list (long marketing
//     prose that should fall back to English, mirroring the DE partial).
// The 71 class skills + 5 races are NOT here: the generator pulls those straight from the dump /
// locale, so a translator never re-types an authoritative string. Run: node scripts/gen-refs.mjs
import fs from "node:fs";

const GEN = "scripts/.gen";
fs.mkdirSync(GEN, { recursive: true });

// Parse a `"key": "value",` object body into a flat map (CRLF/escaped-quote safe).
function parseTable(src, marker, endTok = "\n};") {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const from = start + marker.length;
  const end = src.indexOf(endTok, from);
  const body = src.slice(from, end);
  const out = {};
  for (const m of body.matchAll(/^[ \t]*"([^"]+)":[ \t]*"((?:[^"\\]|\\.)*)"/gm)) {
    out[m[1]] = JSON.parse(`"${m[2]}"`);
  }
  return out;
}

const content = fs.readFileSync("src/engine/contentCatalog.ts", "utf8");
const IT = parseTable(content, "const IT: Record<string, string> = {");

const chromeSrc = fs.readFileSync("src/engine/chrome.ts", "utf8");
const EN_CHROME = parseTable(chromeSrc, "const EN = {", "\n} as const;");
const IT_CHROME = parseTable(chromeSrc, "const IT_PARTIAL: Partial<ChromeTable> = {");

// English values for the hand-authored content keys (stable game/app terms). The generator owns
// the 71 dump skills + 5 races + the verbatim list below; these are everything else.
const EN_CONTENT = {
  "cooldown.hydra": "Hydra",
  "cooldown.northwind-war-chief": "Northwind War Chief",
  "recurring.battle-horse": "Battle Horse",
  "recurring.skill-books": "Skill Books",
  "recurring.transformation": "Transformation",
  "recurring.biologist": "Biologist",
  "recurring.ward": "Ward",
  "recurring.spirit-strike": "Spirit Strike",
  "recurring.lethal-wave": "Lethal Wave",
  "recurring.ethereal-shield": "Ethereal Shield",
  "recurring.jinno-language": "Jinno (language)",
  "recurring.chunjo-language": "Chunjo (language)",
  "recurring.shinsoo-language": "Shinsoo (language)",
  "build.body": "Body",
  "build.mental": "Mental",
  "build.blade-fight": "Blade Fight",
  "build.archery": "Archery",
  "build.weaponry": "Weaponry",
  "build.black-magic": "Black Magic",
  "build.dragon": "Dragon",
  "build.healing": "Healing",
  "build.instinct": "Instinct",
  "biologist.orc-tooth": "Orc Tooth",
  "biologist.curse-book": "Curse Book",
  "biologist.demon-s-keepsake": "Demon's Keepsake",
  "biologist.ice-marble": "Ice Marble",
  "biologist.zelkova-branch": "Zelkova Branch",
  "biologist.tugyi-s-tablet": "Tugyi's Tablet",
  "biologist.red-ghost-tree-branch": "Red Ghost Tree Branch",
  "biologist.leaders-notes": "Leader's Notes",
  "biologist.malevolence-jewel": "Malevolence Jewel",
  "biologist.wisdom-jewel": "Wisdom Jewel",
};

// Proper nouns the official client keeps verbatim across locales — NOT translated. The generator
// injects these directly; listed in the ref only so a translator sees they are already handled.
const VERBATIM = {
  "cooldown.razador": "Razador",
  "cooldown.nemere": "Nemere",
  "cooldown.meley": "Meley",
  "cooldown.balathor": "Balathor",
  "recurring.tempestus": "Tempestus",
  "recurring.infernus": "Infernus",
  "recurring.cicatrix": "Cicatrix",
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo": "Chunjo",
  "empire.jinno": "Jinno",
  // 2026-06-11 seed-swap items kept in English client-wide (mirrors DE/IT HITL decision).
  "recurring.alastor-pet": "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
};

const translate = {};
for (const key of Object.keys(EN_CONTENT)) {
  translate[key] = { en: EN_CONTENT[key], it: IT[key] ?? null };
}
const verbatim = {};
for (const key of Object.keys(VERBATIM)) verbatim[key] = VERBATIM[key];

fs.writeFileSync(
  `${GEN}/ref-content.json`,
  JSON.stringify({ translate, verbatim }, null, 2),
);

// Chrome: long marketing/onboarding prose to OMIT (English fallback), matching the DE partial's
// scope. Everything else should be translated.
const OMIT_CHROME = [
  ...Object.keys(EN_CHROME).filter((k) => k.startsWith("subscribe.lede")),
  ...Object.keys(EN_CHROME).filter((k) => k.startsWith("subscribe.unlock")),
  "cap.addBoss", "cap.addCharacter", "cap.addReminder",
  "backup.hint",
  ...Object.keys(EN_CHROME).filter((k) => k.startsWith("tour.") && k.endsWith("Body")),
];
const omitSet = new Set(OMIT_CHROME);

const chrome = {};
for (const key of Object.keys(EN_CHROME)) {
  chrome[key] = {
    en: EN_CHROME[key],
    it: IT_CHROME[key] ?? null,
    omit: omitSet.has(key),
  };
}
fs.writeFileSync(
  `${GEN}/ref-chrome.json`,
  JSON.stringify({ chrome, omit: OMIT_CHROME }, null, 2),
);

console.log("content keys to translate:", Object.keys(translate).length);
console.log("content verbatim (auto):", Object.keys(verbatim).length);
console.log("chrome keys total:", Object.keys(chrome).length, "| omit:", OMIT_CHROME.length, "| translate:", Object.keys(chrome).length - OMIT_CHROME.length);

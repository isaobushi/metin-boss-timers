// One-off (#99 slices 2–5): assemble ES/FR/PL/TR content + chrome tables and patch them into
// contentCatalog.ts and chrome.ts. Deterministic — every authoritative string comes from data:
//   • 71 class skills  ← skills-by-catalogkey.json names.<loc>
//   • 5 races          ← locale/<loc>.json JOB_* keys
//   • 12 proper nouns  ← VERBATIM (client keeps them as-is across locales)
//   • the rest (~32)   ← scripts/.gen/<loc>.json contentOverrides (hand-translated, flagged `// ?`)
// Chrome is free-translated; only keys the translator supplied are emitted (English fallback covers
// the rest), mirroring the DE partial. Idempotent: skips a locale whose block is already present.
// Run AFTER the per-locale translation JSONs exist: node scripts/gen-locale-tables.mjs
import fs from "node:fs";

const LOCALES = ["ro", "pt"];
const LOCALE_NAME = { ro: "Romanian", pt: "Portuguese" };
const JOB = {
  "race.warrior": "JOB_WARRIOR",
  "race.ninja": "JOB_ASSASSIN",
  "race.sura": "JOB_SURA",
  "race.shaman": "JOB_SHAMAN",
  "race.lycan": "JOB_WOLFMAN",
};

const dump = JSON.parse(
  fs.readFileSync("reference/metin2alerts/skills-by-catalogkey.json", "utf8"),
).skills;
const ref = JSON.parse(fs.readFileSync("scripts/.gen/ref-content.json", "utf8"));
const VERBATIM = ref.verbatim;
const TRANSLATE_KEYS = Object.keys(ref.translate);

const VALUE_RE = /^([ \t]*)"([^"]+)":[ \t]*"(?:[^"\\]|\\.)*",?.*$/;
const SECTION_RE = /^[ \t]*\/\/ ----.*----\s*$/;

function readBlockBody(src, marker, endTok = "\n};") {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const from = start + marker.length;
  const end = src.indexOf(endTok, from);
  return src.slice(from, end);
}

// Resolve one content key for a locale. Precedence: verbatim > race > hand-override > dump skill.
function contentValue(key, loc, overrides) {
  if (key in VERBATIM) return { value: VERBATIM[key], flagged: false };
  if (key in JOB) {
    const lj = localeJson(loc);
    return { value: lj[JOB[key]], flagged: false };
  }
  if (TRANSLATE_KEYS.includes(key)) {
    if (!(key in overrides)) throw new Error(`[${loc}] missing override for ${key}`);
    return { value: overrides[key], flagged: true };
  }
  const d = dump[key]?.names?.[loc];
  if (d) return { value: d, flagged: false };
  throw new Error(`[${loc}] uncovered content key ${key}`);
}

const _localeCache = {};
function localeJson(loc) {
  return (_localeCache[loc] ??= JSON.parse(
    fs.readFileSync(`reference/metin2alerts/locale/${loc}.json`, "utf8"),
  ));
}

// Rebuild a table body from the IT block as structural template: keep section headers + blanks,
// drop IT-specific prose comments, substitute each value. `// ?` marks hand-translated keys.
function rebuildContent(itBody, loc, overrides, eol) {
  const out = [];
  for (const raw of itBody.split(/\r?\n/)) {
    const rawLine = raw.replace(/\r$/, "");
    const vm = rawLine.match(VALUE_RE);
    if (vm) {
      const [, indent, key] = vm;
      const { value, flagged } = contentValue(key, loc, overrides);
      out.push(`${indent}"${key}": ${JSON.stringify(value)},${flagged ? " // ?" : ""}`);
    } else if (SECTION_RE.test(rawLine) || rawLine.trim() === "") {
      out.push(rawLine);
    }
    // else: IT-specific prose comment — dropped
  }
  // collapse 3+ blank lines and trim leading/trailing blanks
  return out.join(eol);
}

function rebuildChrome(itBody, chrome, eol) {
  const out = [];
  for (const raw of itBody.split(/\r?\n/)) {
    const rawLine = raw.replace(/\r$/, "");
    const vm = rawLine.match(VALUE_RE);
    if (vm) {
      const [, indent, key] = vm;
      if (key in chrome) out.push(`${indent}"${key}": ${JSON.stringify(chrome[key])},`);
      // else: not translated → English fallback, omit line
    } else if (SECTION_RE.test(rawLine) || rawLine.trim() === "") {
      out.push(rawLine);
    }
  }
  return out.join(eol);
}

function detectEol(src) {
  return src.includes("\r\n") ? "\r\n" : "\n";
}

function tidy(block, eol) {
  // squeeze runs of blank lines to one, drop leading/trailing blanks
  return block
    .split(eol)
    .reduce((acc, l) => {
      if (l.trim() === "" && acc.length && acc[acc.length - 1].trim() === "") return acc;
      acc.push(l);
      return acc;
    }, [])
    .join(eol)
    .replace(new RegExp(`^(?:${eol})+`), "")
    .replace(new RegExp(`(?:${eol})+$`), "");
}

// ---- content patch ----
{
  const path = "src/engine/contentCatalog.ts";
  let src = fs.readFileSync(path, "utf8");
  const eol = detectEol(src);
  const itBody = readBlockBody(src, "const IT: Record<string, string> = {");
  const anchor = "const TABLES: Record<Locale, Record<string, string>> = {";

  for (const loc of LOCALES) {
    const upper = loc.toUpperCase();
    if (src.includes(`const ${upper}: Record<string, string> = {`)) {
      console.log(`content ${loc}: already present, skipping`);
      continue;
    }
    const overrides = JSON.parse(
      fs.readFileSync(`scripts/.gen/${loc}.json`, "utf8"),
    ).contentOverrides;
    const body = tidy(rebuildContent(itBody, loc, overrides, eol), eol);
    const header =
      `// ---- ${LOCALE_NAME[loc]} content table (#99) ----${eol}` +
      `// 71 class skills seeded from the metin2alerts dump (names.${loc}); 5 races from locale/${loc}.json${eol}` +
      `// JOB_*; proper nouns (empires, Tempestus/Infernus/Cicatrix, verbatim bosses) kept as-is. The${eol}` +
      `// \`// ?\` keys are hand-translated best-effort (no dump for bosses/builds/biologist/app-chores)${eol}` +
      `// and await a native ${LOCALE_NAME[loc]} cross-check. Every seededContentKeys() key is present${eol}` +
      `// (strict guard). See [[prelaunch-languages]] — seed-from-dump + spot-check house rule.${eol}`;
    const blockText = `${header}const ${upper}: Record<string, string> = {${eol}${body}${eol}};${eol}${eol}`;
    src = src.replace(anchor, blockText + anchor);
    // register in TABLES
    src = src.replace(/(\n[ \t]*it: IT,)/, `$1\n  ${loc}: ${upper},`);
    console.log(`content ${loc}: inserted`);
  }
  fs.writeFileSync(path, src);
}

// ---- chrome patch ----
{
  const path = "src/engine/chrome.ts";
  let src = fs.readFileSync(path, "utf8");
  const eol = detectEol(src);
  const itBody = readBlockBody(src, "const IT_PARTIAL: Partial<ChromeTable> = {");
  const anchor =
    "const TABLES: Record<Locale, Partial<ChromeTable>> & { en: ChromeTable } = {";

  for (const loc of LOCALES) {
    const ident = `${loc.toUpperCase()}_PARTIAL`;
    if (src.includes(`const ${ident}`)) {
      console.log(`chrome ${loc}: already present, skipping`);
      continue;
    }
    const chrome = JSON.parse(
      fs.readFileSync(`scripts/.gen/${loc}.json`, "utf8"),
    ).chrome;
    const body = tidy(rebuildChrome(itBody, chrome, eol), eol);
    const n = Object.keys(chrome).length;
    const header =
      `// ---- ${LOCALE_NAME[loc]} chrome table (#99) ----${eol}` +
      `// Free-translated UI strings (informal register). ${n} keys supplied; the rest fall back to${eol}` +
      `// English (same partial pattern as DE). Best-effort, pending a native ${LOCALE_NAME[loc]} review.${eol}`;
    const blockText = `${header}const ${ident}: Partial<ChromeTable> = {${eol}${body}${eol}};${eol}${eol}`;
    src = src.replace(anchor, blockText + anchor);
    src = src.replace(/(\n[ \t]*it: IT_PARTIAL,)/, `$1\n  ${loc}: ${ident},`);
    console.log(`chrome ${loc}: inserted (${n} keys)`);
  }
  fs.writeFileSync(path, src);
}

console.log("done");

// One-off: reseed the Italian content table in contentCatalog.ts from the validated metin2alerts
// dump (reference/metin2alerts/skills-by-catalogkey.json). For every catalogKey the dump covers,
// swap in dump.skills[key].names.it and drop its `// ?` marker; leave every other line (comments,
// blanks, and keys the dump doesn't carry) untouched so my draft + markers survive for the keys
// that still need an official-IT-client / native check. Run: node scripts/reseed-it-from-dump.mjs
import fs from "node:fs";

const dump = JSON.parse(
  fs.readFileSync("reference/metin2alerts/skills-by-catalogkey.json", "utf8"),
).skills;

const path = "src/engine/contentCatalog.ts";
const src = fs.readFileSync(path, "utf8");
const marker = "const IT: Record<string, string> = {";
const start = src.indexOf(marker) + marker.length;
const end = src.indexOf("\n};", start);
const block = src.slice(start, end);
const cr = block.includes("\r\n") ? "\r" : ""; // preserve CRLF on rebuilt lines

const swapped = [];
const kept = [];
// `m` flag: ^/$ per line; [^\n]* eats the trailing \r and any `// ?` comment, so this is CRLF-safe.
const newBlock = block.replace(
  /^([ \t]*)"([^"]+)":[ \t]*"(?:[^"\\]|\\.)*",[^\n]*$/gm,
  (line, indent, key) => {
    const it = dump[key]?.names?.it;
    if (it) {
      swapped.push(key);
      const head = `${indent}"${key}":`;
      return head.padEnd(indent.length + key.length + 4) + " " + JSON.stringify(it) + "," + cr;
    }
    kept.push(key);
    return line;
  },
);

fs.writeFileSync(path, src.slice(0, start) + newBlock + src.slice(end));
console.log("swapped from dump:", swapped.length);
console.log("kept as draft  :", kept.length);
console.log("\n=== KEPT (dump has no entry — still need IT-client / native check) ===");
console.log(kept.join("\n"));

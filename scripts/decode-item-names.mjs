// Decode metin2alerts item_names/<locale>.pbf (raw protobuf, no schema) into an id -> name map,
// then resolve the Biologist consignment item names by matching the English names and reading the
// same id from the Italian file. Wire format observed via xxd:
//   top-level = repeated field#1 (len-delim) Entry
//   Entry     = field#1 varint id, field#2 len-delim Names
//   Names     = field#1 len-delim string (the display name), field#2 len-delim (usually empty)
import fs from "node:fs";

function readVarint(buf, p) {
  let shift = 0, result = 0n;
  while (true) {
    const b = buf[p++];
    result |= BigInt(b & 0x7f) << BigInt(shift);
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return [Number(result), p];
}

// Parse a length-delimited message body into a list of {field, wire, val|bytes}
function fields(buf, start, end) {
  const out = [];
  let p = start;
  while (p < end) {
    let tag;
    [tag, p] = readVarint(buf, p);
    const field = tag >> 3, wire = tag & 7;
    if (wire === 0) {
      let v; [v, p] = readVarint(buf, p);
      out.push({ field, wire, v });
    } else if (wire === 2) {
      let len; [len, p] = readVarint(buf, p);
      out.push({ field, wire, bytes: buf.subarray(p, p + len) });
      p += len;
    } else if (wire === 5) { p += 4; }
    else if (wire === 1) { p += 8; }
    else throw new Error("bad wire " + wire + " at " + p);
  }
  return out;
}

function parseIdNameMap(path) {
  const buf = fs.readFileSync(path);
  const map = new Map();
  for (const e of fields(buf, 0, buf.length)) {
    if (e.field !== 1 || e.wire !== 2) continue; // top-level Entry
    const sub = fields(e.bytes, 0, e.bytes.length);
    const idF = sub.find((f) => f.field === 1 && f.wire === 0);
    const namesF = sub.find((f) => f.field === 2 && f.wire === 2);
    if (!idF || !namesF) continue;
    const nameFields = fields(namesF.bytes, 0, namesF.bytes.length);
    const nameF = nameFields.find((f) => f.field === 1 && f.wire === 2);
    const name = nameF ? Buffer.from(nameF.bytes).toString("utf8") : "";
    map.set(idF.v, name);
  }
  return map;
}

const en = parseIdNameMap("reference/metin2alerts/item_names/en.pbf");
const it = parseIdNameMap("reference/metin2alerts/item_names/it.pbf");
console.log("en entries:", en.size, "| it entries:", it.size);
console.log("sanity:", [1, 2, 10].map((id) => `${id}: en=${JSON.stringify(en.get(id))} it=${JSON.stringify(it.get(id))}`).join("  "));

// reverse EN name -> id (normalised) for matching
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byName = new Map();
for (const [id, name] of en) if (name) byName.set(norm(name), id);

const targets = {
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

console.log("\n=== Biologist items: EN match -> IT ===");
for (const [key, enName] of Object.entries(targets)) {
  const id = byName.get(norm(enName));
  if (id == null) {
    // fuzzy: any EN name containing the first distinctive word
    const kw = norm(enName).split(" ").slice(-1)[0];
    const cand = [...en].filter(([, n]) => norm(n).includes(kw)).slice(0, 4);
    console.log(`${key}  (EN ${JSON.stringify(enName)})  -> NO EXACT; candidates: ${cand.map(([i, n]) => `${i}:${JSON.stringify(n)}=>it:${JSON.stringify(it.get(i))}`).join(" | ") || "none"}`);
  } else {
    console.log(`${key}  ->  it: ${JSON.stringify(it.get(id))}   (en ${JSON.stringify(en.get(id))}, id ${id})`);
  }
}

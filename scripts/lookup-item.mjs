// Search the decoded item_names DB by English substring → print EN + IT. Usage:
//   node scripts/lookup-item.mjs "battle horse"
import fs from "node:fs";
function readVarint(b, p) { let s = 0, r = 0n; for (;;) { const x = b[p++]; r |= BigInt(x & 0x7f) << BigInt(s); if (!(x & 0x80)) break; s += 7; } return [Number(r), p]; }
function fields(b, st, en) { const o = []; let p = st; while (p < en) { let t; [t, p] = readVarint(b, p); const f = t >> 3, w = t & 7; if (w === 0) { let v; [v, p] = readVarint(b, p); o.push({ f, w, v }); } else if (w === 2) { let l; [l, p] = readVarint(b, p); o.push({ f, w, b: b.subarray(p, p + l) }); p += l; } else if (w === 5) p += 4; else if (w === 1) p += 8; else break; } return o; }
function parse(path) { const buf = fs.readFileSync(path); const m = new Map(); for (const e of fields(buf, 0, buf.length)) { if (e.f !== 1 || e.w !== 2) continue; const s = fields(e.b, 0, e.b.length); const id = s.find((x) => x.f === 1 && x.w === 0); const nm = s.find((x) => x.f === 2 && x.w === 2); if (!id || !nm) continue; const nf = fields(nm.b, 0, nm.b.length).find((x) => x.f === 1 && x.w === 2); m.set(id.v, nf ? Buffer.from(nf.b).toString("utf8") : ""); } return m; }
const en = parse("reference/metin2alerts/item_names/en.pbf");
const it = parse("reference/metin2alerts/item_names/it.pbf");
const q = (process.argv[2] || "").toLowerCase();
let n = 0;
for (const [id, name] of en) {
  if (name.toLowerCase().includes(q)) { console.log(`id ${id}  en=${JSON.stringify(name)}  it=${JSON.stringify(it.get(id))}`); if (++n >= 25) break; }
}
if (!n) console.log("no match for", JSON.stringify(q));

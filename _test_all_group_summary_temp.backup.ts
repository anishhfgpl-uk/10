
import fs from "node:fs";
import { parseTallyXML } from "./src/utils/tallyXmlParser";

function readXml(file: string) {
  const b = fs.readFileSync(file);
  return b[0] === 0xff && b[1] === 0xfe
    ? b.subarray(2).toString("utf16le")
    : b.toString("utf8").replace(/^\uFEFF/, "");
}

const daybook = readXml("DAYBOOK.xml");
const summary = readXml("GrpSum.xml");

const norm = (s: string) =>
  s.replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#38;/gi, "&")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const parseAmount = (s: string | undefined): number | null => {
  if (!s?.trim()) return null;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const records = summary.match(
  /<DSPACCNAME>[\s\S]*?<\/DSPACCNAME>\s*<DSPACCINFO>[\s\S]*?<\/DSPACCINFO>/gi
) || [];

const expected = new Map<string, {
  name: string;
  opening: number | null;
  closing: number | null;
}>();

for (const record of records) {
  const name = record.match(
    /<DSPDISPNAME>([\s\S]*?)<\/DSPDISPNAME>/i
  )?.[1]?.trim();

  if (!name) continue;

  const openingRaw = record.match(
    /<DSPOPAMTA>([\s\S]*?)<\/DSPOPAMTA>/i
  )?.[1];

  const closingRaw =
    record.match(/<DSPCLAMTA>([\s\S]*?)<\/DSPCLAMTA>/i)?.[1] ??
    record.match(/<DSPCLDRAMTA>([\s\S]*?)<\/DSPCLDRAMTA>/i)?.[1];

  const key = norm(name);
  expected.set(key, {
    name,
    opening: parseAmount(openingRaw),
    closing: parseAmount(closingRaw),
  });
}

const seed = [...expected.values()]
  .map(x =>
    `<LEDGER NAME="${escapeXml(x.name)}"><PARENT>SUNDRY DEBTORS</PARENT><LEDOPENINGBALANCE>0</LEDOPENINGBALANCE></LEDGER>`
  )
  .join("\n");

const result = parseTallyXML(seed + "\n" + daybook + "\n" + summary);

const actual = new Map(result.ledgers.map(l => [norm(l.name), l]));
const missing: string[] = [];
const mismatches: object[] = [];
let checked = 0;

for (const [key, e] of expected) {
  const l = actual.get(key);

  if (!l) {
    missing.push(e.name);
    continue;
  }

  checked++;

  // Parser stores Tally's signed balances using the opposite sign.
  const expectedOpening =
    e.opening === null ? null : -e.opening;
  const expectedClosing =
    e.closing === null ? null : -e.closing;

  const openingWrong =
    expectedOpening !== null &&
    Math.abs(l.openingBalance - expectedOpening) > 0.01;

  const closingWrong =
    expectedClosing !== null &&
    Math.abs(l.currentBalance - expectedClosing) > 0.01;

  if (openingWrong || closingWrong) {
    mismatches.push({
      ledger: e.name,
      expectedOpening,
      actualOpening: l.openingBalance,
      expectedClosing,
      actualCurrent: l.currentBalance,
    });
  }
}

console.log("\n--- ALL LEDGER SUMMARY CHECK ---");
console.log("Summary records:", expected.size);
console.log("Ledgers matched:", checked);
console.log("Missing ledgers:", missing.length);
console.log("Balance mismatches:", mismatches.length);

console.log("\n--- FIRST 30 MISMATCHES ---");
console.log(JSON.stringify(mismatches.slice(0, 30), null, 2));

console.log("\n--- FIRST 30 MISSING LEDGERS ---");
console.log(JSON.stringify(missing.slice(0, 30), null, 2));

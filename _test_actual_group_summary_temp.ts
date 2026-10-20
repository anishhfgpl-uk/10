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

console.log("Group Summary opening tags:", (summary.match(/<DSPOPAMTA>/gi) || []).length);
console.log("Group Summary closing tags:", (summary.match(/<DSPCLAMTA>|<DSPCLDRAMTA>/gi) || []).length);

const seed = [
  "A R Bath World",
  "SHILPA LUTHRA",
  "Akums Drugs &amp; Pharmaceuticals Ltd(Hrd)"
].map(name =>
  `<LEDGER NAME="${name}"><PARENT>SUNDRY DEBTORS</PARENT><LEDOPENINGBALANCE>0</LEDOPENINGBALANCE></LEDGER>`
).join("\n");

const result = parseTallyXML(seed + "\n" + daybook + "\n" + summary);

const targets = ["A R Bath World", "SHILPA LUTHRA", "Akums Drugs & Pharmaceuticals Ltd(Hrd)"];
const norm = (s: string) => s.replace(/&amp;/gi, "&").toLowerCase().replace(/[^a-z0-9]/g, "");

for (const name of targets) {
  const l = result.ledgers.find(x => norm(x.name) === norm(name));
  console.log(JSON.stringify(l ? {
    name: l.name,
    openingBalance: l.openingBalance,
    currentBalance: l.currentBalance,
    totalDebits: l.totalDebits,
    totalCredits: l.totalCredits
  } : { name, found: false }, null, 2));
}

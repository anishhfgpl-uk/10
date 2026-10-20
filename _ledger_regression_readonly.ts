import fs from "node:fs";
import { parseTallyXML } from "./src/utils/tallyXmlParser";

const bytes = fs.readFileSync("DAYBOOK.xml");
const daybook =
  bytes[0] === 0xff && bytes[1] === 0xfe
    ? bytes.subarray(2).toString("utf16le")
    : bytes.toString("utf8");

const targets = [
  { name: "A R Bath World", opening: 512582, debit: 754258, credit: 700000, closing: 566840 },
  { name: "SHILPA LUTHRA", opening: -12464, debit: 0, credit: 100000, closing: -112464 },
  { name: "Akums Drugs & Pharmaceuticals Ltd(Hrd)", opening: 390547.02, debit: 869899, credit: 1072031, closing: 188415.02 },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const seed = targets.map(t =>
  `<LEDGER NAME="${esc(t.name)}"><PARENT>SUNDRY DEBTORS</PARENT><LEDOPENINGBALANCE>0</LEDOPENINGBALANCE></LEDGER>`
).join("\n");

const result = parseTallyXML(seed + "\n" + daybook);
let failed = false;

for (const t of targets) {
  const l = result.ledgers.find(x =>
    x.name.trim().toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]/g, "") ===
    t.name.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]/g, "")
  );

  const actual = l && {
    ledger: l.name,
    openingBalance: l.openingBalance,
    currentBalance: l.currentBalance,
    totalDebits: l.totalDebits,
    totalCredits: l.totalCredits,
    parsedVoucherCount: result.vouchers.filter(v => v.ledgerId === l.id).length,
    expectedClosing: t.closing,
  };

  console.log(JSON.stringify(actual ?? { ledger: t.name, found: false }, null, 2));

  if (!l ||
      Math.abs(l.openingBalance - t.opening) > 0.01 ||
      Math.abs(l.currentBalance - t.closing) > 0.01 ||
      Math.abs(l.totalDebits - t.debit) > 0.01 ||
      Math.abs(l.totalCredits - t.credit) > 0.01) {
    failed = true;
  }
}

if (failed) {
  console.log("REGRESSION TEST FAILED — DO NOT SYNC OR DEPLOY");
  process.exitCode = 1;
} else {
  console.log("ALL THREE LEDGER REGRESSION TESTS PASSED");
}

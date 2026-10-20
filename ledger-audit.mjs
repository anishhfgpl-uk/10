import fs from "node:fs";

const db = JSON.parse(fs.readFileSync("data/tally-db.json", "utf8"));
const companyId = "comp_bharat_enterprises";
const company = db.companies.find(c => c.id === companyId);
if (!company) throw new Error("BHARAT ENTERPRISES company not found");

const ledgers = db.ledgers[companyId] || [];
const vouchers = db.vouchers[companyId] || [];
const groups = db.groups[companyId] || [];
const money = n => Number(n ?? 0);
const issues = [];
const report = [];

report.push("READ-ONLY LEDGER AUDIT");
report.push("Company: " + company.name);
report.push("Ledger count: " + ledgers.length);
report.push("Voucher count: " + vouchers.length);
report.push("Group count: " + groups.length);
report.push("");

let arithmeticErrors = 0;
let missingLedgerFields = 0;

for (const l of ledgers) {
  if (!l.id || !l.name) {
    missingLedgerFields++;
    issues.push(`MISSING LEDGER FIELD: ${l.name || l.id || "(unnamed)"}`);
  }

  const opening = money(l.openingBalance);
  const debits = money(l.totalDebits);
  const credits = money(l.totalCredits);
  const current = money(l.currentBalance);
  const expected = opening + debits - credits;

  if (![opening, debits, credits, current].every(Number.isFinite)) {
    arithmeticErrors++;
    issues.push(`INVALID NUMBER: ${l.name}`);
  } else if (Math.abs(expected - current) > 0.01) {
    arithmeticErrors++;
    issues.push(
      `BALANCE MISMATCH: ${l.name} | opening=${opening} | debits=${debits} | credits=${credits} | expected=${expected.toFixed(2)} | current=${current}`
    );
  }
}

const idCounts = new Map();
for (const v of vouchers) {
  const id = v.id;
  if (!id) {
    issues.push(`MISSING VOUCHER ID: ${v.voucherNo || "(unnumbered)"}`);
    continue;
  }
  idCounts.set(id, (idCounts.get(id) || 0) + 1);
}
const duplicateIds = [...idCounts].filter(([, count]) => count > 1);
for (const [id, count] of duplicateIds) {
  issues.push(`DUPLICATE VOUCHER ID: ${id} | count=${count}`);
}

report.push("BALANCE ARITHMETIC: " +
  (arithmeticErrors === 0 ? "PASS" : "MISMATCH FOUND"));
report.push("Arithmetic mismatches: " + arithmeticErrors);
report.push("Ledgers missing ID/name: " + missingLedgerFields);
report.push("Duplicate voucher IDs: " + duplicateIds.length);
report.push("Vouchers missing ID: " +
  vouchers.filter(v => !v.id).length);
report.push("");

const xmlPath = "DAYBOOK.xml";
if (fs.existsSync(xmlPath)) {
  const xml = fs.readFileSync(xmlPath, "utf8");
  const openingRows =
    [...xml.matchAll(/<DSPVCHLEDACCOUNT>\s*Opening Balance\s*<\/DSPVCHLEDACCOUNT>/gi)].length;

  let nameFound = 0;
  let nameNotFound = 0;
  const unverified = [];

  for (const l of ledgers) {
    const name = String(l.name || "");
    const variants = [
      name,
      name.replace(/&amp;/gi, "&"),
      name.replace(/&/g, "&amp;")
    ];
    if (variants.some(n => n && xml.includes(n))) {
      nameFound++;
    } else {
      nameNotFound++;
      unverified.push(name);
    }
  }

  report.push("DAYBOOK.xml: FOUND");
  report.push("Opening Balance report rows: " + openingRows);
  report.push("Ledger names found in XML: " + nameFound);
  report.push("Ledger names not found: " + nameNotFound);
  report.push("IMPORTANT: Name presence does not prove opening amount.");
  report.push("XML amount-by-amount opening balance comparison: NOT PERFORMED");
  if (unverified.length) {
    report.push("");
    report.push("LEDGER NAMES NOT FOUND IN DAYBOOK.xml (UNVERIFIED):");
    for (const name of unverified) report.push("  " + name);
  }
} else {
  report.push("DAYBOOK.xml: NOT FOUND; XML verification unavailable");
}

report.push("");
report.push("DETAILS");
report.push(issues.length ? issues.join("\n") : "No arithmetic, missing-ID/name, or duplicate-ID issues found.");
report.push("");
report.push("READ ONLY: database and XML were not modified.");

const output = report.join("\n");
console.log(output);
fs.writeFileSync("ledger-audit-report.txt", output, "utf8");
console.log("\nReport saved: D:\\LEDGER\\ledger-audit-report.txt");

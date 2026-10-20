import { parseTallyXML } from "./src/utils/tallyXmlParser";

const xml = `<ENVELOPE>
<SVCURRENTCOMPANY>BHARAT ENTERPRISES</SVCURRENTCOMPANY>
<LEDGER NAME="Test Debtor" RESERVEDNAME="">
<PARENT TYPE="String">SUNDRY DEBTORS</PARENT>
<LEDOPENINGBALANCE TYPE="Amount">-10000.00</LEDOPENINGBALANCE>
<CLOSINGBALANCE TYPE="Amount">-24544.00</CLOSINGBALANCE>
</LEDGER>
<LEDGER NAME="Test Credit Balance" RESERVEDNAME="">
<PARENT TYPE="String">SUNDRY DEBTORS</PARENT>
<LEDOPENINGBALANCE TYPE="Amount">300000.00</LEDOPENINGBALANCE>
<CLOSINGBALANCE TYPE="Amount">300000.00</CLOSINGBALANCE>
</LEDGER>
</ENVELOPE>`;

const result = parseTallyXML(xml);
console.log(JSON.stringify({
  company: result.companyName,
  ledgers: result.ledgers.map(x => ({
    name: x.name,
    opening: x.openingBalance,
    current: x.currentBalance
  }))
}, null, 2));

const debtor = result.ledgers.find(x => x.name === "Test Debtor");
const credit = result.ledgers.find(x => x.name === "Test Credit Balance");

if (
  debtor?.openingBalance !== 10000 ||
  debtor?.currentBalance !== 24544 ||
  credit?.openingBalance !== -300000 ||
  credit?.currentBalance !== -300000
) {
  throw new Error("BALANCE SIGN TEST FAILED");
}

console.log("BALANCE SIGN TEST PASSED");
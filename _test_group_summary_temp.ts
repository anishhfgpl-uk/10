import { parseTallyXML } from "./src/utils/tallyXmlParser";

const xml = `
<LEDGER NAME="Akums Drugs &amp; Pharmaceuticals Ltd(Hrd)">
  <PARENT>SUNDRY DEBTORS</PARENT>
  <LEDOPENINGBALANCE>0</LEDOPENINGBALANCE>
</LEDGER>
<DSPACCNAME>
  <DSPDISPNAME>Akums Drugs &amp; Pharmaceuticals Ltd(Hrd)</DSPDISPNAME>
</DSPACCNAME>
<DSPACCINFO>
  <DSPOPAMT><DSPOPAMTA>-390547.02</DSPOPAMTA></DSPOPAMT>
  <DSPDRAMT><DSPDRAMTA>-869899.00</DSPDRAMTA></DSPDRAMT>
  <DSPCRAMT><DSPCRAMTA>1072031.00</DSPCRAMTA></DSPCRAMT>
  <DSPCLAMT><DSPCLAMTA>-188415.02</DSPCLAMTA></DSPCLAMT>
</DSPACCINFO>`;

const result = parseTallyXML(xml);
console.log(JSON.stringify(
  result.ledgers.map(l => ({
    name: l.name,
    openingBalance: l.openingBalance,
    currentBalance: l.currentBalance
  })),
  null, 2
));

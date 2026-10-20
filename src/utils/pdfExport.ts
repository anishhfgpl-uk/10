import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Company, DebtorLedger, AgeingSummary, LedgerStatementRow } from '../types/tally';
import { formatIndianCurrency, formatDate } from './tallyCalculator';

export function exportLedgerPdf({
  company,
  ledger,
  statement,
  ageing,
  startDate,
  endDate,
}: {
  company: Company;
  ledger: DebtorLedger;
  statement: {
    openingBalance: number;
    openingType: 'Dr' | 'Cr';
    rows: LedgerStatementRow[];
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingType: 'Dr' | 'Cr';
  };
  ageing: AgeingSummary;
  startDate?: string;
  endDate?: string;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo 600
  const grayColor: [number, number, number] = [100, 116, 139]; // Slate 500

  // 1. Company Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name.toUpperCase(), 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`${company.address} | GSTIN: ${company.gstin}`, 14, 18);
  doc.text(`Phone: ${company.phone} | Email: ${company.email}`, 14, 23);

  // Document Title Banner
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 28, 210, 10, 'F');
  doc.setTextColor(...accentColor);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STATEMENT OF ACCOUNT & AGEING ANALYSIS (DEBTORS REPORT)', 14, 34.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  const periodText = `Period: ${startDate ? formatDate(startDate) : 'Beginning'} to ${endDate ? formatDate(endDate) : 'Till Date'}`;
  doc.text(periodText, 210 - 14 - doc.getTextWidth(periodText), 34.5);

  // 2. Debtor & Account Summary Card
  let curY = 44;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, curY, 182, 30, 2, 2, 'FD');

  // Left Debtor info
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(ledger.name, 18, curY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Address: ${ledger.address || ledger.city || 'As per Tally records'}`, 18, curY + 11);
  doc.text(`GSTIN: ${ledger.gstin || 'Unregistered'} | PAN: ${ledger.pan || 'N/A'}`, 18, curY + 16);
  doc.text(`Contact: ${ledger.phone || 'N/A'} | Email: ${ledger.email || 'N/A'}`, 18, curY + 21);
  doc.text(`Group: ${ledger.groupName}`, 18, curY + 26);

  // Right Financial stats
  const rightX = 135;
  doc.setFont('helvetica', 'bold');
  doc.text('Credit Limit:', rightX, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(formatIndianCurrency(ledger.creditLimit), rightX + 22, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Credit Terms:', rightX, curY + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${ledger.creditPeriodDays} Days`, rightX + 22, curY + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('Closing Bal:', rightX, curY + 18);
  doc.setFontSize(9.5);
  doc.setTextColor(225, 29, 72); // Rose red
  doc.text(`${formatIndianCurrency(statement.closingBalance)} ${statement.closingType}`, rightX + 22, curY + 18);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('Overdue Amt:', rightX, curY + 25);
  doc.setTextColor(194, 65, 12); // Orange
  doc.text(`${formatIndianCurrency(ageing.totalOverdue)}`, rightX + 22, curY + 25);

  curY += 34;

  // 3. Ageing Summary Buckets Box
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('BILL AGEING BREAKDOWN (DAYS OVERDUE)', 14, curY);

  curY += 3;
  const bucketWidth = 36.4;
  const buckets = [
    { label: '0 - 30 Days', amt: ageing.bucket0_30, bg: [240, 253, 244], border: [187, 247, 208], text: [22, 101, 52] },
    { label: '31 - 60 Days', amt: ageing.bucket31_60, bg: [254, 252, 232], border: [254, 240, 138], text: [133, 77, 14] },
    { label: '61 - 90 Days', amt: ageing.bucket61_90, bg: [255, 247, 237], border: [254, 215, 170], text: [154, 52, 18] },
    { label: '91 - 120 Days', amt: ageing.bucket91_120, bg: [255, 241, 242], border: [254, 205, 211], text: [159, 18, 57] },
    { label: '> 120 Days', amt: ageing.bucket120Plus, bg: [243, 244, 246], border: [209, 213, 219], text: [17, 24, 39] },
  ];

  buckets.forEach((b, idx) => {
    const x = 14 + idx * bucketWidth;
    doc.setFillColor(b.bg[0], b.bg[1], b.bg[2]);
    doc.setDrawColor(b.border[0], b.border[1], b.border[2]);
    doc.roundedRect(x, curY, bucketWidth - 1, 14, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(b.label, x + 2.5, curY + 4.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(b.text[0], b.text[1], b.text[2]);
    doc.text(formatIndianCurrency(b.amt), x + 2.5, curY + 10.5);
  });

  curY += 18;

  // 4. Date-wise Voucher Transactions Table
  const tableRows = [];

  // Opening Balance Row
  tableRows.push([
    startDate ? formatDate(startDate) : '-',
    'Opening',
    '-',
    'Opening Balance B/F',
    statement.openingType === 'Dr' ? formatIndianCurrency(statement.openingBalance) : '-',
    statement.openingType === 'Cr' ? formatIndianCurrency(statement.openingBalance) : '-',
    `${formatIndianCurrency(statement.openingBalance)} ${statement.openingType}`,
  ]);

  statement.rows.forEach((r) => {
    tableRows.push([
      formatDate(r.date),
      r.voucherType,
      r.voucherNo,
      r.particulars,
      r.debit > 0 ? formatIndianCurrency(r.debit) : '-',
      r.credit > 0 ? formatIndianCurrency(r.credit) : '-',
      `${formatIndianCurrency(r.balance)} ${r.balanceType}`,
    ]);
  });

  // Closing Balance Row
  tableRows.push([
    endDate ? formatDate(endDate) : 'Today',
    'Closing',
    '-',
    'Closing Balance C/F',
    formatIndianCurrency(statement.totalDebit),
    formatIndianCurrency(statement.totalCredit),
    `${formatIndianCurrency(statement.closingBalance)} ${statement.closingType}`,
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Date', 'Vch Type', 'Voucher #', 'Particulars & Narration', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 50 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Highlight opening and closing rows
      if (data.row.index === 0 || data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  // 5. Bill-by-Bill Ageing Detail Table if available
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 160;

  if (ageing.bills.length > 0 && finalY < 235) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('OUTSTANDING BILLS & INVOICE-WISE AGEING', 14, finalY);

    const billRows = ageing.bills.map((b) => [
      formatDate(b.billDate),
      b.billNo,
      formatDate(b.dueDate),
      formatIndianCurrency(b.originalAmount),
      formatIndianCurrency(b.pendingAmount),
      `${b.daysPastDue} Days`,
      b.bucket + ' Days',
      b.status,
    ]);

    autoTable(doc, {
      startY: finalY + 3,
      head: [['Bill Date', 'Bill / Inv #', 'Due Date', 'Bill Amount', 'Pending Amount', 'Overdue Days', 'Bucket', 'Risk Status']],
      body: billRows,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.8,
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold', textColor: [194, 65, 12] },
        5: { halign: 'center' },
        6: { halign: 'center' },
      },
    });
  }

  // 6. Signatory and Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureY = pageHeight - 25;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Note: This is a computer-generated statement directly synced from Tally Accounting.', 14, signatureY);
  doc.text(`Generated on: ${new Date().toLocaleString()} | Cloud ID: ${company.id}`, 14, signatureY + 4);

  // Authorised Signatory box on right
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const signText = `For ${company.name}`;
  doc.text(signText, 196 - doc.getTextWidth(signText), signatureY - 4);
  const authText = 'Authorised Signatory / Accounts Dept';
  doc.setFont('helvetica', 'normal');
  doc.text(authText, 196 - doc.getTextWidth(authText), signatureY + 6);

  // Download the PDF
  const filename = `${ledger.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement_Ageing.pdf`;
  doc.save(filename);
}

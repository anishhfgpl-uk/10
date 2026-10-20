import { DebtorLedger, DebtorGroup, TallyVoucher, BillAllocation, VoucherType } from '../types/tally';

/**
 * Format Tally date '20240412' or '12-Apr-24' or ISO to 'YYYY-MM-DD'
 */
export function parseTallyDate(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const cleaned = rawDate.trim();
  
  // Format YYYYMMDD (e.g. 20240412)
  if (/^\d{8}$/.test(cleaned)) {
    const y = cleaned.substring(0, 4);
    const m = cleaned.substring(4, 6);
    const d = cleaned.substring(6, 8);
    return `${y}-${m}-${d}`;
  }

  // Format DD-MMM-YY or DD-MMM-YYYY
  const parts = cleaned.split(/[-/ ]/);
  if (parts.length === 3) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const day = parts[0].padStart(2, '0');
    const monthKey = parts[1].substring(0, 3).toLowerCase();
    const month = months[monthKey] || '01';
    let year = parts[2];
    if (year.length === 2) {
      year = (parseInt(year, 10) > 50 ? '19' : '20') + year;
    }
    return `${year}-${month}-${day}`;
  }

  // Default ISO fallback
  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }

  return cleaned;
}

/**
 * Parse Tally XML string into Ledger, Groups and Vouchers
 */
export function parseTallyXML(xmlContent: string): {
  companyName?: string;
  groups: DebtorGroup[];
  ledgers: DebtorLedger[];
  vouchers: TallyVoucher[];
} {
  const groupsMap = new Map<string, DebtorGroup>();
  const ledgersMap = new Map<string, DebtorLedger>();
  // Tally uses negative amounts for debtor debit balances.
  const closingBalances = new Map<string, number>();
  const vouchers: TallyVoucher[] = [];

  // Default Debtor Group
  const defaultGroup: DebtorGroup = {
    id: 'grp_sundry_debtors',
    name: 'Sundry Debtors',
    ledgerCount: 0,
    totalBalance: 0,
    overdueBalance: 0,
  };
  groupsMap.set(defaultGroup.id, defaultGroup);

  // Extract company name if available
  let companyName = 'Imported Tally Company';
  const compMatch = xmlContent.match(/<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i) ||
                    xmlContent.match(/<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i) ||
                    xmlContent.match(/<COMPANY[^>]*NAME="([^"]+)"/i);
  if (compMatch && compMatch[1]) {
    companyName = compMatch[1].trim();
  }

  // 1. Parse Groups if present
  const groupMatches = xmlContent.match(/<GROUP[\s\S]*?<\/GROUP>/gi) || [];
  for (const gXml of groupMatches) {
    const nameMatch = gXml.match(/NAME="([^"]+)"/i) || gXml.match(/<NAME>([^<]+)<\/NAME>/i);
    const parentMatch = gXml.match(/<PARENT\b[^>]*>([^<]+)<\/PARENT>/i);
    if (nameMatch) {
      const gName = nameMatch[1].trim();
      const parentName = parentMatch ? parentMatch[1].trim() : 'Sundry Debtors';
      // Only include debtor related groups
      if (gName.toLowerCase().includes('debtor') || (parentMatch && parentName.toLowerCase().includes('debtor'))) {
        const id = 'grp_' + gName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        groupsMap.set(id, {
          id,
          name: gName,
          parentName,
          ledgerCount: 0,
          totalBalance: 0,
          overdueBalance: 0,
        });
      }
    }
  }

  // 2. Parse Ledgers
  const ledgerMatches = xmlContent.match(/<LEDGER[\s\S]*?<\/LEDGER>/gi) || [];
  for (const lXml of ledgerMatches) {
    const nameMatch = lXml.match(/NAME="([^"]+)"/i) || lXml.match(/<NAME>([^<]+)<\/NAME>/i);
    const parentMatch = lXml.match(/<PARENT\b[^>]*>([^<]+)<\/PARENT>/i);
    const parent = parentMatch ? parentMatch[1].trim() : 'Sundry Debtors';

    // Include debtor/customer groups, exclude creditor groups
    const parentLower = parent.toLowerCase();
    const isDebtor = !parentLower.includes('creditor') && (
      parentLower.includes('debtor') ||
      parentLower.includes('customer') ||
      parentLower.includes('client') ||
      parentLower.includes('receivable') ||
      parentLower.trim() === 'aluk sale'
    );

    if (nameMatch && isDebtor) {
      const lName = nameMatch[1].trim();
      const id = 'led_' + lName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const gstinMatch = lXml.match(/<PARTYGSTIN>([^<]+)<\/PARTYGSTIN>/i);
      const panMatch = lXml.match(/<INCOMETAXNUMBER>([^<]+)<\/INCOMETAXNUMBER>/i);
      const stateMatch = lXml.match(/<LEDSTATENAME>([^<]+)<\/LEDSTATENAME>/i);
      const phoneMatch = lXml.match(/<LEDGERPHONE>([^<]+)<\/LEDGERPHONE>/i) || lXml.match(/<LEDGERMOBILE>([^<]+)<\/LEDGERMOBILE>/i);
      const emailMatch = lXml.match(/<EMAIL>([^<]+)<\/EMAIL>/i);
      const opBalMatch = lXml.match(/<LEDOPENINGBALANCE\b[^>]*>([^<]+)<\/LEDOPENINGBALANCE>/i) || lXml.match(/<OPENINGBALANCE\b[^>]*>([^<]+)<\/OPENINGBALANCE>/i);
      const creditPeriodMatch = lXml.match(/<BILLCREDITPERIOD>([^<]+)<\/BILLCREDITPERIOD>/i);

      let openingBal = 0;
      if (opBalMatch) {
        const val = parseFloat(opBalMatch[1]);
        if (Number.isFinite(val)) openingBal = -val;
      }

      const closingBalMatch = lXml.match(/<CLOSINGBALANCE\b[^>]*>([^<]+)<\/CLOSINGBALANCE>/i);
      if (closingBalMatch) {
        const tallyClosing = parseFloat(closingBalMatch[1]);
        if (Number.isFinite(tallyClosing)) closingBalances.set(id, tallyClosing);
      }

      let creditPeriodDays = 30;
      if (creditPeriodMatch) {
        const parsedDays = parseInt(creditPeriodMatch[1], 10);
        if (!isNaN(parsedDays)) creditPeriodDays = parsedDays;
      }

      const groupId = 'grp_' + parent.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          id: groupId,
          name: parent,
          ledgerCount: 0,
          totalBalance: 0,
          overdueBalance: 0,
        });
      }

      ledgersMap.set(id, {
        id,
        name: lName,
        groupId,
        groupName: parent,
        gstin: gstinMatch ? gstinMatch[1].trim() : undefined,
        pan: panMatch ? panMatch[1].trim() : undefined,
        state: stateMatch ? stateMatch[1].trim() : undefined,
        phone: phoneMatch ? phoneMatch[1].trim() : undefined,
        email: emailMatch ? emailMatch[1].trim() : undefined,
        creditLimit: 500000,
        creditPeriodDays,
        openingBalance: openingBal,
        currentBalance: openingBal,
        overdueAmount: 0,
        totalDebits: 0,
        totalCredits: 0,
        activeBillsCount: 0,
      });
    }
  }

  // Read opening and closing balances from Tally Group Summary (DSP format).
  const summaryMatches =
    xmlContent.match(
      /<DSPACCNAME>[\s\S]*?<\/DSPACCNAME>\s*<DSPACCINFO>[\s\S]*?<\/DSPACCINFO>/gi
    ) || [];

  const normalizeSummaryName = (value: string) =>
    value
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) =>
        String.fromCodePoint(Number(n))
      )
      .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
        String.fromCodePoint(parseInt(n, 16))
      )
      .replace(/[\r\n\t]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const parseSummaryAmount = (value: string): number | null => {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : null;
  };

  for (const entry of summaryMatches) {
    const nameMatch = entry.match(
      /<DSPDISPNAME>([\s\S]*?)<\/DSPDISPNAME>/i
    );
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const normalizedName = normalizeSummaryName(name);

    const ledger =
      ledgersMap.get(
        'led_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_')
      ) ||
      Array.from(ledgersMap.values()).find(
        item => normalizeSummaryName(item.name) === normalizedName
      );

    if (!ledger) continue;

    const openingMatch = entry.match(
      /<DSPOPAMTA>([\s\S]*?)<\/DSPOPAMTA>/i
    );
    const closingMatch = entry.match(
      /<DSPCLAMTA>([\s\S]*?)<\/DSPCLAMTA>/i
    );

    if (openingMatch) {
      const tallyOpening = parseSummaryAmount(openingMatch[1]);
      if (tallyOpening !== null) {
        const nextOpening = -tallyOpening;
        const previousOpening = ledger.openingBalance || 0;
        ledger.openingBalance = nextOpening;
        ledger.currentBalance += nextOpening - previousOpening;
      }
    }

    if (closingMatch) {
      const tallyClosing = parseSummaryAmount(closingMatch[1]);
      if (tallyClosing !== null) {
        closingBalances.set(ledger.id, -tallyClosing);
      }
    }
  }

  // 3. Parse Vouchers
  const voucherMatches = xmlContent.match(/<VOUCHER\b[^>]*>[\s\S]*?<\/VOUCHER>/gi) || [];
  let voucherIdx = 1;

  for (const vXml of voucherMatches) {
    const vTypeMatch = vXml.match(/VCHTYPE="([^"]+)"/i) || vXml.match(/<VOUCHERTYPENAME>([^<]+)<\/VOUCHERTYPENAME>/i);
    const vNoMatch = vXml.match(/<VOUCHERNUMBER\b[^>]*>([\s\S]*?)<\/VOUCHERNUMBER>/i) || vXml.match(/\bVOUCHERNUMBER="([^"]+)"/i);
    const dateMatch = vXml.match(/<DATE>([^<]+)<\/DATE>/i);
    const narrationMatch = vXml.match(/<NARRATION>([^<]+)<\/NARRATION>/i);
    const refMatch = vXml.match(/<REFERENCE>([^<]+)<\/REFERENCE>/i);

    const rawType = vTypeMatch ? (vTypeMatch[1] || vTypeMatch[2] || '').trim() : '';
    const rawTypeLower = rawType.toLowerCase();
    let voucherType: VoucherType;

    if (rawTypeLower.includes('credit note')) voucherType = 'Credit Note';
    else if (rawTypeLower.includes('debit note')) voucherType = 'Debit Note';
    else if (rawTypeLower.includes('receipt')) voucherType = 'Receipt';
    else if (rawTypeLower.includes('journal')) voucherType = 'Journal';
    else if (rawTypeLower.includes('payment')) voucherType = 'Payment';
    else if (rawTypeLower.includes('sales')) voucherType = 'Sales';
    else if (rawTypeLower.includes('contra')) voucherType = 'Contra';
    else if (rawTypeLower.includes('purchase')) voucherType = 'Purchase';
    else continue;

    const actualVoucherNo = vNoMatch ? vNoMatch[1].trim() : "";
const masterIdMatch = vXml.match(/<MASTERID>([^<]+)<\/MASTERID>/i);
const guidMatch = vXml.match(/<GUID>([^<]+)<\/GUID>/i);
const masterId = masterIdMatch ? masterIdMatch[1].trim() : "";
const guid = guidMatch ? guidMatch[1].trim() : "";

if (!actualVoucherNo && !masterId && !guid) continue;
const voucherNo = actualVoucherNo || "(Unnumbered)";
    const rawDate = dateMatch ? dateMatch[1].trim() : '';
    if (!rawDate) continue;
    const vDate = parseTallyDate(rawDate);
    const narration = narrationMatch ? narrationMatch[1].trim() : undefined;
    const referenceNo = refMatch ? refMatch[1].trim() : undefined;

    // Parse ledger entries within voucher
    const entryMatches = [
      ...(vXml.match(/<ALLLEDGERENTRIES\.LIST[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/gi) || []),
      ...(vXml.match(/<LEDGERENTRIES\.LIST[\s\S]*?<\/LEDGERENTRIES\.LIST>/gi) || [])
    ];

    for (const eXml of entryMatches) {
      const lNameMatch = eXml.match(/<LEDGERNAME>([^<]+)<\/LEDGERNAME>/i);
      const amountMatch = eXml.match(/<AMOUNT>([^<]+)<\/AMOUNT>/i);
      const isPositiveMatch = eXml.match(/<ISDEEMEDPOSITIVE>([^<]+)<\/ISDEEMEDPOSITIVE>/i);

      if (lNameMatch && amountMatch) {
        const lName = lNameMatch[1].trim();
        const lId = 'led_' + lName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        const ledger = ledgersMap.get(lId);

        // Never create debtor ledgers from tax, sales, bank or other entries.
        if (!ledger) continue;

        const rawAmount = parseFloat(amountMatch[1]);
        if (!Number.isFinite(rawAmount)) continue;

        // Tally customer-ledger convention: negative amount = debit,
        // positive amount = credit. Preserve the actual sign.
        let debit = 0;
        let credit = 0;

        if (rawAmount < 0) {
          debit = Math.abs(rawAmount);
          ledger.totalDebits += debit;
          ledger.currentBalance += debit;
        } else if (rawAmount > 0) {
          credit = rawAmount;
          ledger.totalCredits += credit;
          ledger.currentBalance -= credit;
        }

        // Parse Bill Allocations if available
        const billAllocations: BillAllocation[] = [];
        const billMatches = eXml.match(/<BILLALLOCATIONS.LIST[\s\S]*?<\/BILLALLOCATIONS.LIST>/gi) || [];
        for (const bXml of billMatches) {
          const bNameMatch = bXml.match(/<NAME>([^<]+)<\/NAME>/i);
          const bTypeMatch = bXml.match(/<BILLTYPE>([^<]+)<\/BILLTYPE>/i);
          const bAmtMatch = bXml.match(/<AMOUNT>([^<]+)<\/AMOUNT>/i);
          const billAmount = bAmtMatch ? Number.parseFloat(bAmtMatch[1]) : NaN;
          if (bNameMatch && bAmtMatch && Number.isFinite(billAmount)) {
            billAllocations.push({
              billNo: bNameMatch[1].trim(),
              billDate: vDate,
              dueDate: vDate, // TODO: derive from actual credit period
              billType: (bTypeMatch ? bTypeMatch[1].trim() : 'New Ref') as any,
              amount: billAmount,
            });
          }
        }

        vouchers.push({
          id: 'vch_' + (guid ? 'guid_' + guid + '_' + lId : masterId ? 'master_' + masterId + '_' + lId : [vDate, voucherType, voucherNo, lId, voucherIdx++].join('_')),
          voucherType,
          voucherNo,
          date: vDate,
          particulars: `${voucherType} Voucher against ${lName}`,
          debit,
          credit,
          narration,
          referenceNo,
          billAllocations: billAllocations.length > 0 ? billAllocations : undefined,
          ledgerId: lId,
          ledgerName: lName,
        });
      }
    }
  }

  // Parse Receipt report rows from Tally Voucher Register XML.
  {
    const tagRegex = /<(LVACCTITLE|DSPVCHDATE|DSPVCHLEDACCOUNT|DSPVCHTYPE|DSPVCHDRAMT|DSPVCHCRAMT|DSPEXPLVCHNUMBER)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let partyName = '';
    let pendingNo = '';
    let row: { date: string; type: string; dr: string; cr: string; no: string; account: string } | null = null;
    let rowIndex = 0;

    const decode = (s: string) => s.trim()
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'");

    const flush = () => {
      if (!row) return;
      const r = row;
      row = null;

      if (!partyName) return;

      const isOpeningBalance = /^opening\s+balance$/i.test(r.account.trim());
      if (!isOpeningBalance && !r.date) return;
      if (!isOpeningBalance && !r.type.trim()) return;

      const ledgerName = partyName.trim();
      const normalizeLedgerName = (name: string) =>
        name.trim().toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]/g, '');
      const requestedLedgerId = 'led_' + ledgerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const ledger =
        ledgersMap.get(requestedLedgerId) ||
        Array.from(ledgersMap.values()).find(
          candidate => normalizeLedgerName(candidate.name) === normalizeLedgerName(ledgerName)
        );
      if (!ledger) return;
      const ledgerId = ledger.id;

      const amountText = (r.dr.trim() !== '' ? r.dr : r.cr).replace(/,/g, '').trim();
      const amount = Number.parseFloat(amountText);
      if (!Number.isFinite(amount) || amount === 0) return;

      if (isOpeningBalance) {
        // Flat Tally report convention: opening balance is the negative
        // of the signed amount shown in the DR/CR amount columns.
        const nextOpeningBalance = -amount;
        const previousOpeningBalance = ledger.openingBalance || 0;
        ledger.openingBalance = nextOpeningBalance;
        ledger.currentBalance += nextOpeningBalance - previousOpeningBalance;
        return;
      }

      const date = parseTallyDate(r.date);
      if (!date) return;

      rowIndex++;
      const voucherNo = r.no || '(Unnumbered)';
      const identity = [date, voucherNo, ledgerId, r.type, r.account, amount, rowIndex]
        .join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
      const id = 'vch_report_' + identity;

      if (vouchers.some(v => v.id === id)) return;

      const debit = amount < 0 ? Math.abs(amount) : 0;
      const credit = amount > 0 ? amount : 0;
      ledger.totalDebits += debit;
      ledger.totalCredits += credit;
      ledger.currentBalance += debit - credit;

      const voucherTypeMap: Record<string, string> = {
        rcpt: 'Receipt', receipt: 'Receipt',
        pymt: 'Payment', payment: 'Payment',
        sales: 'Sales', sale: 'Sales',
        purc: 'Purchase', purchase: 'Purchase',
        jrnl: 'Journal', journal: 'Journal',
        ctra: 'Contra', contra: 'Contra',
        credit: 'Credit Note', debit: 'Debit Note',
      };
      const voucherType = (voucherTypeMap[r.type.trim().toLowerCase()] || r.type.trim()) as (typeof vouchers)[number]['voucherType'];
      vouchers.push({
        id, voucherType, voucherNo, date,
        particulars: `${voucherType} Voucher against ${ledgerName}`,
        debit, credit, ledgerId, ledgerName,
      });
    };

    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(xmlContent)) !== null) {
      const tag = match[1].toUpperCase();
      const value = decode(match[2]);

      if (tag === 'LVACCTITLE') {
        flush();
        partyName = value;
      } else if (tag === 'DSPEXPLVCHNUMBER') {
        const no = value.replace(/^\(No\.\s*:\s*/i, '').replace(/\)\s*$/, '').trim();
        if (row) row.no = no;
        else pendingNo = no;
      } else if (tag === 'DSPVCHDATE') {
        flush();
        row = { date: value, type: '', dr: '', cr: '', no: pendingNo, account: '' };
        pendingNo = '';
      } else if (row) {
        if (tag === 'DSPVCHLEDACCOUNT') row.account = value;
        else if (tag === 'DSPVCHTYPE') row.type = value;
        else if (tag === 'DSPVCHDRAMT') row.dr = value;
        else if (tag === 'DSPVCHCRAMT') row.cr = value;
      }
    }
    flush();
  }

  // Calculate Group Ledger counts and balances
  closingBalances.forEach((tallyClosing, ledgerId) => {
    const ledger = ledgersMap.get(ledgerId);
    if (ledger) ledger.currentBalance = -tallyClosing;
  });

  ledgersMap.forEach((led) => {
    const grp = groupsMap.get(led.groupId);
    if (grp) {
      grp.ledgerCount += 1;
      grp.totalBalance += led.currentBalance;
      grp.overdueBalance += led.overdueAmount;
    }
    const allGrp = groupsMap.get('grp_all') || groupsMap.get('grp_sundry_debtors');
    if (allGrp && allGrp.id !== led.groupId) {
      allGrp.ledgerCount += 1;
      allGrp.totalBalance += led.currentBalance;
      allGrp.overdueBalance += led.overdueAmount;
    }
  });

  return {
    companyName,
    groups: Array.from(groupsMap.values()),
    ledgers: Array.from(ledgersMap.values()),
    vouchers,
  };
}















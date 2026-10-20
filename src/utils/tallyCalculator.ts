import { DebtorLedger, TallyVoucher, AgeingSummary, AgeingItem, LedgerStatementRow } from '../types/tally';

export function formatIndianCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return 'â‚¹0.00';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [integerPart, decimalPart] = fixed.split('.');

  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  return `${isNegative ? '-' : ''}â‚¹${formattedInteger}.${decimalPart}`;
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Calculates date-filtered voucher statement with running balance
 */
export function computeLedgerStatement(
  ledger: DebtorLedger,
  allVouchers: TallyVoucher[],
  startDate?: string,
  endDate?: string
): {
  openingBalance: number;
  openingType: 'Dr' | 'Cr';
  rows: LedgerStatementRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingType: 'Dr' | 'Cr';
} {
  // Sort vouchers chronologically
  const sorted = [...allVouchers].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate opening balance before startDate
  let running = ledger.openingBalance || 0; // Dr is positive, Cr is negative

  const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
  const endTimestamp = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

  // Tally before startDate
  for (const v of sorted) {
    const vTime = new Date(v.date).getTime();
    if (vTime < startTimestamp) {
      running += (v.debit || 0) - (v.credit || 0);
    }
  }

  const openingBalanceVal = running;
  const openingType: 'Dr' | 'Cr' = openingBalanceVal >= 0 ? 'Dr' : 'Cr';

  const rows: LedgerStatementRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const v of sorted) {
    const vTime = new Date(v.date).getTime();
    if (vTime >= startTimestamp && vTime <= endTimestamp) {
      const debit = v.debit || 0;
      const credit = v.credit || 0;
      running += debit - credit;
      totalDebit += debit;
      totalCredit += credit;

      rows.push({
        date: v.date,
        voucherType: v.voucherType,
        voucherNo: v.voucherNo,
        particulars: v.particulars + (v.narration ? ` - ${v.narration}` : ''),
        debit,
        credit,
        balance: Math.abs(running),
        balanceType: running >= 0 ? 'Dr' : 'Cr',
      });
    }
  }

  const closingBalance = Math.abs(running);
  const closingType: 'Dr' | 'Cr' = running >= 0 ? 'Dr' : 'Cr';

  return {
    openingBalance: Math.abs(openingBalanceVal),
    openingType,
    rows,
    totalDebit,
    totalCredit,
    closingBalance,
    closingType,
  };
}

/**
 * Computes Bill-by-Bill Ageing Analysis
 * Default reference cutoff date is current date or specified date
 */
export function computeAgeingAnalysis(
  ledger: DebtorLedger,
  vouchers: TallyVoucher[],
  asOfDate: string = new Date().toISOString().slice(0, 10)
): AgeingSummary {
  const asOf = new Date(asOfDate).getTime();
  const billsMap = new Map<string, {
    billNo: string;
    billDate: string;
    dueDate: string;
    debit: number;
    credit: number;
  }>();

  // Gather bill allocations or fallback to Sales invoices
  for (const v of vouchers) {
    if (v.billAllocations && v.billAllocations.length > 0) {
      for (const alloc of v.billAllocations) {
        const key = alloc.billNo;
        const existing = billsMap.get(key) || {
          billNo: alloc.billNo,
          billDate: alloc.billDate || v.date,
          dueDate: alloc.dueDate || v.date,
          debit: 0,
          credit: 0,
        };

        if (alloc.amount < 0) {
          existing.debit += Math.abs(alloc.amount);
        } else if (alloc.amount > 0) {
          existing.credit += alloc.amount;
        }
        billsMap.set(key, existing);
      }
    } else if (v.voucherType === 'Sales') {
      const key = v.voucherNo || `VCH-${v.id}`;
      const existing = billsMap.get(key) || {
        billNo: key,
        billDate: v.date,
        dueDate: v.date,
        debit: 0,
        credit: 0,
      };
      existing.debit += v.debit;
      billsMap.set(key, existing);
    }
  }

  // Do not invent dates for an unallocated opening balance.
  // Keep such balances out of dated ageing buckets until bill-level data exists.

  const items: AgeingItem[] = [];
  let b0_30 = 0;
  let b31_60 = 0;
  let b61_90 = 0;
  let b91_120 = 0;
  let b120Plus = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  billsMap.forEach((bill) => {
    const pending = bill.debit - bill.credit;
    if (pending > 1) { // pending balance
      const dueDateObj = new Date(bill.dueDate);
      const diffMs = asOf - dueDateObj.getTime();
      const daysPastDue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      let bucket: '0-30' | '31-60' | '61-90' | '91-120' | '>120';
      let status: 'Current' | 'Due Soon' | 'Overdue (31-60d)' | 'High Risk (61-90d)' | 'Critical (>90d)';

      if (daysPastDue <= 30) {
        bucket = '0-30';
        status = daysPastDue === 0 ? 'Current' : 'Due Soon';
        b0_30 += pending;
      } else if (daysPastDue <= 60) {
        bucket = '31-60';
        status = 'Overdue (31-60d)';
        b31_60 += pending;
        totalOverdue += pending;
      } else if (daysPastDue <= 90) {
        bucket = '61-90';
        status = 'High Risk (61-90d)';
        b61_90 += pending;
        totalOverdue += pending;
      } else if (daysPastDue <= 120) {
        bucket = '91-120';
        status = 'Critical (>90d)';
        b91_120 += pending;
        totalOverdue += pending;
      } else {
        bucket = '>120';
        status = 'Critical (>90d)';
        b120Plus += pending;
        totalOverdue += pending;
      }

      totalPending += pending;

      items.push({
        billNo: bill.billNo,
        billDate: bill.billDate,
        dueDate: bill.dueDate,
        originalAmount: bill.debit,
        pendingAmount: pending,
        daysPastDue,
        bucket,
        status,
      });
    }
  });

  // Sort bills descending by overdue days
  items.sort((a, b) => b.daysPastDue - a.daysPastDue);

  return {
    bucket0_30: b0_30,
    bucket31_60: b31_60,
    bucket61_90: b61_90,
    bucket91_120: b91_120,
    bucket120Plus: b120Plus,
    totalOutstanding: Math.max(0, ledger.currentBalance),
    totalOverdue,
    bills: items,
  };
}



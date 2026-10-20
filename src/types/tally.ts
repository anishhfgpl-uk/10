export type VoucherType = 'Sales' | 'Receipt' | 'Credit Note' | 'Debit Note' | 'Journal' | 'Payment' | 'Contra' | 'Purchase';

export interface BillAllocation {
  billNo: string;
  billDate: string; // YYYY-MM-DD
  dueDate: string;  // YYYY-MM-DD
  billType: 'New Ref' | 'Agst Ref' | 'Advance' | 'On Account';
  amount: number;
}

export interface TallyVoucher {
  id: string;
  voucherType: VoucherType;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  particulars: string;
  debit: number;
  credit: number;
  narration?: string;
  referenceNo?: string;
  billAllocations?: BillAllocation[];
  ledgerId: string;
  ledgerName: string;
}

export interface DebtorLedger {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  gstin?: string;
  pan?: string;
  state?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  creditLimit: number;
  creditPeriodDays: number;
  openingBalance: number; // positive = Dr, negative = Cr
  currentBalance: number; // calculated
  overdueAmount: number;
  totalDebits: number;
  totalCredits: number;
  activeBillsCount: number;
  lastPaymentDate?: string;
  lastInvoiceDate?: string;
}

export interface DebtorGroup {
  id: string;
  name: string;
  parentId?: string;
  parentName?: string;
  ledgerCount: number;
  totalBalance: number;
  overdueBalance: number;
}

export interface AgeingItem {
  billNo: string;
  billDate: string;
  dueDate: string;
  originalAmount: number;
  pendingAmount: number;
  daysPastDue: number; // >0 is overdue
  bucket: '0-30' | '31-60' | '61-90' | '91-120' | '>120';
  status: 'Current' | 'Due Soon' | 'Overdue (31-60d)' | 'High Risk (61-90d)' | 'Critical (>90d)';
}

export interface AgeingSummary {
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket91_120: number;
  bucket120Plus: number;
  totalOutstanding: number;
  totalOverdue: number;
  bills: AgeingItem[];
}

export interface Company {
  id: string;
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  financialYearStart: string;
  financialYearEnd: string;
  currency: string;
  lastSyncedAt: string;
  syncSource: string;
  apiKey: string;
}

export interface LedgerStatementRow {
  date: string;
  voucherType: string;
  voucherNo: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: 'Dr' | 'Cr';
}

export interface DateRangeFilter {
  preset: 'all' | 'fy24-25' | 'fy25-26' | 'this-month' | 'last-30' | 'last-90' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}


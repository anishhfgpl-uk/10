import React, { useState, useEffect, useMemo } from 'react';
import { Company, DebtorLedger, TallyVoucher, AgeingSummary, LedgerStatementRow } from '../types/tally';
import { computeLedgerStatement, computeAgeingAnalysis, formatIndianCurrency, formatDate } from '../utils/tallyCalculator';
import { exportLedgerPdf } from '../utils/pdfExport';
import {
  ArrowLeft,
  Calendar,
  FileDown,
  Printer,
  Table,
  Clock,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  CreditCard,
  Filter,
  RefreshCw,
  Share2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface LedgerDetailViewProps {
  company: Company;
  ledger: DebtorLedger;
  allVouchers: TallyVoucher[];
  onBack: () => void;
  onOpenPrintModal: () => void;
}

export const LedgerDetailView: React.FC<LedgerDetailViewProps> = ({
  company,
  ledger,
  allVouchers,
  onBack,
  onOpenPrintModal,
}) => {
  // Date Filtering State: default to the current financial year.
  const currentDate = new Date();
  const currentFYStartYear =
    currentDate.getMonth() >= 3
      ? currentDate.getFullYear()
      : currentDate.getFullYear() - 1;
  const currentFY = {
    startYear: currentFYStartYear,
    start: `${currentFYStartYear}-04-01`,
    end: `${currentFYStartYear + 1}-03-31`,
    label: `FY ${currentFYStartYear}-${String(currentFYStartYear + 1).slice(-2)}`,
  };

  const [filterPreset, setFilterPreset] = useState<string>('fy-current');
  const [startDate, setStartDate] = useState<string>(currentFY.start);
  const [endDate, setEndDate] = useState<string>(
    `${currentDate.getFullYear() < currentFYStartYear ? currentFYStartYear : currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
  );
  const [selectedTab, setSelectedTab] = useState<'vouchers' | 'ageing' | 'bills'>('vouchers');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filter vouchers belonging to this ledger
  const ledgerVouchers = useMemo(
    () => allVouchers.filter((v) => v.ledgerId === ledger.id),
    [allVouchers, ledger.id]
  );

  // Preset Handlers
  const applyPreset = (preset: string) => {
    setFilterPreset(preset);

    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    const fyOffset =
      preset === 'fy-current' ? 0 :
      preset === 'fy-prev-1' ? 1 :
      preset === 'fy-prev-2' ? 2 : null;

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (fyOffset !== null) {
      const year = currentFY.startYear - fyOffset;
      setStartDate(`${year}-04-01`);
      setEndDate(`${year + 1}-03-31`);
    } else if (preset === 'last-30' || preset === 'last-90') {
      const d = new Date(today);
      d.setDate(d.getDate() - (preset === 'last-30' ? 30 : 90));
      const from = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
      setStartDate(from);
      setEndDate(todayStr);
    } else {
      const year = currentFY.startYear;
      const quarters: Record<string, [string, string]> = {
        q1: [`${year}-04-01`, `${year}-06-30`],
        q2: [`${year}-07-01`, `${year}-09-30`],
        q3: [`${year}-10-01`, `${year}-12-31`],
        q4: [`${year + 1}-01-01`, `${year + 1}-03-31`],
      };
      const quarter = quarters[preset];
      if (quarter) {
        setStartDate(quarter[0]);
        setEndDate(quarter[1]);
      }
    }
  };

  // Compute Statement with Running Balance
  const statement = useMemo(() => {
    return computeLedgerStatement(ledger, ledgerVouchers, startDate || undefined, endDate || undefined);
  }, [ledger, ledgerVouchers, startDate, endDate]);

  // Compute Ageing Analysis
  const ageing = useMemo(() => {
    return computeAgeingAnalysis(ledger, ledgerVouchers, endDate || new Date().toISOString().slice(0, 10));
  }, [ledger, ledgerVouchers, endDate]);

  // Ageing Chart Data
  const ageingChartData = useMemo(() => {
    return [
      { name: '0-30 Days', amount: ageing.bucket0_30, color: '#10b981' },
      { name: '31-60 Days', amount: ageing.bucket31_60, color: '#f59e0b' },
      { name: '61-90 Days', amount: ageing.bucket61_90, color: '#f97316' },
      { name: '91-120 Days', amount: ageing.bucket91_120, color: '#ef4444' },
      { name: '> 120 Days', amount: ageing.bucket120Plus, color: '#991b1b' },
    ];
  }, [ageing]);

  // Handle PDF Export
  const handlePdfDownload = () => {
    setIsExporting(true);
    try {
      exportLedgerPdf({
        company,
        ledger,
        statement,
        ageing,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle CSV Export
  const handleCsvExport = () => {
    const headers = ['Date', 'Voucher Type', 'Voucher No', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance', 'Type'];
    const rows = statement.rows.map((r) => [
      r.date,
      `"${r.voucherType}"`,
      `"${r.voucherNo}"`,
      `"${r.particulars.replace(/"/g, '""')}"`,
      r.debit || 0,
      r.credit || 0,
      r.balance || 0,
      r.balanceType,
    ]);

    // Add opening and closing
    rows.unshift([
      startDate || currentFY.start,
      'Opening Balance',
      '-',
      'Opening Balance Brought Forward',
      statement.openingType === 'Dr' ? statement.openingBalance : 0,
      statement.openingType === 'Cr' ? statement.openingBalance : 0,
      statement.openingBalance,
      statement.openingType,
    ]);

    rows.push([
      endDate || currentFY.end,
      'Closing Balance',
      '-',
      'Closing Balance Carried Forward',
      statement.totalDebit,
      statement.totalCredit,
      statement.closingBalance,
      statement.closingType,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${ledger.name.replace(/[^a-zA-Z0-9]/g, '_')}_Ledger_Statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const creditUtilization = ledger.creditLimit > 0 ? (statement.closingBalance / ledger.creditLimit) * 100 : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Ledgers</span>
          </button>
          <div className="text-xs text-slate-400">
            <span>{ledger.groupName}</span>
            <span className="mx-1.5">/</span>
            <span className="text-indigo-400 font-semibold">{ledger.name}</span>
          </div>
        </div>

        {/* Action Buttons: PDF, Print, CSV */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePdfDownload}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-md shadow-rose-900/30 border border-rose-500/30 transition-all active:scale-95"
            title="Download formatted vector PDF statement with ageing analysis"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={onOpenPrintModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
            title="Open printable statement"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>

          <button
            onClick={handleCsvExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
            title="Export CSV to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Debtor Profile Card & Credit Limits */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Party Details */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {ledger.name}
                </h1>
                <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                  {ledger.gstin && (
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-indigo-300">
                      GSTIN: {ledger.gstin}
                    </span>
                  )}
                  {ledger.pan && (
                    <span className="font-mono text-slate-400">PAN: {ledger.pan}</span>
                  )}
                  <span className="bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 px-2 py-0.5 rounded text-[11px] font-medium">
                    {ledger.groupName}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/60">
              {ledger.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{ledger.address}</span>
                </div>
              )}
              {ledger.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{ledger.phone}</span>
                </div>
              )}
              {ledger.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{ledger.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Credit Terms: <strong>{ledger.creditPeriodDays} Days</strong></span>
              </div>
            </div>
          </div>

          {/* Col 2: Credit Limit & Outstanding Balance Widget */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Closing Balance (Dr)</span>
                <span className="font-bold text-rose-400 text-lg font-mono">
                  {formatIndianCurrency(statement.closingBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Overdue Balance:</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {formatIndianCurrency(ageing.totalOverdue)}
                </span>
              </div>
            </div>

            {/* Credit Limit Gauge */}
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Credit Limit Utilization</span>
                <span className="font-mono text-slate-300">
                  {creditUtilization.toFixed(0)}% ({formatIndianCurrency(ledger.creditLimit)})
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    creditUtilization > 90
                      ? 'bg-rose-500'
                      : creditUtilization > 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, creditUtilization)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOM DATE FILTER TOOLBAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Voucher Statement Date Filtering</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'fy-current', label: currentFY.label },
              { id: 'fy-prev-1', label: `FY ${currentFY.startYear - 1}-${String(currentFY.startYear).slice(-2)}` },
              { id: 'fy-prev-2', label: `FY ${currentFY.startYear - 2}-${String(currentFY.startYear - 1).slice(-2)}` },
              { id: 'last-30', label: 'Last 30 Days' },
              { id: 'last-90', label: 'Last 90 Days' },
              { id: 'q1', label: 'Q1' },
              { id: 'q2', label: 'Q2' },
              { id: 'q3', label: 'Q3' },
              { id: 'q4', label: 'Q4' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  filterPreset === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Start & End Date Inputs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">From Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setFilterPreset('custom');
              }}
              className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">To Date:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setFilterPreset('custom');
              }}
              className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="text-[11px] text-slate-400 sm:ml-auto">
            Showing <strong className="text-indigo-300 font-mono">{statement.rows.length}</strong> transactions • Opening: <strong className="font-mono text-slate-200">{formatIndianCurrency(statement.openingBalance)} {statement.openingType}</strong>
          </div>
        </div>
      </div>

      {/* Tab Navigation: Vouchers Ledger vs Ageing Analysis */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setSelectedTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            selectedTab === 'vouchers'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Date-wise Ledger Vouchers ({statement.rows.length})</span>
        </button>

        <button
          onClick={() => setSelectedTab('ageing')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            selectedTab === 'ageing'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Ageing Analysis & Buckets</span>
        </button>

        <button
          onClick={() => setSelectedTab('bills')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            selectedTab === 'bills'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Pending Invoices ({ageing.bills.length})</span>
        </button>
      </div>

      {/* TAB 1: DATE-WISE VOUCHERS LEDGER WITH RUNNING BALANCE */}
      {selectedTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Vch Type</th>
                    <th className="py-3 px-3">Voucher #</th>
                    <th className="py-3 px-4">Particulars & Narration</th>
                    <th className="py-3 px-3 text-right">Debit (₹ Dr)</th>
                    <th className="py-3 px-3 text-right">Credit (₹ Cr)</th>
                    <th className="py-3 px-4 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-950/40 text-slate-300 font-semibold border-b border-slate-800">
                    <td className="py-3 px-4 font-sans text-slate-400">
                      {startDate ? formatDate(startDate) : '-'}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        Opening
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">-</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-300">
                      Opening Balance Brought Forward
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {statement.openingType === 'Dr' ? formatIndianCurrency(statement.openingBalance) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {statement.openingType === 'Cr' ? formatIndianCurrency(statement.openingBalance) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-200">
                      {formatIndianCurrency(statement.openingBalance)} {statement.openingType}
                    </td>
                  </tr>

                  {/* Transaction Rows */}
                  {statement.rows.map((row, idx) => {
                    const isDebit = row.debit > 0;
                    const isCredit = row.credit > 0;

                    let typeBadgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                    if (row.voucherType === 'Sales') {
                      typeBadgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                    } else if (row.voucherType === 'Receipt') {
                      typeBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    } else if (row.voucherType === 'Credit Note') {
                      typeBadgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    } else if (row.voucherType === 'Debit Note') {
                      typeBadgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                    }

                    return (
                      <tr key={idx} className="hover:bg-indigo-950/15 transition-colors">
                        <td className="py-3 px-4 font-sans text-slate-300">
                          {formatDate(row.date)}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${typeBadgeColor}`}>
                            {row.voucherType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-semibold">
                          {row.voucherNo}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">
                          <div className="line-clamp-2">{row.particulars}</div>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-100 font-medium">
                          {isDebit ? formatIndianCurrency(row.debit) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-medium">
                          {isCredit ? formatIndianCurrency(row.credit) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-300">
                          {formatIndianCurrency(row.balance)} {row.balanceType}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary Totals Footer Row */}
                  <tr className="bg-slate-950/80 font-bold border-t-2 border-slate-700 text-white">
                    <td className="py-3.5 px-4 font-sans" colSpan={4}>
                      <div className="flex items-center justify-between">
                        <span>Closing Balance as of {endDate ? formatDate(endDate) : 'Today'}</span>
                        <span className="text-slate-400 text-xs font-normal">
                          Total Period Turnover:
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-white">
                      {formatIndianCurrency(statement.totalDebit)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-emerald-400">
                      {formatIndianCurrency(statement.totalCredit)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-rose-400 text-sm">
                      {formatIndianCurrency(statement.closingBalance)} {statement.closingType}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AGEING ANALYSIS & BUCKETS */}
      {selectedTab === 'ageing' && (
        <div className="space-y-6">
          {/* 5 Ageing Bucket Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: '0-30 Days', amt: ageing.bucket0_30, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', desc: 'Current / Not Overdue' },
              { label: '31-60 Days', amt: ageing.bucket31_60, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5', desc: 'Overdue (31-60d)' },
              { label: '61-90 Days', amt: ageing.bucket61_90, color: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/5', desc: 'Moderate Risk' },
              { label: '91-120 Days', amt: ageing.bucket91_120, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5', desc: 'High Risk' },
              { label: '> 120 Days', amt: ageing.bucket120Plus, color: 'text-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5', desc: 'Critical Bad Debt Risk' },
            ].map((b, idx) => (
              <div
                key={idx}
                className={`${b.bg} border ${b.border} rounded-xl p-3.5 flex flex-col justify-between`}
              >
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{b.label}</div>
                  <div className={`text-lg font-bold font-mono mt-1 ${b.color}`}>
                    {formatIndianCurrency(b.amt)}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2">{b.desc}</div>
              </div>
            ))}
          </div>

          {/* Recharts Ageing Chart */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Aging Profile for {ledger.name}
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageingChartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(val: any) => [formatIndianCurrency(Number(val)), 'Pending Due']}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {ageingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BILL-BY-BILL PENDING INVOICES */}
      {selectedTab === 'bills' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Bill-Wise Outstanding & Overdue Days
            </h3>
            <span className="text-xs text-slate-400">
              Total Pending Bills: <strong className="text-indigo-300">{ageing.bills.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-sans font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Bill Date</th>
                  <th className="py-3 px-3">Bill / Invoice #</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-right">Invoiced Amount</th>
                  <th className="py-3 px-4 text-right">Pending Amount</th>
                  <th className="py-3 px-3 text-center">Days Overdue</th>
                  <th className="py-3 px-3 text-center">Ageing Bucket</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ageing.bills.map((bill, idx) => {
                  let badge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  if (bill.daysPastDue > 90) {
                    badge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  } else if (bill.daysPastDue > 30) {
                    badge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  }

                  return (
                    <tr key={idx} className="hover:bg-indigo-950/15 transition-colors">
                      <td className="py-3 px-4 font-sans text-slate-300">{formatDate(bill.billDate)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-100">{bill.billNo}</td>
                      <td className="py-3 px-3 font-sans text-slate-400">{formatDate(bill.dueDate)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatIndianCurrency(bill.originalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-300">
                        {formatIndianCurrency(bill.pendingAmount)}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-200">
                        {bill.daysPastDue} Days
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-700 text-slate-300">
                          {bill.bucket} Days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badge}`}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {ageing.bills.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center font-sans text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="font-semibold text-slate-200">No overdue bills pending</p>
                      <p className="text-xs text-slate-500">All invoices have been paid or reconciled.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

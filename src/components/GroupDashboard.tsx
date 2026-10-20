import React, { useState, useMemo } from 'react';
import { DebtorGroup, DebtorLedger } from '../types/tally';
import { formatIndianCurrency } from '../utils/tallyCalculator';
import {
  Users,
  AlertTriangle,
  ArrowUpDown,
  Search,
  ExternalLink,
  ShieldCheck,
  Building,
  Phone,
  BarChart3,
  Calendar,
  Layers,
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

interface GroupDashboardProps {
  selectedGroup: DebtorGroup;
  ledgers: DebtorLedger[];
  onSelectLedger: (ledger: DebtorLedger) => void;
  groupAgeingSummary?: {
    bucket0_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket91_120: number;
    bucket120Plus: number;
    totalOutstanding: number;
    totalOverdue: number;
  };
}

export const GroupDashboard: React.FC<GroupDashboardProps> = ({
  selectedGroup,
  ledgers,
  onSelectLedger,
  groupAgeingSummary,
}) => {
  const [searchLedger, setSearchLedger] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'overdue' | 'creditLimit'>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter & Sort ledgers
  const filteredLedgers = useMemo(() => {
    let result = ledgers.filter((l) => {
      const q = searchLedger.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.gstin && l.gstin.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q))
      );
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'balance') {
        comparison = a.currentBalance - b.currentBalance;
      } else if (sortBy === 'overdue') {
        comparison = a.overdueAmount - b.overdueAmount;
      } else if (sortBy === 'creditLimit') {
        comparison = a.creditLimit - b.creditLimit;
      } else {
        comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [ledgers, searchLedger, sortBy, sortOrder]);

  // Aggregate stats
  const totalBalance = useMemo(
    () => ledgers.reduce((acc, l) => acc + (l.currentBalance || 0), 0),
    [ledgers]
  );
  const totalOverdue = useMemo(
    () => ledgers.reduce((acc, l) => acc + (l.overdueAmount || 0), 0),
    [ledgers]
  );
  const criticalCount = useMemo(
    () => ledgers.filter((l) => l.overdueAmount > 50000).length,
    [ledgers]
  );

  // Ageing Chart Data
  const ageingChartData = useMemo(() => {
    if (!groupAgeingSummary) {
      // Approximate fallback
      return [
        { name: '0-30 Days', amount: totalBalance * 0.45, color: '#10b981' },
        { name: '31-60 Days', amount: totalOverdue * 0.4, color: '#f59e0b' },
        { name: '61-90 Days', amount: totalOverdue * 0.3, color: '#f97316' },
        { name: '91-120 Days', amount: totalOverdue * 0.2, color: '#ef4444' },
        { name: '> 120 Days', amount: totalOverdue * 0.1, color: '#b91c1c' },
      ];
    }
    return [
      { name: '0-30 Days', amount: groupAgeingSummary.bucket0_30, color: '#10b981' },
      { name: '31-60 Days', amount: groupAgeingSummary.bucket31_60, color: '#f59e0b' },
      { name: '61-90 Days', amount: groupAgeingSummary.bucket61_90, color: '#f97316' },
      { name: '91-120 Days', amount: groupAgeingSummary.bucket91_120, color: '#ef4444' },
      { name: '> 120 Days', amount: groupAgeingSummary.bucket120Plus, color: '#b91c1c' },
    ];
  }, [groupAgeingSummary, totalBalance, totalOverdue]);

  const toggleSort = (field: 'balance' | 'name' | 'overdue' | 'creditLimit') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Debtor Group Ledger View</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            {selectedGroup.name}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {ledgers.length} Ledgers
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Click any debtor ledger below to open the date-wise voucher statement, ageing breakdown, and PDF export.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Outstanding */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-3 top-3 text-indigo-500/10">
            <Building className="w-16 h-16" />
          </div>
          <div className="text-xs font-medium text-slate-400">Total Group Outstanding</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
            {formatIndianCurrency(totalBalance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="text-indigo-400 font-semibold">{ledgers.length}</span> active parties
          </div>
        </div>

        {/* Card 2: Overdue */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-3 top-3 text-amber-500/10">
            <AlertTriangle className="w-16 h-16" />
          </div>
          <div className="text-xs font-medium text-slate-400">Total Overdue (&gt;30 Days)</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-1">
            {formatIndianCurrency(totalOverdue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {totalBalance > 0 ? ((totalOverdue / totalBalance) * 100).toFixed(1) : 0}% of group outstanding
          </div>
        </div>

        {/* Card 3: Critical Accounts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400">Critical Follow-up Parties</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1">
            {criticalCount} <span className="text-xs font-normal text-slate-400">Accounts</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Parties with overdue balance &gt; ₹50,000
          </div>
        </div>

        {/* Card 4: Healthy Ratio */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400">Current / Safe Ratio</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            {totalBalance > 0
              ? `${(((totalBalance - totalOverdue) / totalBalance) * 100).toFixed(0)}%`
              : '100%'}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Invoices within credit period
          </div>
        </div>
      </div>

      {/* Visual Analytics Chart: Ageing Buckets for this group */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Group Ageing Bucket Distribution
            </h2>
            <p className="text-[11px] text-slate-400">
              Visualizes receivables aging across 0-30, 31-60, 61-90, 91-120 and &gt;120 days
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60">
            <span>Total Overdue:</span>
            <span className="text-amber-400 font-semibold">{formatIndianCurrency(totalOverdue)}</span>
          </div>
        </div>

        <div className="h-56 w-full">
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
                formatter={(val: any) => [formatIndianCurrency(Number(val)), 'Outstanding Amount']}
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

      {/* Debtors Table Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Table Filter / Controls Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchLedger}
              onChange={(e) => setSearchLedger(e.target.value)}
              placeholder="Search debtor name, GSTIN or city..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Quick Sort Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Sort:
            </span>
            <button
              onClick={() => toggleSort('balance')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                sortBy === 'balance'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Balance {sortBy === 'balance' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => toggleSort('overdue')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                sortBy === 'overdue'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Overdue {sortBy === 'overdue' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => toggleSort('name')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                sortBy === 'name'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Debtor Ledger Name</th>
                <th className="py-3 px-3">Location / State</th>
                <th className="py-3 px-3">GSTIN</th>
                <th className="py-3 px-3 text-right">Credit Limit & Terms</th>
                <th className="py-3 px-3 text-right">Total Invoiced (Dr)</th>
                <th className="py-3 px-4 text-right">Outstanding (Dr)</th>
                <th className="py-3 px-3 text-right">Overdue Amt</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLedgers.map((ledger) => {
                const isOverdue = ledger.overdueAmount > 0;
                const isCritical = ledger.overdueAmount > 100000;

                return (
                  <tr
                    key={ledger.id}
                    onClick={() => onSelectLedger(ledger)}
                    className="hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                  >
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {ledger.name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        {ledger.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {ledger.phone}
                          </span>
                        )}
                        <span className="text-slate-500">•</span>
                        <span>{ledger.activeBillsCount} active bills</span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-3 text-slate-300">
                      <div>{ledger.city || ledger.state || 'India'}</div>
                      <div className="text-[10px] text-slate-500">{ledger.state || '-'}</div>
                    </td>

                    {/* GSTIN */}
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-400">
                      {ledger.gstin ? (
                        <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 text-slate-300">
                          {ledger.gstin}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Unregistered</span>
                      )}
                    </td>

                    {/* Credit Limit & Period */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="font-mono text-slate-200">
                        {formatIndianCurrency(ledger.creditLimit)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {ledger.creditPeriodDays} Days Term
                      </div>
                    </td>

                    {/* Total Debits */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      {formatIndianCurrency(ledger.totalDebits)}
                    </td>

                    {/* Outstanding Balance */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-bold text-indigo-300 text-sm">
                        {formatIndianCurrency(ledger.currentBalance)}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">Dr</span>
                    </td>

                    {/* Overdue */}
                    <td className="py-3.5 px-3 text-right">
                      {isOverdue ? (
                        <span
                          className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                            isCritical
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {formatIndianCurrency(ledger.overdueAmount)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-medium">All Current</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLedger(ledger);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all shadow-sm group-hover:border-indigo-400"
                      >
                        <span>View Ledger & Ageing</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredLedgers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-slate-300">No debtor ledgers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchLedger
                        ? `No ledgers matching "${searchLedger}" in this group`
                        : 'No ledgers under this debtor group yet.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

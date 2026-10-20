import React from 'react';
import { Company, DebtorLedger, AgeingSummary, LedgerStatementRow } from '../types/tally';
import { formatIndianCurrency, formatDate } from '../utils/tallyCalculator';
import { X, Printer } from 'lucide-react';

interface PrintStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const PrintStatementModal: React.FC<PrintStatementModalProps> = ({
  isOpen,
  onClose,
  company,
  ledger,
  statement,
  ageing,
  startDate,
  endDate,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 print:hidden">
          <div className="text-xs font-semibold text-slate-300">
            Print Preview: Statement & Ageing for {ledger.name}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Page (Ctrl+P)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet (White A4 style) */}
        <div className="p-6 sm:p-10 bg-white text-slate-900 overflow-y-auto flex-1 font-sans text-xs leading-normal print:overflow-visible print:p-0">
          
          {/* Company Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                {company.name}
              </h1>
              <p className="text-[11px] text-slate-600 mt-0.5">{company.address}</p>
              <div className="text-[11px] text-slate-600 mt-0.5">
                <span>GSTIN: <strong>{company.gstin}</strong></span>
                <span className="mx-2">•</span>
                <span>Phone: {company.phone}</span>
                <span className="mx-2">•</span>
                <span>Email: {company.email}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white font-bold text-[10px] px-2.5 py-1 rounded">
                DEBTOR STATEMENT
              </span>
              <div className="text-[10px] text-slate-500 mt-1">
                Date: {formatDate(new Date().toISOString().split('T')[0])}
              </div>
            </div>
          </div>

          {/* Customer / Debtor Information Box */}
          <div className="grid grid-cols-2 gap-4 my-4 p-3.5 bg-slate-50 border border-slate-200 rounded">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Party / Debtor Details:</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{ledger.name}</div>
              <div className="text-slate-600 text-[11px] mt-0.5">{ledger.address || ledger.city}</div>
              <div className="text-slate-600 text-[11px] mt-0.5">
                GSTIN: <strong>{ledger.gstin || 'Unregistered'}</strong> | PAN: {ledger.pan || 'N/A'}
              </div>
              <div className="text-slate-600 text-[11px]">Phone: {ledger.phone || 'N/A'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Account Summary:</div>
              <div className="text-[11px] text-slate-700 mt-1">
                Statement Period: <strong>{startDate ? formatDate(startDate) : 'Start'} to {endDate ? formatDate(endDate) : 'Today'}</strong>
              </div>
              <div className="text-[11px] text-slate-700">
                Credit Terms: <strong>{ledger.creditPeriodDays} Days</strong> | Limit: {formatIndianCurrency(ledger.creditLimit)}
              </div>
              <div className="text-sm font-bold text-red-600 mt-1.5">
                Closing Balance: {formatIndianCurrency(statement.closingBalance)} {statement.closingType}
              </div>
              <div className="text-[11px] font-semibold text-amber-700">
                Overdue Amount: {formatIndianCurrency(ageing.totalOverdue)}
              </div>
            </div>
          </div>

          {/* Ageing Breakdown Strip */}
          <div className="my-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Receivables Ageing Breakdown:
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
              <div className="p-2 border border-slate-200 rounded bg-slate-50">
                <div className="text-slate-500">0 - 30 Days</div>
                <div className="font-bold text-slate-900 text-xs mt-0.5 font-mono">{formatIndianCurrency(ageing.bucket0_30)}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded bg-slate-50">
                <div className="text-slate-500">31 - 60 Days</div>
                <div className="font-bold text-amber-700 text-xs mt-0.5 font-mono">{formatIndianCurrency(ageing.bucket31_60)}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded bg-slate-50">
                <div className="text-slate-500">61 - 90 Days</div>
                <div className="font-bold text-orange-700 text-xs mt-0.5 font-mono">{formatIndianCurrency(ageing.bucket61_90)}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded bg-slate-50">
                <div className="text-slate-500">91 - 120 Days</div>
                <div className="font-bold text-rose-700 text-xs mt-0.5 font-mono">{formatIndianCurrency(ageing.bucket91_120)}</div>
              </div>
              <div className="p-2 border border-slate-200 rounded bg-slate-50">
                <div className="text-slate-500">&gt; 120 Days</div>
                <div className="font-bold text-red-800 text-xs mt-0.5 font-mono">{formatIndianCurrency(ageing.bucket120Plus)}</div>
              </div>
            </div>
          </div>

          {/* Date-wise Voucher Transactions Table */}
          <div className="my-4">
            <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                  <th className="py-2 px-2 border-r border-slate-300">Date</th>
                  <th className="py-2 px-2 border-r border-slate-300">Type</th>
                  <th className="py-2 px-2 border-r border-slate-300">Vch No</th>
                  <th className="py-2 px-2 border-r border-slate-300">Particulars & Narration</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Debit (Dr)</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Credit (Cr)</th>
                  <th className="py-2 px-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[10.5px]">
                {/* Opening Balance */}
                <tr className="bg-slate-50 font-bold">
                  <td className="py-1.5 px-2 border-r border-slate-300 font-sans">{startDate ? formatDate(startDate) : '-'}</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 font-sans">Opening</td>
                  <td className="py-1.5 px-2 border-r border-slate-300">-</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 font-sans">Opening Balance B/F</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                    {statement.openingType === 'Dr' ? formatIndianCurrency(statement.openingBalance) : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                    {statement.openingType === 'Cr' ? formatIndianCurrency(statement.openingBalance) : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    {formatIndianCurrency(statement.openingBalance)} {statement.openingType}
                  </td>
                </tr>

                {/* Vouchers */}
                {statement.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-sans">{formatDate(row.date)}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-sans">{row.voucherType}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-bold">{row.voucherNo}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-sans">{row.particulars}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                      {row.debit > 0 ? formatIndianCurrency(row.debit) : '-'}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right text-emerald-800">
                      {row.credit > 0 ? formatIndianCurrency(row.credit) : '-'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-slate-900">
                      {formatIndianCurrency(row.balance)} {row.balanceType}
                    </td>
                  </tr>
                ))}

                {/* Closing Balance Row */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td className="py-2 px-2 border-r border-slate-300 font-sans" colSpan={4}>
                    Closing Balance as of {endDate ? formatDate(endDate) : 'Today'}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right">
                    {formatIndianCurrency(statement.totalDebit)}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right">
                    {formatIndianCurrency(statement.totalCredit)}
                  </td>
                  <td className="py-2 px-2 text-right text-red-700">
                    {formatIndianCurrency(statement.closingBalance)} {statement.closingType}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures & Footer */}
          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end">
            <div className="text-[10px] text-slate-500 max-w-sm">
              <p>1. Kindly verify and confirm the closing balance within 7 days of receipt.</p>
              <p>2. Please remit overdue payments directly to our designated bank account.</p>
              <p>3. This is a computer-generated statement directly synced from Tally Accounting.</p>
            </div>
            <div className="text-right">
              <div className="font-bold text-xs text-slate-900">For {company.name}</div>
              <div className="h-12"></div>
              <div className="text-[10px] text-slate-600 border-t border-slate-400 pt-1">
                Authorised Signatory / Accounts Dept
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

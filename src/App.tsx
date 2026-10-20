import React, { useState, useEffect, useCallback } from 'react';
import { Company, DebtorGroup, DebtorLedger, TallyVoucher } from './types/tally';
import { Navbar } from './components/Navbar';
import { GroupSidebar } from './components/GroupSidebar';
import { GroupDashboard } from './components/GroupDashboard';
import { LedgerDetailView } from './components/LedgerDetailView';
import { SyncModal } from './components/SyncModal';
import { PrintStatementModal } from './components/PrintStatementModal';
import { computeLedgerStatement, computeAgeingAnalysis } from './utils/tallyCalculator';
import { Loader2, AlertCircle, Building2, CheckCircle2, ArrowRight } from 'lucide-react';

export default function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [showCompanySelection, setShowCompanySelection] = useState<boolean>(() => sessionStorage.getItem('ledger-company-opened') !== 'true');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [groups, setGroups] = useState<DebtorGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('grp_all');
  const [ledgers, setLedgers] = useState<DebtorLedger[]>([]);
  const [selectedLedger, setSelectedLedger] = useState<DebtorLedger | null>(null);
  const [allVouchers, setAllVouchers] = useState<TallyVoucher[]>([]);
  const [groupAgeingSummary, setGroupAgeingSummary] = useState<any>(null);

  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Companies
  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(data.companies || []);
      const active = data.companies?.find((c: Company) => c.id === data.activeCompanyId) || data.companies?.[0];
      setActiveCompany(active || null);
      setSelectedCompanyId(active?.id || data.companies?.[0]?.id || '');
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      setError('Could not connect to Cloud Database.');
    }
  }, []);

  // 2. Fetch Groups & Ledgers for Active Company
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupsRes, ledgersRes, vouchersRes] = await Promise.all([
        fetch('/api/tally/groups'),
        fetch('/api/tally/ledgers'),
        fetch('/api/tally/vouchers'),
      ]);

      const groupsData = await groupsRes.json();
      const ledgersData = await ledgersRes.json();
      const vouchersData = await vouchersRes.json();

      setGroups(groupsData || []);
      setLedgers(ledgersData || []);
      setAllVouchers(vouchersData || []);

      if (groupsData && groupsData.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsData[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load Tally data:', err);
      setError('Failed to load Debtor groups & ledgers.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroupId]);

  // Initial mount
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // When active company changes, reload groups & ledgers
  useEffect(() => {
    if (activeCompany) {
      loadData();
      setSelectedLedger(null);
    }
  }, [activeCompany?.id, loadData]);

  // Load group ageing summary
  useEffect(() => {
    if (selectedGroupId) {
      fetch(`/api/tally/group-ageing/${selectedGroupId}`)
        .then((res) => res.json())
        .then((data) => setGroupAgeingSummary(data))
        .catch((err) => console.error('Failed to load group ageing:', err));
    }
  }, [selectedGroupId]);

  // Fetch full vouchers when a ledger is selected
  useEffect(() => {
    if (selectedLedger) {
      fetch(`/api/tally/ledger-vouchers/${selectedLedger.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.statement?.rows) {
            // Merge or set vouchers if provided
          }
        })
        .catch((err) => console.error('Failed to load vouchers for ledger:', err));
    }
  }, [selectedLedger?.id]);

  // Switch Company handler
  const handleSwitchCompany = async (companyId: string) => {
    try {
      const res = await fetch('/api/companies/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        const found = companies.find((c) => c.id === companyId);
        if (found) setActiveCompany(found);
        setSelectedLedger(null);
        setSelectedGroupId('grp_all');
        loadData();
      }
    } catch (err) {
      console.error('Failed to switch company:', err);
    }
  };

  // Open the selected company only after an explicit user action.
  const handleOpenCompany = async () => {
    if (!selectedCompanyId) return;
    setError(null);
    try {
      const res = await fetch('/api/companies/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!res.ok) throw new Error('Company could not be opened. Please refresh the company list.');
      const result = await res.json();
      const found = companies.find((c) => c.id === selectedCompanyId);
      if (!found) throw new Error('Selected company was not found in the company list.');
      setActiveCompany(result.activeCompany || found);
      setSelectedLedger(null);
      setSelectedGroupId('grp_all');
      sessionStorage.setItem('ledger-company-opened', 'true');
      setShowCompanySelection(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to open company.');
    }
  };

  // Filter ledgers by selected group & global search
  const displayedLedgers = React.useMemo(() => {
    let list = [...ledgers];
    if (selectedGroupId && selectedGroupId !== 'grp_all' && selectedGroupId !== 'all') {
      list = list.filter((l) => l.groupId === selectedGroupId);
    }
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.gstin && l.gstin.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.groupName && l.groupName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [ledgers, selectedGroupId, globalSearch]);

  const currentSelectedGroup = groups.find((g) => g.id === selectedGroupId) || {
    id: 'grp_all',
    name: 'Sundry Debtors (All)',
    ledgerCount: ledgers.length,
    totalBalance: ledgers.reduce((acc, l) => acc + (l.currentBalance || 0), 0),
    overdueBalance: ledgers.reduce((acc, l) => acc + (l.overdueAmount || 0), 0),
  };

  const totalCompanyBalance = ledgers.reduce((acc, l) => acc + (l.currentBalance || 0), 0);

  // Compute statement & ageing for selected ledger in print modal
  const selectedLedgerStatement = selectedLedger
    ? computeLedgerStatement(selectedLedger, allVouchers.filter((v) => v.ledgerId === selectedLedger.id))
    : {
        openingBalance: 0,
        openingType: 'Dr' as const,
        rows: [],
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        closingType: 'Dr' as const,
      };

  const selectedLedgerAgeing = selectedLedger
    ? computeAgeingAnalysis(selectedLedger, allVouchers.filter((v) => v.ledgerId === selectedLedger.id))
    : {
        bucket0_30: 0,
        bucket31_60: 0,
        bucket61_90: 0,
        bucket91_120: 0,
        bucket120Plus: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        bills: [],
      };

  if (showCompanySelection) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">TallySync Pro</h1>
              <p className="text-sm text-slate-400">Company Selection</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl overflow-hidden">
            <div className="p-5 sm:p-7 border-b border-slate-800">
              <h2 className="text-lg font-semibold">Select a company</h2>
              <p className="text-sm text-slate-400 mt-1">
                Choose the company whose saved Ledger data you want to open.
              </p>
            </div>

            <div className="p-3 sm:p-5 space-y-2">
              {companies.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-400">
                  {error || 'Loading company list...'}
                </div>
              )}

              {companies.map((company) => {
                const selected = selectedCompanyId === company.id;
                const active = activeCompany?.id === company.id;
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(company.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-indigo-400 bg-indigo-500/10'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                      selected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm sm:text-base break-words">{company.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {active ? 'Currently active in Ledger' : 'Saved company data'}
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="w-5 h-5 text-indigo-300 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mx-5 mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="p-5 sm:px-7 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-500">
                Opening a company selects its saved Ledger dataset.
              </p>
              <button
                type="button"
                onClick={handleOpenCompany}
                disabled={!selectedCompanyId || companies.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 text-sm font-semibold text-white transition-colors"
              >
                Open Company <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-slate-600">
            TallySync Pro · Company data is kept separately by company ID
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Navbar */}
      <Navbar
        companies={companies}
        activeCompany={activeCompany}
        onSwitchCompany={handleSwitchCompany}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        globalSearch={globalSearch}
        onSearchChange={setGlobalSearch}
        isLoading={isLoading}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto">
        {/* Left Debtor Groups Sidebar */}
        <GroupSidebar
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={(gid) => {
            setSelectedGroupId(gid);
            setSelectedLedger(null); // Return to group view
          }}
          totalCompanyBalance={totalCompanyBalance}
        />

        {/* Center / Right Content Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {isLoading && !selectedLedger && (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400 font-medium">
                  Loading Tally Debtors & Cloud Vouchers...
                </span>
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div className="p-6 m-6 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !selectedLedger && (
            <GroupDashboard
              selectedGroup={currentSelectedGroup}
              ledgers={displayedLedgers}
              onSelectLedger={(l) => setSelectedLedger(l)}
              groupAgeingSummary={groupAgeingSummary}
            />
          )}

          {selectedLedger && activeCompany && (
            <LedgerDetailView
              company={activeCompany}
              ledger={selectedLedger}
              allVouchers={allVouchers}
              onBack={() => setSelectedLedger(null)}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
            />
          )}
        </div>
      </main>

      {/* Tally Cloud Bridge & Office Sync Hub Modal */}
      {activeCompany && (
        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          activeCompany={activeCompany}
          onRefreshData={() => {
            loadCompanies();
            loadData();
          }}
        />
      )}

      {/* Print View Modal */}
      {activeCompany && selectedLedger && (
        <PrintStatementModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          company={activeCompany}
          ledger={selectedLedger}
          statement={selectedLedgerStatement}
          ageing={selectedLedgerAgeing}
        />
      )}
    </div>
  );
}

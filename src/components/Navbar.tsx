import React from 'react';
import { Company } from '../types/tally';
import { Building2, CloudCheck, RefreshCw, Upload, Search, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  companies: Company[];
  activeCompany: Company | null;
  onSwitchCompany: (companyId: string) => void;
  onOpenSyncModal: () => void;
  globalSearch: string;
  onSearchChange: (val: string) => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  companies,
  activeCompany,
  onSwitchCompany,
  onOpenSyncModal,
  globalSearch,
  onSearchChange,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-amber-400 text-lg tracking-wider">
                T
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  TallySync<span className="text-amber-400 font-medium text-xs ml-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">CLOUD</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Cloud Synced
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Tally Prime & ERP 9 Debtors • Ageing & Statements
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search debtor name, GSTIN, city or group..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              {globalSearch && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Right Action Area: Company Switcher & Sync Hub */}
          <div className="flex items-center gap-3">
            {/* Company Dropdown */}
            {companies.length > 0 && activeCompany && (
              <div className="relative flex items-center">
                <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-xs text-slate-200">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <select
                    value={activeCompany.id}
                    onChange={(e) => onSwitchCompany(e.target.value)}
                    className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer pr-1 max-w-[190px] truncate"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Sync Hub Trigger Button */}
            <button
              onClick={onOpenSyncModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-500/30 transition-all transform active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync & Connect Tally</span>
              <span className="sm:hidden">Sync</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

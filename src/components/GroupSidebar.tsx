import React, { useState } from 'react';
import { DebtorGroup } from '../types/tally';
import { formatIndianCurrency } from '../utils/tallyCalculator';
import { FolderTree, Users, AlertTriangle, ChevronRight, Layers, Search } from 'lucide-react';

interface GroupSidebarProps {
  groups: DebtorGroup[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  totalCompanyBalance: number;
}

export const GroupSidebar: React.FC<GroupSidebarProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  totalCompanyBalance,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 bg-slate-900/60 border-r border-slate-800/80 p-4 flex flex-col gap-4">
      {/* Title & Group Search */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <FolderTree className="w-4 h-4 text-indigo-400" />
            <span>Debtor Groups</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            {groups.length} Groups
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter groups..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Group List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1 custom-scrollbar">
        {filteredGroups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const isRoot = group.id === 'grp_all' || group.name.toLowerCase().includes('all');

          return (
            <button
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-indigo-500/80 shadow-md shadow-indigo-950/40'
                  : 'bg-slate-800/30 hover:bg-slate-800/70 border-slate-800/60 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isRoot ? (
                    <Layers className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                  ) : (
                    <Users className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                  )}
                  <span className={`text-xs font-semibold leading-tight line-clamp-1 ${
                    isSelected ? 'text-white' : 'text-slate-200'
                  }`}>
                    {group.name}
                  </span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  isSelected ? 'text-indigo-400 rotate-90 md:rotate-0' : 'text-slate-600'
                }`} />
              </div>

              {/* Group stats row */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/40">
                <span className="text-slate-400 flex items-center gap-1">
                  <span>{group.ledgerCount} {group.ledgerCount === 1 ? 'debtor' : 'debtors'}</span>
                </span>
                <span className={`font-semibold font-mono ${
                  isSelected ? 'text-indigo-300' : 'text-slate-300'
                }`}>
                  {formatIndianCurrency(group.totalBalance)}
                </span>
              </div>

              {/* Overdue tag if exists */}
              {group.overdueBalance > 0 && (
                <div className="flex items-center justify-between text-[10px] text-amber-400/90 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/15">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Overdue:
                  </span>
                  <span className="font-mono font-medium">{formatIndianCurrency(group.overdueBalance)}</span>
                </div>
              )}
            </button>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="text-center py-6 text-xs text-slate-500">
            No debtor groups match "{filterQuery}"
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="pt-3 border-t border-slate-800/80 bg-slate-900/40 rounded-lg p-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Total Sundry Debtors</span>
          <span className="text-emerald-400 font-semibold font-mono">{formatIndianCurrency(totalCompanyBalance)}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          Syncs real-time with office & local Tally
        </div>
      </div>
    </aside>
  );
};

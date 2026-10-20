const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

function replaceOnce(oldText, newText, label) {
  const first = s.indexOf(oldText);
  if (first < 0) throw new Error("Patch location not found: " + label);
  if (s.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error("Patch location is not unique: " + label);
  }
  s = s.slice(0, first) + newText + s.slice(first + oldText.length);
}

replaceOnce(
  "import { Loader2, AlertCircle } from 'lucide-react';",
  "import { Loader2, AlertCircle, Building2, CheckCircle2, ArrowRight } from 'lucide-react';",
  "icon imports"
);

replaceOnce(
  "  const [activeCompany, setActiveCompany] = useState<Company | null>(null);",
  "  const [activeCompany, setActiveCompany] = useState<Company | null>(null);\n" +
  "  const [showCompanySelection, setShowCompanySelection] = useState<boolean>(true);\n" +
  "  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');",
  "company selection state"
);

replaceOnce(
  "      setActiveCompany(active || null);",
  "      setActiveCompany(active || null);\n" +
  "      setSelectedCompanyId(active?.id || data.companies?.[0]?.id || '');",
  "initial company selection"
);

replaceOnce(
  "  // Filter ledgers by selected group & global search",
  "  // Open the selected company only after an explicit user action.\n" +
  "  const handleOpenCompany = async () => {\n" +
  "    if (!selectedCompanyId) return;\n" +
  "    setError(null);\n" +
  "    try {\n" +
  "      const res = await fetch('/api/companies/switch', {\n" +
  "        method: 'POST',\n" +
  "        headers: { 'Content-Type': 'application/json' },\n" +
  "        body: JSON.stringify({ companyId: selectedCompanyId }),\n" +
  "      });\n" +
  "      if (!res.ok) throw new Error('Company could not be opened. Please refresh the company list.');\n" +
  "      const result = await res.json();\n" +
  "      const found = companies.find((c) => c.id === selectedCompanyId);\n" +
  "      if (!found) throw new Error('Selected company was not found in the company list.');\n" +
  "      setActiveCompany(result.activeCompany || found);\n" +
  "      setSelectedLedger(null);\n" +
  "      setSelectedGroupId('grp_all');\n" +
  "      setShowCompanySelection(false);\n" +
  "      await loadData();\n" +
  "    } catch (err: any) {\n" +
  "      setError(err?.message || 'Failed to open company.');\n" +
  "    }\n" +
  "  };\n\n" +
  "  // Filter ledgers by selected group & global search",
  "open company handler"
);

const marker = '  return (\n    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">';
const screen = `  if (showCompanySelection) {
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
                    className={\`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors \${
                      selected
                        ? 'border-indigo-400 bg-indigo-500/10'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                    }\`}
                  >
                    <div className={\`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center \${
                      selected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
                    }\`}>
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

`;
replaceOnce(marker, screen + marker, "startup selection screen");

fs.writeFileSync(file, s, "utf8");
console.log("Company Selection screen added to src/App.tsx");


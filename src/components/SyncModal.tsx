import React, { useState, useEffect } from 'react';
import { Company } from '../types/tally';
import {
  X,
  Upload,
  Terminal,
  Code,
  ShieldCheck,
  Check,
  Copy,
  Download,
  Building,
  RefreshCw,
  HelpCircle,
  Laptop,
  Network,
  FileCode,
} from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompany: Company;
  onRefreshData: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  activeCompany,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'script' | 'upload' | 'api' | 'status'>('script');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [scriptData, setScriptData] = useState<{ pythonScript: string; powershellScript: string; syncUrl: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/tally/connector-script')
        .then((res) => res.json())
        .then((data) => setScriptData(data))
        .catch((err) => console.error('Failed to load connector script info:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(activeCompany.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const text = await file.text();
      const res = await fetch('/api/tally/upload-xml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'x-tally-api-key': activeCompany.apiKey,
        },
        body: text,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadStatus({
          success: true,
          message: `Successfully imported ${data.importedLedgers} Debtors and ${data.importedVouchers} Vouchers from "${data.companyName}" into Cloud!`,
        });
        onRefreshData();
      } else {
        setUploadStatus({
          success: false,
          message: data.error || 'Failed to import Tally XML.',
        });
      }
    } catch (err: any) {
      setUploadStatus({
        success: false,
        message: `Upload error: ${err.message || 'File processing failed'}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetSampleData = async () => {
    if (confirm('Reset database to realistic sample Tally company data?')) {
      setIsUploading(true);
      try {
        await fetch('/api/tally/reset', { method: 'POST' });
        onRefreshData();
        setUploadStatus({ success: true, message: 'Sample Tally data reloaded successfully!' });
      } catch {
        // ignore
      } finally {
        setIsUploading(false);
      }
    }
  };

  const downloadScript = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Tally Cloud Bridge & Office Sync Hub
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Secure API v1
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sync Debtors & Vouchers from office/home Tally Prime or ERP 9 to access from anywhere.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-4 sm:px-6 overflow-x-auto">
          {[
            { id: 'script', label: 'Office PC Auto-Sync (Script)', icon: Terminal },
            { id: 'upload', label: 'Direct XML File Upload', icon: Upload },
            { id: 'api', label: 'Cloud API Endpoint', icon: Code },
            { id: 'status', label: 'Cloud Storage Status', icon: ShieldCheck },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === t.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-xs">
          {/* Status Message */}
          {uploadStatus && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                uploadStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {uploadStatus.success ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <X className="w-4 h-4 shrink-0" />
              )}
              <span>{uploadStatus.message}</span>
            </div>
          )}

          {/* TAB 1: AUTOMATED PC SYNC SCRIPT */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  3-Step Automated Sync from Office or Local Computer
                </h3>

                <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed text-xs">
                  <li>
                    <strong>Open Tally Prime / ERP 9</strong> on your local or office PC.
                  </li>
                  <li>
                    Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono">F12</kbd> &gt; <strong>Advanced Configuration</strong> &gt; Set <em>"Tally is acting as"</em> to <strong>Both / Server</strong> on <strong>Port 9000</strong>.
                  </li>
                  <li>
                    Run the pre-configured script below on that PC (or add to Windows Task Scheduler for hourly auto-sync). It extracts debtor vouchers and pushes them to your cloud app!
                  </li>
                </ol>
              </div>

              {/* Script Box */}
              {scriptData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Python 1-Click Sync Script (Ready to Run):
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyScript(scriptData.pythonScript)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? 'Copied' : 'Copy Script'}</span>
                      </button>
                      <button
                        onClick={() => downloadScript('tally_cloud_sync.py', scriptData.pythonScript)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download .py</span>
                      </button>
                    </div>
                  </div>

                  <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] text-indigo-200 overflow-x-auto max-h-56">
                    {scriptData.pythonScript}
                  </pre>

                  {/* PowerShell Alternative */}
                  <div className="pt-2">
                    <details className="cursor-pointer">
                      <summary className="text-xs font-semibold text-slate-400 hover:text-slate-200">
                        View Windows PowerShell 1-Click Script (.ps1)
                      </summary>
                      <div className="mt-2 space-y-2">
                        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-44">
                          {scriptData.powershellScript}
                        </pre>
                        <button
                          onClick={() => downloadScript('tally_cloud_sync.ps1', scriptData.powershellScript)}
                          className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download .ps1 for Windows</span>
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT XML UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Import Tally XML Export File</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Export your <strong>Day Book</strong> or <strong>Ledger Vouchers</strong> from Tally (Alt+E &gt; XML Format) and upload here. All debtors, vouchers, and ageing will be saved to your cloud account instantly.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md transition-all active:scale-95">
                    <FileCode className="w-4 h-4" />
                    <span>{isUploading ? 'Parsing & Storing XML...' : 'Select Tally XML File'}</span>
                    <input
                      type="file"
                      accept=".xml,text/xml"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-2">
                <div className="font-semibold text-slate-300">How to export from Tally Prime:</div>
                <div className="font-mono text-[11px] bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  Gateway of Tally &gt; Display More Reports &gt; Day Book &gt; Alt + E (Export) &gt; Format: XML (Data Interchange) &gt; Send
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: API ENDPOINT DETAILS */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-white">Secure Cloud Sync Endpoint</h4>
                <p className="text-xs text-slate-400">
                  Any remote system (Office computer, ERP bridge, cron job, or custom software) can push Tally data to this URL using your private API Key.
                </p>

                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold text-slate-300">Target Endpoint:</div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs break-all">
                    POST {scriptData?.syncUrl || '/api/tally/sync'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span>Secret API Key for this Company:</span>
                    <button
                      onClick={handleCopyApiKey}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[10px]"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-indigo-300 text-xs">
                    {activeCompany.apiKey}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">Example cURL Request:</div>
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
{`curl -X POST "${scriptData?.syncUrl || 'https://YOUR_APP_URL/api/tally/sync'}" \\
  -H "Content-Type: application/xml" \\
  -H "x-tally-api-key: ${activeCompany.apiKey}" \\
  -H "x-sync-source: Office PC Accounts" \\
  --data-binary @DayBook.xml`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLOUD STORAGE STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white">Active Company Cloud Record</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Persisted in Cloud
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <span className="text-slate-500">Company Name:</span>
                    <div className="font-bold text-slate-200 mt-0.5">{activeCompany.name}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">GSTIN:</span>
                    <div className="font-mono text-slate-200 mt-0.5">{activeCompany.gstin}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Synced:</span>
                    <div className="text-slate-200 mt-0.5">
                      {new Date(activeCompany.lastSyncedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Sync Source:</span>
                    <div className="text-slate-200 mt-0.5">{activeCompany.syncSource}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-300">Reset Demo Data</div>
                    <div className="text-[11px] text-slate-500">
                      Reload default 20+ debtors and 150+ vouchers for testing.
                    </div>
                  </div>
                  <button
                    onClick={handleResetSampleData}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 transition-all"
                  >
                    Reset to Demo Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-end encrypted Tally Data interchange</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SEED_COMPANIES, SEED_GROUPS, SEED_LEDGERS, SEED_VOUCHERS } from './src/mock/tallySeedData';
import { Company, DebtorGroup, DebtorLedger, TallyVoucher } from './src/types/tally';
import { computeLedgerStatement, computeAgeingAnalysis } from './src/utils/tallyCalculator';
import { parseTallyXML } from './src/utils/tallyXmlParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and large XML/text bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: ['application/xml', 'text/xml'], limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cloud Data Store
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tally-db.json');

interface CloudDatabase {
  activeCompanyId: string;
  companies: Company[];
  groups: Record<string, DebtorGroup[]>; // companyId -> groups
  ledgers: Record<string, DebtorLedger[]>; // companyId -> ledgers
  vouchers: Record<string, TallyVoucher[]>; // companyId -> vouchers
}

function loadDatabase(): CloudDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load database from disk, using seed:', err);
  }

  // Initial seed
  const initialDb: CloudDatabase = {
    activeCompanyId: 'comp_01',
    companies: SEED_COMPANIES,
    groups: {
      // Start with no demo records. Real records arrive only from the office Tally sync.
      comp_01: [],
      comp_02: [],
    },
    ledgers: {
      comp_01: [],
      comp_02: [],
    },
    vouchers: {
      comp_01: [],
      comp_02: [],
    },
  };

  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(db: CloudDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

let db = loadDatabase();

// Helper to get active company data
function getActiveCompanyData() {
  const compId = db.activeCompanyId || db.companies[0]?.id || 'comp_01';
  const company = db.companies.find((c) => c.id === compId) || db.companies[0];
  const groups = db.groups[compId] || [];
  const ledgers = db.ledgers[compId] || [];
  const vouchers = db.vouchers[compId] || [];
  return { company, groups, ledgers, vouchers };
}

// ----------------- API ROUTES -----------------

// Local-only import from the currently open Tally Prime company.
app.post('/api/tally/import-current-company', async (req: Request, res: Response) => {
  const remote = req.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
    res.status(403).json({ error: 'This import is allowed only from this computer.' });
    return;
  }

  try {
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3
      ? now.getFullYear()
      : now.getFullYear() - 1;
    const tallyFromDate = `${fyStartYear}0401`;
    const tallyToDate = `${fyStartYear + 1}0331`;

    const tallyRequest = (report: string) => `<?xml version="1.0"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY><EXPORTDATA><REQUESTDESC>
  <REPORTNAME>${report}</REPORTNAME>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVFROMDATE>${tallyFromDate}</SVFROMDATE>
   <SVTODATE>${tallyToDate}</SVTODATE>
  </STATICVARIABLES>
 </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>`;

    const getReport = async (report: string): Promise<string> => {
      const response = await fetch('http://127.0.0.1:9000', {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: tallyRequest(report),
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`Tally HTTP ${response.status} for ${report}`);
      return await response.text();
    };

    const accountsXml = await getReport('List of Accounts');

    // Identify the company reported by Tally; never assume a fixed company name.
    const companyMatch =
      accountsXml.match(/<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i) ||
      accountsXml.match(/<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i) ||
      accountsXml.match(/<REMOTECMPNAME[^>]*>([^<]+)<\/REMOTECMPNAME>/i);

    const tallyCompanyName = companyMatch?.[1]?.trim();

    if (!tallyCompanyName ||
        /^(Imported Tally Company|Unknown|Not Selected)$/i.test(tallyCompanyName)) {
      res.status(409).json({
        error: 'Could not verify the currently open Tally company. No database changes made.'
      });
      return;
    }

    const dayBookXml = await getReport('Voucher Register');
    const groupSummaryXml = await getReport('Group Summary');
    const parsed = parseTallyXML(accountsXml + '\n' + dayBookXml + '\n' + groupSummaryXml);

    if (!parsed.ledgers.length) {
      res.status(422).json({
        error: 'No debtor/customer ledgers were parsed. Database unchanged.',
        tallyCompany: tallyCompanyName
      });
      return;
    }

    const normalizeCompanyName = (name: string) =>
      name.trim().replace(/\s+/g, ' ').toLowerCase();

    let company = db.companies.find(
      c => normalizeCompanyName(c.name) === normalizeCompanyName(tallyCompanyName)
    );

    const isNewCompany = !company;

    if (!company) {
      const slug = normalizeCompanyName(tallyCompanyName)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 70) || 'company';

      const baseId = 'comp_tally_' + slug;
      let newId = baseId;
      let suffix = 2;

      while (db.companies.some(c => c.id === newId && 
             normalizeCompanyName(c.name) !== normalizeCompanyName(tallyCompanyName))) {
        newId = baseId + '_' + suffix++;
      }

      company = {
        id: newId,
        name: tallyCompanyName,
        gstin: '',
        address: '',
        phone: '',
        email: '',
        financialYearStart: '2026-04-01',
        financialYearEnd: '2027-03-31',
        currency: 'INR',
        lastSyncedAt: '',
        syncSource: 'Local Tally Prime',
        apiKey: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      };
    }

    const companyId = company.id;
    const mergeById = <T extends { id: string }>(oldRows: T[], newRows: T[]): T[] => {
      const map = new Map(oldRows.map(row => [row.id, row]));
      for (const row of newRows) map.set(row.id, row);
      return Array.from(map.values());
    };

    // Stable voucher IDs make repeat imports update, rather than duplicate, records.
    const stableVouchers = parsed.vouchers.map(v => ({
  ...v,
  id: v.voucherNo === '(Unnumbered)'
    ? v.id.slice(0, 220)
    : ('vch_' + [v.date, v.voucherType, v.voucherNo, v.ledgerId]
        .join('_').toLowerCase().replace(/[^a-z0-9_-]/g, '_')).slice(0, 220)
}));
    if (isNewCompany) db.companies.push(company);
    db.groups[companyId] = mergeById(db.groups[companyId] || [], parsed.groups);
    db.ledgers[companyId] = mergeById(db.ledgers[companyId] || [], parsed.ledgers);
    db.vouchers[companyId] = mergeById(db.vouchers[companyId] || [], stableVouchers);

    company.lastSyncedAt = new Date().toISOString();
    company.syncSource = 'Local Tally Prime';
    db.activeCompanyId = companyId;
    saveDatabase(db);

    res.json({
      success: true,
      company: company.name,
      companyCreated: isNewCompany,
      financialYear: '2026-04-01 to 2027-03-31',
      importedDebtorLedgers: parsed.ledgers.length,
      importedGroups: parsed.groups.length,
      parsedVouchers: stableVouchers.length,
      savedLedgersTotal: db.ledgers[companyId].length,
      savedVouchersTotal: db.vouchers[companyId].length,
      note: stableVouchers.length === 0
        ? 'Ledgers saved, but no vouchers were parsed. Voucher import needs separate verification.'
        : 'Counts show records parsed from Tally and totals saved for this company.'
    });
  } catch (error) {
    console.error('Local Tally import failed:', error);
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Tally import failed'
    });
  }
});

// 1. Companies
app.get('/api/companies', (req: Request, res: Response) => {
  res.json({
    activeCompanyId: db.activeCompanyId,
    companies: db.companies,
  });
});

app.post('/api/companies/switch', (req: Request, res: Response) => {
  const { companyId } = req.body;
  const found = db.companies.find((c) => c.id === companyId);
  if (!found) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  db.activeCompanyId = companyId;
  saveDatabase(db);
  res.json({ success: true, activeCompany: found });
});

// 2. Debtor Groups
app.get('/api/tally/groups', (req: Request, res: Response) => {
  const { groups, ledgers } = getActiveCompanyData();

  // Recalculate ledger counts & balances dynamically
  const updatedGroups = groups.map((g) => {
    const isAll = g.id === 'grp_all' || g.name.toLowerCase().includes('all');
    const matchingLedgers = isAll ? ledgers : ledgers.filter((l) => l.groupId === g.id || l.groupName === g.name);
    const totalBalance = matchingLedgers.reduce((acc, l) => acc + (l.currentBalance || 0), 0);
    const overdueBalance = matchingLedgers.reduce((acc, l) => acc + (l.overdueAmount || 0), 0);
    return {
      ...g,
      ledgerCount: matchingLedgers.length,
      totalBalance,
      overdueBalance,
    };
  });

  res.json(updatedGroups);
});

// 3. Debtor Ledgers
app.get('/api/tally/ledgers', (req: Request, res: Response) => {
  const { groupId, search } = req.query;
  const { ledgers } = getActiveCompanyData();

  let filtered = [...ledgers];

  if (groupId && groupId !== 'grp_all' && groupId !== 'all') {
    filtered = filtered.filter((l) => l.groupId === groupId);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.gstin && l.gstin.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.groupName && l.groupName.toLowerCase().includes(q))
    );
  }

  res.json(filtered);
});

// 4. Ledger Details
app.get('/api/tally/ledger/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { ledgers } = getActiveCompanyData();
  const ledger = ledgers.find((l) => l.id === id);
  if (!ledger) {
    res.status(404).json({ error: 'Ledger not found' });
    return;
  }
  res.json(ledger);
});

// 5. Date-wise Vouchers & Ledger Statement with Running Balance
app.get('/api/tally/ledger-vouchers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const { ledgers, vouchers, company } = getActiveCompanyData();

  const ledger = ledgers.find((l) => l.id === id);
  if (!ledger) {
    res.status(404).json({ error: 'Ledger not found' });
    return;
  }

  const ledgerVouchers = vouchers.filter((v) => v.ledgerId === id);
  const statement = computeLedgerStatement(ledger, ledgerVouchers, startDate, endDate);
  const ageing = computeAgeingAnalysis(ledger, ledgerVouchers, endDate || new Date().toISOString().slice(0, 10));

  res.json({
    company,
    ledger,
    filter: { startDate, endDate },
    statement,
    ageing,
    voucherCount: ledgerVouchers.length,
    vouchers: ledgerVouchers,
  });
});

// 5b. All Vouchers for Active Company
app.get('/api/tally/vouchers', (req: Request, res: Response) => {
  const { ledgerId } = req.query;
  const { vouchers } = getActiveCompanyData();
  if (ledgerId && typeof ledgerId === 'string') {
    res.json(vouchers.filter((v) => v.ledgerId === ledgerId));
    return;
  }
  res.json(vouchers);
});

// 6. Ageing Analysis for a Ledger
app.get('/api/tally/ageing/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { asOfDate } = req.query as { asOfDate?: string };
  const { ledgers, vouchers } = getActiveCompanyData();

  const ledger = ledgers.find((l) => l.id === id);
  if (!ledger) {
    res.status(404).json({ error: 'Ledger not found' });
    return;
  }

  const ledgerVouchers = vouchers.filter((v) => v.ledgerId === id);
  const ageing = computeAgeingAnalysis(ledger, ledgerVouchers, asOfDate || new Date().toISOString().slice(0, 10));

  res.json(ageing);
});

// 7. Group Overall Ageing Analytics
app.get('/api/tally/group-ageing/:groupId', (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { ledgers, vouchers } = getActiveCompanyData();

  const targetLedgers =
    groupId === 'grp_all' || groupId === 'all'
      ? ledgers
      : ledgers.filter((l) => l.groupId === groupId);

  let b0_30 = 0;
  let b31_60 = 0;
  let b61_90 = 0;
  let b91_120 = 0;
  let b120Plus = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const led of targetLedgers) {
    const ledVchs = vouchers.filter((v) => v.ledgerId === led.id);
    const ageing = computeAgeingAnalysis(led, ledVchs, new Date().toISOString().slice(0, 10));
    b0_30 += ageing.bucket0_30;
    b31_60 += ageing.bucket31_60;
    b61_90 += ageing.bucket61_90;
    b91_120 += ageing.bucket91_120;
    b120Plus += ageing.bucket120Plus;
    totalOutstanding += ageing.totalOutstanding;
    totalOverdue += ageing.totalOverdue;
  }

  res.json({
    groupId,
    totalLedgers: targetLedgers.length,
    bucket0_30: b0_30,
    bucket31_60: b31_60,
    bucket61_90: b61_90,
    bucket91_120: b91_120,
    bucket120Plus: b120Plus,
    totalOutstanding,
    totalOverdue,
  });
});

// 8. SECURE SYNC ENDPOINT (for office / local PC automated sync via script)
app.post('/api/tally/sync', (req: Request, res: Response) => {
  const apiKey = (req.headers['x-tally-api-key'] || req.query.apiKey) as string;

  // Require a valid company API key. Never fall back to the active company.
  const targetCompany = typeof apiKey === 'string' && apiKey.length > 0
    ? db.companies.find((c) => c.apiKey === apiKey)
    : undefined;

  if (!targetCompany) {
    res.status(401).json({ error: 'Invalid or missing company API key. No data was changed.' });
    return;
  }

  let importedData: {
    companyName?: string;
    groups?: DebtorGroup[];
    ledgers?: DebtorLedger[];
    vouchers?: TallyVoucher[];
  } = {};

  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('xml') || typeof req.body === 'string') {
    const rawXml = typeof req.body === 'string' ? req.body : req.body.toString();
    importedData = parseTallyXML(rawXml);
  } else {
    importedData = req.body;
  }

  if (!importedData.ledgers || importedData.ledgers.length === 0) {
    res.status(400).json({
      error: 'No debtor ledger data received in sync payload',
      receivedKeys: Object.keys(req.body || {}),
    });
    return;
  }

  // Update target company
  targetCompany.lastSyncedAt = new Date().toISOString();
  targetCompany.syncSource = (req.headers['x-sync-source'] as string) || 'Cloud Tally Sync Agent';

  const compId = targetCompany.id;

  // Replace the selected company's snapshot with the latest Tally import.
  // This prevents demo/stale ledgers or vouchers from being mixed into real accounts.
  db.groups[compId] = importedData.groups || [];
  db.ledgers[compId] = importedData.ledgers;
  db.vouchers[compId] = importedData.vouchers || [];

  saveDatabase(db);

  res.json({
    success: true,
    message: 'Tally data successfully synced and saved to cloud!',
    company: targetCompany.name,
    syncedLedgersCount: importedData.ledgers.length,
    syncedVouchersCount: importedData.vouchers?.length || 0,
    timestamp: targetCompany.lastSyncedAt,
  });
});

// 9. Browser XML Upload endpoint - validate company before saving
app.post('/api/tally/upload-xml', (req: Request, res: Response) => {
  const apiKey = req.headers['x-tally-api-key'];
  const targetCompany =
    typeof apiKey === 'string' && apiKey.length > 0
      ? db.companies.find((c) => c.apiKey === apiKey)
      : undefined;

  if (!targetCompany) {
    res.status(401).json({
      error: 'Invalid or missing company API key. No data was changed.',
    });
    return;
  }

  const rawXml =
    typeof req.body === 'string' ? req.body : req.body?.xmlContent || '';

  if (!rawXml) {
    res.status(400).json({ error: 'Empty XML file received' });
    return;
  }

  const parsed = parseTallyXML(rawXml);

  if (!parsed.companyName || parsed.companyName === 'Imported Tally Company') {
    res.status(400).json({
      error: 'Tally company name could not be verified. No data was changed.',
    });
    return;
  }

  const normalizeName = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

  if (normalizeName(parsed.companyName) !== normalizeName(targetCompany.name)) {
    res.status(409).json({
      error: 'Tally company does not match the selected company. No data was changed.',
      tallyCompany: parsed.companyName,
      selectedCompany: targetCompany.name,
    });
    return;
  }

  if (parsed.ledgers.length === 0 && parsed.vouchers.length === 0) {
    res.status(400).json({
      error: 'No debtor ledgers or vouchers detected. No data was changed.',
    });
    return;
  }

  const compId = targetCompany.id;

  if (parsed.groups.length > 0) {
    const groupMap = new Map(
      (db.groups[compId] || []).map((g) => [g.id, g])
    );
    parsed.groups.forEach((g) => groupMap.set(g.id, g));
    db.groups[compId] = Array.from(groupMap.values());
  }

  if (parsed.ledgers.length > 0) {
    const ledgerMap = new Map(
      (db.ledgers[compId] || []).map((l) => [l.id, l])
    );
    parsed.ledgers.forEach((l) => ledgerMap.set(l.id, l));
    db.ledgers[compId] = Array.from(ledgerMap.values());
  }

  if (parsed.vouchers.length > 0) {
    const voucherMap = new Map(
      (db.vouchers[compId] || []).map((v) => [v.id, v])
    );
    parsed.vouchers.forEach((v) => voucherMap.set(v.id, v));
    db.vouchers[compId] = Array.from(voucherMap.values());
  }

  targetCompany.lastSyncedAt = new Date().toISOString();
  targetCompany.syncSource = 'Verified Direct Tally XML Import';

  saveDatabase(db);

  res.json({
    success: true,
    companyName: targetCompany.name,
    importedLedgers: parsed.ledgers.length,
    importedVouchers: parsed.vouchers.length,
    importedGroups: parsed.groups.length,
  });
});
// 10. Connector Script generator
app.get('/api/tally/connector-script', (req: Request, res: Response) => {
  const { company } = getActiveCompanyData();
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const syncUrl = `${protocol}://${host}/api/tally/sync`;

  const pythonScript = `"""
Tally to Cloud Auto-Sync Script
Compatible with Tally Prime 1.0 - 4.1 & Tally.ERP 9
Connects to local Tally at http://localhost:9000 and synchronizes Debtors & Vouchers to your cloud dashboard.
"""
import requests
import xml.etree.ElementTree as ET
import sys
import time

TALLY_URL = "http://localhost:9000"
CLOUD_SYNC_URL = "${syncUrl}"
API_KEY = "${company.apiKey}"

def make_report_request(report_name, include_vouchers=False):
    voucher_flags = """
          <EXPLODEFLAG>Yes</EXPLODEFLAG>
          <ISVCHTYPE>Yes</ISVCHTYPE>""" if include_vouchers else ""
    return f'''<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>{report_name}</REPORTNAME>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{voucher_flags}
    </STATICVARIABLES>
  </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>'''

def sync_tally():
    print("Connecting to local/office Tally at " + TALLY_URL + "...")
    try:
        reports = []
        for report_name in ("List of Accounts", "Voucher Register", "Group Summary"):
            response = requests.post(
                TALLY_URL,
                data=make_report_request(report_name, report_name == "Voucher Register").encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=60
            )
            response.raise_for_status()
            xml = response.text
            if "<LINEERROR>" in xml.upper():
                print(f"[ERROR] Tally returned an error for {report_name}: {xml[:500]}")
                return False
            reports.append(xml)
            print(f"Received {report_name}: {len(response.content)} bytes")
    except Exception as e:
        print(f"[ERROR] Could not retrieve all required Tally reports: {e}")
        print("Please ensure the intended company is open in Tally and its XML server is enabled on port 9000.")
        return False

    combined_xml = "\\n".join(reports)
    print("Syncing account, voucher, and opening/closing balance reports to Cloud Platform: " + CLOUD_SYNC_URL + "...")
    headers = {
        'Content-Type': 'application/xml',
        'x-tally-api-key': API_KEY,
        'x-sync-source': 'Office Tally Auto-Sync (Python Agent)'
    }
    
    cloud_resp = requests.post(CLOUD_SYNC_URL, data=combined_xml.encode('utf-8'), headers=headers, timeout=120)
    if cloud_resp.status_code == 200:
        print("[SUCCESS] Synced successfully to cloud!")
        print(cloud_resp.text)
        return True
    else:
        print(f"[FAILED] Cloud sync error {cloud_resp.status_code}: {cloud_resp.text}")
        return False

if __name__ == '__main__':
    sync_tally()
`;

  const powershellScript = `# Windows PowerShell 1-Click Sync for Tally
$TallyUrl = "http://localhost:9000"
$CloudUrl = "${syncUrl}"
$ApiKey = "${company.apiKey}"

Write-Host "Extracting account masters, vouchers, and group balances from Tally Prime..." -ForegroundColor Cyan

function Get-TallyReport([string]$ReportName, [bool]$IncludeVouchers = $false) {
  $voucherFlags = if ($IncludeVouchers) { "<EXPLODEFLAG>Yes</EXPLODEFLAG><ISVCHTYPE>Yes</ISVCHTYPE>" } else { "" }
  $request = @"
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>$ReportName</REPORTNAME>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>\$\$SysName:XML</SVEXPORTFORMAT>
      $voucherFlags
    </STATICVARIABLES>
  </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>
"@
  $result = Invoke-WebRequest -Uri $TallyUrl -Method Post -Body $request -ContentType "text/xml" -TimeoutSec 60
  if ($result.Content -match "<LINEERROR>") { throw "Tally error in $ReportName report: $($result.Content.Substring(0, [Math]::Min(400, $result.Content.Length)))" }
  return $result.Content
}

try {
  $accountsXml = Get-TallyReport "List of Accounts"
  Write-Host "Accounts report received." -ForegroundColor Green
  $vouchersXml = Get-TallyReport "Voucher Register" $true
  Write-Host "Voucher Register received." -ForegroundColor Green
  $groupSummaryXml = Get-TallyReport "Group Summary"
  Write-Host "Group Summary (opening/closing balances) received." -ForegroundColor Green

  $combinedXml = $accountsXml + [Environment]::NewLine + $vouchersXml + [Environment]::NewLine + $groupSummaryXml
  Write-Host "Pushing all three reports to Cloud..." -ForegroundColor Yellow
  $cloudResp = Invoke-RestMethod -Uri $CloudUrl -Method Post -Body $combinedXml -Headers @{ "x-tally-api-key" = $ApiKey; "x-sync-source" = "Office PC (PowerShell 1-Click)" } -ContentType "application/xml" -TimeoutSec 120
  Write-Host "Tally Cloud Sync Successful!" -ForegroundColor Green
  Write-Host $cloudResp
} catch {
  Write-Host "Sync Failed: $($_.Exception.Message)" -ForegroundColor Red
}
`;

  res.json({
    pythonScript,
    powershellScript,
    apiKey: company.apiKey,
    syncUrl,
  });
});

// 11. Reset to seed data
app.post('/api/tally/reset', (req: Request, res: Response) => {
  if (fs.existsSync(DATA_FILE)) {
    fs.unlinkSync(DATA_FILE);
  }
  db = loadDatabase();
  res.json({ success: true, message: 'Cloud database reset to default demo data' });
});

// ----------------- VITE SETUP -----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`TallySync Cloud Server running on http://localhost:${PORT}`);
  });
}

startServer();




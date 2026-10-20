const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.ts');
const source = fs.readFileSync(file, 'utf8');

const startMarker = "    const accountsXml = await getReport('List of Accounts');";
const endMarker = '    const companyId = company.id;';

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);

if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0) {
  console.error('STOP: Expected code section was not found uniquely. No changes made.');
  process.exit(1);
}

const replacement = String.raw`    const accountsXml = await getReport('List of Accounts');

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
    const parsed = parseTallyXML(accountsXml + '\n' + dayBookXml);

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

    const companyId = company.id;`;

const patched = source.slice(0, start) + replacement +
  source.slice(end + endMarker.length);

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backup = file + '.before-company-patch-' + stamp + '.bak';
fs.copyFileSync(file, backup);

fs.writeFileSync(file, patched, 'utf8');
console.log('PATCH APPLIED');
console.log('Backup:', path.basename(backup));
console.log('Company matching is now name-based; database was not changed.');

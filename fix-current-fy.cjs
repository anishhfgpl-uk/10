const fs = require('fs');
const path = require('path');

const appPath = path.join('src', 'components', 'LedgerDetailView.tsx');
const serverPath = 'server.ts';

let app = fs.readFileSync(appPath, 'utf8');
let server = fs.readFileSync(serverPath, 'utf8');

// 1. Dynamic current financial year defaults.
const oldState = `  // Date Filtering State
  const [filterPreset, setFilterPreset] = useState<string>('fy24-25');
  const [startDate, setStartDate] = useState<string>('2024-04-01');
  const [endDate, setEndDate] = useState<string>('2025-03-31');`;

const newState = `  // Date Filtering State: default to the current financial year.
  const currentDate = new Date();
  const currentFYStartYear =
    currentDate.getMonth() >= 3
      ? currentDate.getFullYear()
      : currentDate.getFullYear() - 1;
  const currentFY = {
    startYear: currentFYStartYear,
    start: \`\${currentFYStartYear}-04-01\`,
    end: \`\${currentFYStartYear + 1}-03-31\`,
    label: \`FY \${currentFYStartYear}-\${String(currentFYStartYear + 1).slice(-2)}\`,
  };

  const [filterPreset, setFilterPreset] = useState<string>('fy-current');
  const [startDate, setStartDate] = useState<string>(currentFY.start);
  const [endDate, setEndDate] = useState<string>(
    \`\${currentDate.getFullYear() < currentFYStartYear ? currentFYStartYear : currentDate.getFullYear()}-\${String(currentDate.getMonth() + 1).padStart(2, '0')}-\${String(currentDate.getDate()).padStart(2, '0')}\`
  );`;

if (!app.includes(oldState)) throw new Error('Could not locate date state; no files changed.');
app = app.replace(oldState, newState);

// 2. Replace old hard-coded date presets.
const presetStart = app.indexOf('  // Preset Handlers');
const presetEnd = app.indexOf('  // Compute Statement with Running Balance', presetStart);
if (presetStart < 0 || presetEnd < 0) {
  throw new Error('Could not locate preset handler; no files changed.');
}

const newPresetHandler = `  // Preset Handlers
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
      setStartDate(\`\${year}-04-01\`);
      setEndDate(\`\${year + 1}-03-31\`);
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
        q1: [\`\${year}-04-01\`, \`\${year}-06-30\`],
        q2: [\`\${year}-07-01\`, \`\${year}-09-30\`],
        q3: [\`\${year}-10-01\`, \`\${year}-12-31\`],
        q4: [\`\${year + 1}-01-01\`, \`\${year + 1}-03-31\`],
      };
      const quarter = quarters[preset];
      if (quarter) {
        setStartDate(quarter[0]);
        setEndDate(quarter[1]);
      }
    }
  };

`;
app = app.slice(0, presetStart) + newPresetHandler + app.slice(presetEnd);

// 3. Make the visible FY buttons update automatically each year.
const oldButtons = `              { id: 'all', label: 'All Time' },
              { id: 'fy24-25', label: 'FY 2024-25' },
              { id: 'fy25-26', label: 'FY 2025-26' },`;
const newButtons = `              { id: 'all', label: 'All Time' },
              { id: 'fy-current', label: currentFY.label },
              { id: 'fy-prev-1', label: \`FY \${currentFY.startYear - 1}-\${String(currentFY.startYear).slice(-2)}\` },
              { id: 'fy-prev-2', label: \`FY \${currentFY.startYear - 2}-\${String(currentFY.startYear - 1).slice(-2)}\` },`;

if (!app.includes(oldButtons)) throw new Error('Could not locate FY buttons; no files changed.');
app = app.replace(oldButtons, newButtons);

// Remove stale fallback dates from ageing and CSV export.
app = app.replace(
  "endDate || '2025-02-15'",
  "endDate || new Date().toISOString().slice(0, 10)"
);
app = app.replaceAll("'2024-04-01'", "currentFY.start");
app = app.replaceAll("'2025-03-31'", "currentFY.end");

// Update the local Tally report's FY range dynamically as well.
const oldTallyDates = `    const tallyRequest = (report: string) => \`<?xml version="1.0"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY><EXPORTDATA><REQUESTDESC>
  <REPORTNAME>\${report}</REPORTNAME>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVFROMDATE>20260401</SVFROMDATE>
   <SVTODATE>20270331</SVTODATE>
  </STATICVARIABLES>
 </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>\`;`;

const newTallyDates = `    const now = new Date();
    const fyStartYear = now.getMonth() >= 3
      ? now.getFullYear()
      : now.getFullYear() - 1;
    const tallyFromDate = \`\${fyStartYear}0401\`;
    const tallyToDate = \`\${fyStartYear + 1}0331\`;

    const tallyRequest = (report: string) => \`<?xml version="1.0"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY><EXPORTDATA><REQUESTDESC>
  <REPORTNAME>\${report}</REPORTNAME>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVFROMDATE>\${tallyFromDate}</SVFROMDATE>
   <SVTODATE>\${tallyToDate}</SVTODATE>
  </STATICVARIABLES>
 </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>\`;`;

if (!server.includes(oldTallyDates)) {
  throw new Error('Could not locate Tally report date range; no files changed.');
}
server = server.replace(oldTallyDates, newTallyDates);

// Save backups and write only after all target sections were verified.
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
fs.copyFileSync(appPath, appPath + '.before-current-fy-' + stamp + '.bak');
fs.copyFileSync(serverPath, serverPath + '.before-current-fy-' + stamp + '.bak');
fs.writeFileSync(appPath, app);
fs.writeFileSync(serverPath, server);

console.log('Current FY date patch applied. Backups created.');

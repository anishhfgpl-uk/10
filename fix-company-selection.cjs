const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

const oldState =
  "const [showCompanySelection, setShowCompanySelection] = useState<boolean>(true);";
const newState =
  "const [showCompanySelection, setShowCompanySelection] = useState<boolean>(() => sessionStorage.getItem('ledger-company-opened') !== 'true');";

if (!s.includes(oldState)) {
  console.error("STOP: Expected state line not found. No changes made.");
  process.exit(1);
}
if (!s.includes("      setShowCompanySelection(false);")) {
  console.error("STOP: Expected open-company line not found. No changes made.");
  process.exit(1);
}

const backup = file + ".before-selection-persist-" +
  new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-") + ".bak";

fs.copyFileSync(file, backup);
s = s.replace(oldState, newState);
s = s.replace(
  "      setShowCompanySelection(false);",
  "      sessionStorage.setItem('ledger-company-opened', 'true');\n      setShowCompanySelection(false);"
);

fs.writeFileSync(file, s, "utf8");
console.log("Patch applied. Backup:", backup);

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

function readToken() {
  const envText = readFileSync(".env", "utf8").trim();
  const match = envText.match(/(?:^|\n)\s*TUSHARE_TOKEN\s*=\s*(.+)\s*$/);
  return (match ? match[1] : envText).replace(/^["']|["']$/g, "").trim();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function toCsv(rows) {
  const header = ["ts_code", "trade_date", "open", "high", "low", "close", "vol"];
  return [
    header.join(","),
    ...rows.map((row) => header.map((key) => row[key] ?? "").join(","))
  ].join("\n");
}

const token = readToken();
const tsCode = process.argv[2] || "000001.SZ";
const end = new Date();
const start = new Date();
start.setDate(end.getDate() - 365);

const response = await fetch("https://api.tushare.pro", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_name: "daily",
    token,
    params: {
      ts_code: tsCode,
      start_date: formatDate(start),
      end_date: formatDate(end)
    },
    fields: "ts_code,trade_date,open,high,low,close,vol"
  })
});

const json = await response.json();
if (json.code !== 0) {
  throw new Error(json.msg || "Tushare request failed");
}

const fields = json.data.fields;
const rows = json.data.items
  .map((item) => Object.fromEntries(fields.map((field, index) => [field, item[index]])))
  .sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));

mkdirSync("data", { recursive: true });
writeFileSync("data/task1_daily_data.csv", `${toCsv(rows)}\n`, "utf8");
console.log(`Wrote data/task1_daily_data.csv with ${rows.length} rows for ${tsCode}.`);

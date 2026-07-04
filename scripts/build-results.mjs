import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const csv = readFileSync("data/task1_daily_data.csv", "utf8").trim();
const [head, ...lines] = csv.split(/\r?\n/);
const headers = head.split(",");
const rows = lines.map((line) => {
  const values = line.split(",");
  return Object.fromEntries(headers.map((key, index) => {
    const value = values[index];
    const number = Number(value);
    return [key, Number.isNaN(number) ? value : number];
  }));
});

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function rolling(values, n, fn) {
  return values.map((_, i) => i + 1 < n ? NaN : fn(values.slice(i + 1 - n, i + 1)));
}

function ema(values, span) {
  const alpha = 2 / (span + 1);
  const out = [];
  values.forEach((value, i) => out.push(i === 0 ? value : alpha * value + (1 - alpha) * out[i - 1]));
  return out;
}

function rsi(values, period = 14) {
  const out = Array(values.length).fill(NaN);
  for (let i = period; i < values.length; i += 1) {
    let gain = 0;
    let loss = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      const diff = values[j] - values[j - 1];
      if (diff >= 0) gain += diff;
      else loss -= diff;
    }
    out[i] = 100 - 100 / (1 + gain / (loss || 1e-9));
  }
  return out;
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "";
}

function svgChart(filename, title, series, { height = 300, decimals = 2 } = {}) {
  const width = 900;
  const pad = { left: 64, right: 24, top: 42, bottom: 42 };
  const all = series.flatMap((line) => line.values).filter(Number.isFinite);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const grid = Array.from({ length: 5 }, (_, i) => {
    const y = pad.top + innerH * (i / 4);
    const label = fmt(max - span * (i / 4), decimals);
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#d8dee6"/><text x="8" y="${y + 4}" font-size="14" font-family="SimSun">${label}</text>`;
  }).join("");
  const paths = series.map((line) => {
    let d = "";
    line.values.forEach((value, i) => {
      if (!Number.isFinite(value)) return;
      const x = pad.left + innerW * (i / Math.max(1, line.values.length - 1));
      const y = pad.top + innerH * ((max - value) / span);
      d += `${d ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
    });
    return `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="${line.width || 2}"/>`;
  }).join("");
  const legend = series.map((line, i) => `<text x="${pad.left + i * 140}" y="${height - 12}" font-size="14" font-family="SimSun" fill="${line.color}">${line.name}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${pad.left}" y="26" font-size="18" font-family="SimSun" font-weight="700">${title}</text>
${grid}
${paths}
${legend}
</svg>`;
  writeFileSync(`data/${filename}`, svg, "utf8");
}

mkdirSync("data", { recursive: true });
const closes = rows.map((row) => Number(row.close));
const volumes = rows.map((row) => Number(row.vol));
const rsi14 = rsi(closes);
const ema12 = ema(closes, 12);
const ema26 = ema(closes, 26);
const dif = ema12.map((value, i) => value - ema26[i]);
const dea = ema(dif, 9);
const macd = dif.map((value, i) => 2 * (value - dea[i]));
const mid = rolling(closes, 20, mean);
const sd = rolling(closes, 20, std);
const upper = mid.map((value, i) => value + 2 * sd[i]);
const lower = mid.map((value, i) => value - 2 * sd[i]);
const obv = [];
closes.forEach((close, i) => {
  if (i === 0) obv.push(0);
  else obv.push(obv[i - 1] + (close > closes[i - 1] ? volumes[i] : close < closes[i - 1] ? -volumes[i] : 0));
});

svgChart("close.svg", "Task 1 运行结果：每日收盘价", [{ name: "close", values: closes, color: "#1266d6" }]);
svgChart("rsi.svg", "Task 2 运行结果：RSI(14)", [{ name: "RSI", values: rsi14, color: "#1266d6" }]);
svgChart("macd.svg", "Task 2 运行结果：MACD", [
  { name: "DIF", values: dif, color: "#1266d6" },
  { name: "DEA", values: dea, color: "#d65a12" },
  { name: "MACD", values: macd, color: "#16704a", width: 1 }
], { decimals: 3 });
svgChart("boll.svg", "Task 2 运行结果：布林带", [
  { name: "close", values: closes, color: "#17212b" },
  { name: "upper", values: upper, color: "#d65a12" },
  { name: "mid", values: mid, color: "#1266d6" },
  { name: "lower", values: lower, color: "#d65a12" }
]);
svgChart("obv.svg", "Task 2 运行结果：OBV 能量潮", [{ name: "OBV", values: obv, color: "#16704a" }], { decimals: 0 });

const summary = {
  generated_at: new Date().toISOString(),
  ts_code: rows[0]?.ts_code,
  rows: rows.length,
  start_date: rows[0]?.trade_date,
  end_date: rows.at(-1)?.trade_date,
  latest_close: rows.at(-1)?.close,
  close_min: Math.min(...closes),
  close_max: Math.max(...closes),
  close_mean: mean(closes),
  close_std: std(closes),
  latest_rsi: rsi14.at(-1),
  latest_dif: dif.at(-1),
  latest_dea: dea.at(-1),
  latest_macd: macd.at(-1),
  latest_boll_upper: upper.at(-1),
  latest_boll_mid: mid.at(-1),
  latest_boll_lower: lower.at(-1),
  latest_obv: obv.at(-1)
};

writeFileSync("data/run_summary.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(`Built result charts and summary for ${summary.ts_code}, ${summary.rows} rows.`);

function copyCode(id) {
  const node = document.getElementById(id);
  if (!node) return;
  navigator.clipboard.writeText(node.textContent).then(() => {
    const button = document.querySelector(`[data-copy="${id}"]`);
    if (!button) return;
    const old = button.textContent;
    button.textContent = "已复制";
    setTimeout(() => {
      button.textContent = old;
    }, 1200);
  });
}

function drawLineChart(canvasId, series, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, rect.width) * ratio;
  canvas.height = Math.max(220, rect.height) * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  ctx.clearRect(0, 0, width, height);
  const pad = { left: 48, right: 18, top: 18, bottom: 32 };
  const values = series.flatMap((line) => line.values).filter(Number.isFinite);
  if (values.length === 0) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  ctx.strokeStyle = "#d8dee6";
  ctx.lineWidth = 1;
  ctx.font = "10.5pt SimSun";
  ctx.fillStyle = "#5c6875";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height - pad.top - pad.bottom) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText((max - span * (i / 4)).toFixed(options.decimals ?? 2), 6, y + 4);
  }
  series.forEach((line) => {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width || 2;
    ctx.beginPath();
    line.values.forEach((value, idx) => {
      if (!Number.isFinite(value)) return;
      const x = pad.left + (width - pad.left - pad.right) * (idx / Math.max(1, line.values.length - 1));
      const y = pad.top + (height - pad.top - pad.bottom) * ((max - value) / span);
      if (idx === 0 || !Number.isFinite(line.values[idx - 1])) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  if (options.title) {
    ctx.fillStyle = "#17212b";
    ctx.fillText(options.title, pad.left, 14);
  }
}

function toCsv(rows) {
  const header = ["trade_date", "open", "high", "low", "close", "vol"];
  return [
    header.join(","),
    ...rows.map((row) => header.map((key) => row[key] ?? "").join(","))
  ].join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadDefaultCsv() {
  const response = await fetch("data/task1_daily_data.csv", { cache: "no-store" });
  if (!response.ok) throw new Error("未找到 data/task1_daily_data.csv，请先运行 npm run fetch:data。");
  return response.text();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(",").map((item) => item.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(header.map((key, i) => {
      const value = values[i]?.trim();
      const number = Number(value);
      return [key, value === "" || Number.isNaN(number) ? value : number];
    }));
  });
}

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
  values.forEach((value, i) => {
    out.push(i === 0 ? value : alpha * value + (1 - alpha) * out[i - 1]);
  });
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
    const rs = loss === 0 ? 100 : gain / loss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function normalizeRows(rows) {
  return rows
    .map((row) => ({
      trade_date: String(row.trade_date ?? ""),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      vol: Number(row.vol)
    }))
    .filter((row) => row.trade_date && Number.isFinite(row.close))
    .sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
}

async function fetchTushareDaily() {
  const token = document.getElementById("tokenInput")?.value.trim();
  const tsCode = document.getElementById("stockInput")?.value.trim() || "000001.SZ";
  const status = document.getElementById("fetchStatus");
  const preview = document.getElementById("csvPreview");
  if (!token) {
    status.textContent = "请先输入 Tushare token。";
    return;
  }
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 365);
  const fmt = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  status.textContent = "正在请求 Tushare 真实数据...";
  try {
    const response = await fetch("https://api.tushare.pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_name: "daily",
        token,
        params: { ts_code: tsCode, start_date: fmt(start), end_date: fmt(end) },
        fields: "ts_code,trade_date,open,high,low,close,vol"
      })
    });
    const json = await response.json();
    if (json.code !== 0) throw new Error(json.msg || "Tushare 返回错误");
    const fields = json.data.fields;
    const rows = normalizeRows(json.data.items.map((item) => Object.fromEntries(fields.map((field, i) => [field, item[i]]))));
    if (rows.length === 0) throw new Error("没有获取到数据，请检查股票代码或权限。");
    const csv = toCsv(rows);
    preview.value = csv;
    drawLineChart("closeChart", [{ values: rows.map((row) => row.close), color: "#1266d6" }], { title: `${tsCode} 每日收盘价` });
    document.getElementById("downloadRealCsv").onclick = () => downloadText("task1_daily_data.csv", csv);
    status.textContent = `已获取 ${rows.length} 条真实日线数据。`;
  } catch (error) {
    status.textContent = `网页直接请求失败：${error.message}。若浏览器提示 CORS，这是 GitHub Pages 静态网页限制；请运行 notebook 获取真实数据。`;
  }
}

async function initTask1RealData() {
  const preview = document.getElementById("csvPreview");
  const status = document.getElementById("fetchStatus");
  if (!preview || !status) return;
  try {
    const csv = await loadDefaultCsv();
    const rows = normalizeRows(parseCsv(csv));
    preview.value = csv;
    drawLineChart("closeChart", [{ values: rows.map((row) => row.close), color: "#1266d6" }], { title: "真实 Tushare 每日收盘价" });
    document.getElementById("downloadRealCsv").onclick = () => downloadText("task1_daily_data.csv", csv);
    status.textContent = `已加载仓库中的真实 Tushare CSV，共 ${rows.length} 条。`;
  } catch (error) {
    status.textContent = error.message;
  }
}

async function loadRunSummary() {
  const response = await fetch("data/run_summary.json", { cache: "no-store" });
  if (!response.ok) return;
  const summary = await response.json();
  const set = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  const fixed = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "";
  set("summaryCode", summary.ts_code);
  set("summaryRows", summary.rows);
  set("summaryStart", summary.start_date);
  set("summaryEnd", summary.end_date);
  set("summaryClose", fixed(summary.latest_close));
  set("summaryMean", fixed(summary.close_mean));
  set("summaryStd", fixed(summary.close_std));
  set("summaryRsi", fixed(summary.latest_rsi));
  set("summaryMacd", fixed(summary.latest_macd, 4));
}

function diagnose(rows) {
  const closes = rows.map((row) => Number(row.close)).filter(Number.isFinite);
  return {
    rows: rows.length,
    missingClose: rows.length - closes.length,
    min: Math.min(...closes),
    max: Math.max(...closes),
    mean: mean(closes),
    std: std(closes)
  };
}

function renderDiagnosis(stats) {
  const target = document.getElementById("diagnosis");
  if (!target) return;
  target.innerHTML = `
    <table>
      <tr><th>行数</th><td>${stats.rows}</td><th>收盘价缺失</th><td>${stats.missingClose}</td></tr>
      <tr><th>最小值</th><td>${stats.min.toFixed(4)}</td><th>最大值</th><td>${stats.max.toFixed(4)}</td></tr>
      <tr><th>均值</th><td>${stats.mean.toFixed(4)}</td><th>标准差</th><td>${stats.std.toFixed(4)}</td></tr>
    </table>`;
}

function analyzeRows(rows) {
  rows = normalizeRows(rows);
  if (rows.length === 0) return;
  const closes = rows.map((row) => row.close);
  const volumes = rows.map((row) => row.vol);
  const rsi14 = rsi(closes, 14);
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
  renderDiagnosis(diagnose(rows));
  drawLineChart("rsiChart", [{ values: rsi14, color: "#1266d6" }], { title: "RSI(14)" });
  drawLineChart("macdChart", [
    { values: dif, color: "#1266d6" },
    { values: dea, color: "#d65a12" },
    { values: macd, color: "#16704a", width: 1 }
  ], { title: "MACD: DIF / DEA / MACD", decimals: 3 });
  drawLineChart("bollChart", [
    { values: closes, color: "#17212b" },
    { values: upper, color: "#d65a12", width: 1.5 },
    { values: mid, color: "#1266d6", width: 1.5 },
    { values: lower, color: "#d65a12", width: 1.5 }
  ], { title: "布林带: close / upper / mid / lower" });
  drawLineChart("obvChart", [{ values: obv, color: "#16704a" }], { title: "OBV 能量潮", decimals: 0 });
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyCode(button.dataset.copy));
  });
  document.getElementById("fetchTushare")?.addEventListener("click", fetchTushareDaily);
  initTask1RealData();
  loadRunSummary();
  loadDefaultCsv().then((csv) => {
    if (document.getElementById("diagnosis")) analyzeRows(parseCsv(csv));
  }).catch(() => {});
  document.getElementById("csvInput")?.addEventListener("change", async (event) => {
    const selected = event.target.files[0];
    if (!selected) return;
    analyzeRows(parseCsv(await selected.text()));
  });
});

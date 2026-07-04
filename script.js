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
  const opens = rows.map((row) => Number(row.open)).filter(Number.isFinite);
  const highs = rows.map((row) => Number(row.high)).filter(Number.isFinite);
  const lows = rows.map((row) => Number(row.low)).filter(Number.isFinite);
  const vols = rows.map((row) => Number(row.vol)).filter(Number.isFinite);
  
  // 计算涨跌幅
  const priceChanges = [];
  for (let i = 1; i < closes.length; i++) {
    priceChanges.push((closes[i] - closes[i-1]) / closes[i-1] * 100);
  }
  
  return {
    rows: rows.length,
    missingClose: rows.length - closes.length,
    closeMin: Math.min(...closes),
    closeMax: Math.max(...closes),
    closeMean: mean(closes),
    closeStd: std(closes),
    openMean: mean(opens),
    highMean: mean(highs),
    lowMean: mean(lows),
    volMean: mean(vols),
    priceChangeMean: priceChanges.length > 0 ? mean(priceChanges) : 0,
    priceChangeStd: priceChanges.length > 0 ? std(priceChanges) : 0,
    priceChangeMax: priceChanges.length > 0 ? Math.max(...priceChanges) : 0,
    priceChangeMin: priceChanges.length > 0 ? Math.min(...priceChanges) : 0
  };
}

function renderAllDiagnosisResults(rows) {
  // 1. 加载数据结果
  const loadDataTarget = document.getElementById("loadDataResultContent");
  if (loadDataTarget) {
    let headStr = "数据前5行：\n";
    const headers = Object.keys(rows[0]);
    headStr += headers.join("\t") + "\n";
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      headStr += headers.map(h => row[h]).join("\t") + "\n";
    }
    loadDataTarget.textContent = headStr;
  }
  
  // 2. 缺失值检查结果
  const missingTarget = document.getElementById("missingResultContent");
  if (missingTarget) {
    const headers = Object.keys(rows[0]);
    let missingStr = "各字段缺失值数量：\n";
    headers.forEach(header => {
      let missingCount = 0;
      rows.forEach(row => {
        if (row[header] === undefined || row[header] === null || row[header] === "") {
          missingCount++;
        }
      });
      missingStr += `${header}: ${missingCount}\n`;
    });
    missingTarget.textContent = missingStr;
  }
  
  // 3. 数据基本信息
  const infoTarget = document.getElementById("infoResultContent");
  if (infoTarget) {
    const dates = rows.map(r => String(r.trade_date)).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const date1 = new Date(minDate.substring(0, 4), parseInt(minDate.substring(4, 6)) - 1, minDate.substring(6, 8));
    const date2 = new Date(maxDate.substring(0, 4), parseInt(maxDate.substring(4, 6)) - 1, maxDate.substring(6, 8));
    const daysSpan = Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
    
    let infoStr = "";
    infoStr += `数据行数：${rows.length}\n`;
    infoStr += `数据列数：${Object.keys(rows[0]).length}\n`;
    infoStr += `起始日期：${minDate}\n`;
    infoStr += `结束日期：${maxDate}\n`;
    infoStr += `时间跨度：${daysSpan} 天`;
    infoTarget.textContent = infoStr;
  }
  
  // 4. 描述性统计量
  const describeTarget = document.getElementById("describeResultContent");
  if (describeTarget) {
    const numericFields = ['open', 'high', 'low', 'close', 'vol'];
    let describeStr = "描述性统计量：\n";
    describeStr += "\t";
    numericFields.forEach(field => describeStr += `${field}\t`);
    describeStr += "\n";
    
    const stats = {};
    numericFields.forEach(field => {
      const values = rows.map(r => Number(r[field])).filter(v => !isNaN(v));
      if (values.length > 0) {
        stats[field] = {
          count: values.length,
          mean: mean(values),
          std: std(values),
          min: Math.min(...values),
          max: Math.max(...values),
          p25: percentile(values, 25),
          p50: percentile(values, 50),
          p75: percentile(values, 75)
        };
      }
    });
    
    describeStr += `count\t`;
    numericFields.forEach(field => describeStr += `${stats[field]?.count || 0}\t`);
    describeStr += "\n";
    describeStr += `mean\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.mean || 0).toFixed(4)}\t`);
    describeStr += "\n";
    describeStr += `std\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.std || 0).toFixed(4)}\t`);
    describeStr += "\n";
    describeStr += `min\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.min || 0).toFixed(4)}\t`);
    describeStr += "\n";
    describeStr += `25%\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.p25 || 0).toFixed(4)}\t`);
    describeStr += "\n";
    describeStr += `50%\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.p50 || 0).toFixed(4)}\t`);
    describeStr += "\n";
    describeStr += `75%\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.p75 || 0).toFixed(4)}\t`);
    describeStr += "\n";
    describeStr += `max\t`;
    numericFields.forEach(field => describeStr += `${(stats[field]?.max || 0).toFixed(4)}\t`);
    
    describeTarget.textContent = describeStr;
  }
  
  // 5. 价格涨跌幅分析
  const changeTarget = document.getElementById("changeResultContent");
  if (changeTarget) {
    const closes = rows.map(r => Number(r.close)).filter(v => !isNaN(v));
    const priceChanges = [];
    for (let i = 1; i < closes.length; i++) {
      priceChanges.push((closes[i] - closes[i-1]) / closes[i-1] * 100);
    }
    
    let changeStr = "涨跌幅统计：\n";
    if (priceChanges.length > 0) {
      changeStr += `平均日涨跌幅：${mean(priceChanges).toFixed(4)}%\n`;
      changeStr += `涨跌幅标准差：${std(priceChanges).toFixed(4)}%\n`;
      changeStr += `最大日涨幅：${Math.max(...priceChanges).toFixed(4)}%\n`;
      changeStr += `最大日跌幅：${Math.min(...priceChanges).toFixed(4)}%`;
    } else {
      changeStr += "数据不足，无法计算";
    }
    changeTarget.textContent = changeStr;
  }
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[sorted.length - 1];
  if (lower < 0) return sorted[0];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function renderDiagnosis(stats) {
  const target = document.getElementById("diagnosis");
  if (!target) return;
  target.innerHTML = `
    <h3 style="font-size:12pt;margin-top:0;margin-bottom:10px;">数据诊断报告</h3>
    <table>
      <tr><th colspan="4" style="background:#e8f0fe;">基本信息</th></tr>
      <tr><th>数据行数</th><td>${stats.rows}</td><th>收盘价缺失</th><td>${stats.missingClose}</td></tr>
      <tr><th colspan="4" style="background:#e8f0fe;">价格统计</th></tr>
      <tr><th>收盘最小值</th><td>${stats.closeMin.toFixed(4)}</td><th>收盘最大值</th><td>${stats.closeMax.toFixed(4)}</td></tr>
      <tr><th>收盘均值</th><td>${stats.closeMean.toFixed(4)}</td><th>收盘标准差</th><td>${stats.closeStd.toFixed(4)}</td></tr>
      <tr><th>开盘均值</th><td>${stats.openMean.toFixed(4)}</td><th>最高均值</th><td>${stats.highMean.toFixed(4)}</td></tr>
      <tr><th>最低均值</th><td>${stats.lowMean.toFixed(4)}</td><th>成交量均值</th><td>${stats.volMean.toFixed(2)}</td></tr>
      <tr><th colspan="4" style="background:#e8f0fe;">涨跌幅统计</th></tr>
      <tr><th>平均涨跌幅</th><td>${stats.priceChangeMean.toFixed(4)}%</td><th>涨跌幅标准差</th><td>${stats.priceChangeStd.toFixed(4)}%</td></tr>
      <tr><th>最大涨幅</th><td>${stats.priceChangeMax.toFixed(4)}%</td><th>最大跌幅</th><td>${stats.priceChangeMin.toFixed(4)}%</td></tr>
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
  renderAllDiagnosisResults(rows);
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
  
  // Task 2 加载诊断按钮
  document.getElementById("loadDiagnosis")?.addEventListener("click", async () => {
    try {
      const csv = await loadDefaultCsv();
      analyzeRows(parseCsv(csv));
    } catch (error) {
      const target = document.getElementById("diagnosis");
      if (target) target.innerHTML = `<p style="color:#d65a12;">加载失败：${error.message}</p>`;
    }
  });
  
  // Task 2 默认加载
  loadDefaultCsv().then((csv) => {
    if (document.getElementById("diagnosis")) analyzeRows(parseCsv(csv));
  }).catch(() => {});
  
  document.getElementById("csvInput")?.addEventListener("change", async (event) => {
    const selected = event.target.files[0];
    if (!selected) return;
    analyzeRows(parseCsv(await selected.text()));
  });
});

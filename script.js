function copyCode(id) {
  const node = document.getElementById(id);
  if (!node) return;
  navigator.clipboard.writeText(node.textContent).then(() => {
    const button = document.querySelector(`[data-copy="${id}"]`);
    if (button) {
      const old = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => {
        button.textContent = old;
      }, 1200);
    }
  });
}

function makeDemoPrices(days = 242) {
  const rows = [];
  let close = 12.8;
  const start = new Date("2025-07-01");
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const wave = Math.sin(i / 13) * 0.13 + Math.cos(i / 29) * 0.08;
    close = Math.max(8, close * (1 + wave / 10 + (i % 17 - 8) / 2200));
    const open = close * (1 + Math.sin(i / 7) / 80);
    const high = Math.max(open, close) * 1.018;
    const low = Math.min(open, close) * 0.982;
    rows.push({
      trade_date: date.toISOString().slice(0, 10).replaceAll("-", ""),
      open,
      high,
      low,
      close,
      vol: 100000 + (i % 31) * 2300
    });
  }
  return rows;
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
  const pad = { left: 46, right: 16, top: 18, bottom: 32 };
  const values = series.flatMap((line) => line.values).filter((v) => Number.isFinite(v));
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
    const label = (max - span * (i / 4)).toFixed(options.decimals ?? 2);
    ctx.fillText(label, 6, y + 4);
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
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => Number.isFinite(row[key]) ? row[key].toFixed(4) : row[key]).join(","));
  }
  return lines.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function initTask1Demo() {
  const rows = makeDemoPrices();
  drawLineChart("closeChart", [{ values: rows.map((row) => row.close), color: "#1266d6" }], { title: "模拟每日收盘价" });
  const csv = toCsv(rows);
  const preview = document.getElementById("csvPreview");
  if (preview) preview.value = csv.split("\n").slice(0, 9).join("\n");
  const button = document.getElementById("downloadDemoCsv");
  if (button) button.addEventListener("click", () => downloadText("task1_demo_daily.csv", csv));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function rolling(values, n, fn) {
  return values.map((_, i) => {
    if (i + 1 < n) return NaN;
    return fn(values.slice(i + 1 - n, i + 1));
  });
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

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(",").map((item) => item.trim());
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(header.map((key, i) => [key, Number(values[i]) || values[i]]));
  });
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

function initTask2Demo() {
  let rows = makeDemoPrices();
  const run = () => {
    const closes = rows.map((row) => Number(row.close));
    const highs = rows.map((row) => Number(row.high));
    const lows = rows.map((row) => Number(row.low));
    const volumes = rows.map((row) => Number(row.vol));
    const rsi14 = rsi(closes, 14);
    const dif = ema(closes, 12).map((v, i) => v - ema(closes, 26)[i]);
    const dea = ema(dif, 9);
    const macd = dif.map((v, i) => 2 * (v - dea[i]));
    const mid = rolling(closes, 20, mean);
    const sd = rolling(closes, 20, std);
    const upper = mid.map((v, i) => v + 2 * sd[i]);
    const lower = mid.map((v, i) => v - 2 * sd[i]);
    const obv = [];
    closes.forEach((close, i) => {
      if (i === 0) {
        obv.push(0);
        return;
      }
      const prev = closes[i - 1];
      obv.push(obv[i - 1] + (close > prev ? volumes[i] : close < prev ? -volumes[i] : 0));
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
  };
  run();
  const file = document.getElementById("csvInput");
  if (file) {
    file.addEventListener("change", async (event) => {
      const selected = event.target.files[0];
      if (!selected) return;
      rows = parseCsv(await selected.text());
      run();
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyCode(button.dataset.copy));
  });
  initTask1Demo();
  initTask2Demo();
});

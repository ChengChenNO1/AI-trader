import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const rootFiles = ["index.html", "task1.html", "task2.html", "agent.md", "README.md"];
const notebooks = ["notebooks/task1.ipynb", "notebooks/task2.ipynb"];

for (const file of [...rootFiles, ...notebooks]) {
  assert.ok(existsSync(file), `${file} should exist`);
}

const css = readFileSync("styles.css", "utf8");
assert.match(css, /font-family:\s*SimSun/, "styles.css should use SimSun");
assert.match(css, /font-size:\s*10\.5pt/, "styles.css should use fifth-size Chinese typography");
assert.match(css, /line-height:\s*1\.5/, "styles.css should use 1.5 line height");
assert.match(css, /text-align:\s*justify/, "styles.css should justify text");

for (const file of ["index.html", "task1.html", "task2.html"]) {
  const html = readFileSync(file, "utf8");
  assert.match(html, /styles\.css/, `${file} should load shared typography CSS`);
}

const task1 = readFileSync("task1.html", "utf8");
assert.match(task1, /量化交易有哪些优势/);
assert.match(task1, /K\s*线/);
assert.match(task1, /TUSHARE_TOKEN/);
assert.match(task1, /to_csv/);

const task2 = readFileSync("task2.html", "utf8");
assert.match(task2, /缺失值/);
assert.match(task2, /RSI/);
assert.match(task2, /MACD/);
assert.match(task2, /Bollinger Bands|布林带/);
assert.match(task2, /OBV|ATR|KDJ|均线/);

for (const file of notebooks) {
  const notebook = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(notebook.nbformat, 4);
  const source = JSON.stringify(notebook.cells);
  assert.match(source, /font-family:\s*SimSun/);
  assert.match(source, /TUSHARE_TOKEN|read_csv/);
}

console.log("Smoke checks passed.");

# AI-trader

量化交易课程作业静态网页，包含 task1 和 task2 两个页面，以及对应的本地可运行 Jupyter Notebook。

## 页面

- `index.html`: 作业导航首页
- `task1.html`: 量化交易基础、K 线/基本面/技术面解释、Tushare 获取股票日线数据与保存 CSV
- `task2.html`: 数据诊断、RSI/MACD/布林带/OBV 指标说明与可视化

## 本地运行 Notebook

1. 安装依赖：

```bash
pip install pandas matplotlib tushare jupyter
```

2. 设置 Tushare token，避免把密钥写入公开仓库：

```bash
set TUSHARE_TOKEN=你的token
```

PowerShell 可使用：

```powershell
$env:TUSHARE_TOKEN="你的token"
```

3. 打开 notebook：

```bash
jupyter notebook notebooks/task1.ipynb
jupyter notebook notebooks/task2.ipynb
```

## 字体格式

网页和 notebook 的说明文字统一设置为宋体、五号字、1.5 倍行距、0 段间距、两端对齐。

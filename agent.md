# agent.md

## 项目重要事项

- 项目为 GitHub Pages 静态站，根目录直接部署。
- 不在仓库中提交 Tushare token；真实数据获取通过本地环境变量 `TUSHARE_TOKEN` 完成。
- 页面文字格式要求：宋体、五号字（10.5pt）、1.5 倍行距、0 段间距、两端对齐。
- 每个任务页面都有对应 notebook：`notebooks/task1.ipynb`、`notebooks/task2.ipynb`。

## 本次开发记录

- 新建 task1/task2 静态页面和首页。
- 新建两个本地可运行 notebook。
- 新增 smoke test 检查页面与 notebook 的基础结构和格式要求。
- 本机 Codex 配置已加入 `tushareMcp`，当前会话通常需要重启后才能把该 MCP 暴露为可调用工具。
- 根据用户反馈，移除网页中的模拟行情数据。Task1 改为尝试直接请求 Tushare HTTP API 获取真实日线数据；Task2 改为只分析用户上传的真实 CSV。
- 用户已在 `.env` 填写 Tushare token。新增 `npm run fetch:data`，读取本地 token 生成 `data/task1_daily_data.csv`，网页默认加载该真实 CSV。

## 后续跟进

- GitHub Pages 使用 `main` 分支根目录发布。
- MCP 不能被 GitHub Pages 静态网页直接调用；如果浏览器直接请求 Tushare 受 CORS 限制，需要增加后端代理或改用 notebook/Python 本地运行。

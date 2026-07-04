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

## 后续跟进

- GitHub Pages 使用 `main` 分支根目录发布。
- 若要在浏览器中直接运行真实 Tushare 请求，需要额外后端代理；当前静态页只提供浏览器演示和本地 Python/notebook 运行路径。

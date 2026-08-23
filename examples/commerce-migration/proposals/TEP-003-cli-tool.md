# TEP-003: CLI Tool

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 无 CLI 工具。开发者需要手动编写入口脚本（如 `agent.js`）来创建 Application、注册 Module、启动服务。缺乏标准化的项目脚手架、开发服务器、测试运行器、部署工具。

## 当前替代方案

- 项目入口: 手动编写 `agent.js`，调用 `createTllOS()` → `createApplication()` → `registerModules()` → `app.start()`
- 测试: 手动编写 `tests/run-tests.js`，调用 `app.tests.runAll()`
- 开发服务器: 手动编写 `server.js`
- 项目初始化: 手动复制目录结构

## 提案

提供 `tll` CLI 工具，支持以下命令：

```bash
tll init <project-name> [--template commerce|cms|blank]
tll start [--port 3000] [--watch]
tll test [--module <name>] [--watch]
tll build [--target node|docker|lambda]
tll deploy [--target docker|aws|vercel]
tll graph [--output json|dot|png]
tll module create <name>
tll api create <module> <method> <path>
tll tool create <module> <name>
tll doctor  # 检查环境依赖
```

CLI 作为独立 npm 包 `@tll-os/cli`，不依赖 Runtime 核心。

## 预期收益

- 标准化项目结构，降低上手门槛
- 开发体验提升（热重载、自动重启）
- 一键部署，支持多种目标平台
- Application Graph 可视化导出

## 兼容性

纯新增能力，不影响 Runtime 核心。现有项目可继续使用手动入口脚本。

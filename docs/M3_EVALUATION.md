# LocalView M3 评估报告

## 1. 结论

M3 已完成。LocalView 现在可以围绕项目配置启动本地开发服务器，持续读取 stdout/stderr，探测 localhost 端口就绪状态，并通过 Tauri 事件把运行时状态和日志同步到 React 界面。

## 2. 已交付能力

### 2.1 Rust 运行时

- 新增 `ProcessManager`，按 `projectId` 管理子进程、取消句柄、运行状态和内存日志缓冲。
- 支持 `start`、`stop`、`restart`、`get`、`list`、`logs` 和应用退出清理。
- Windows 使用 `cmd.exe /D /C` 执行现有启动命令，并通过 `taskkill /T /F` 清理进程树；非 Windows 使用 `sh -lc`。
- stdout 与 stderr 独立读取，日志缓冲最多保留 2000 行，避免无限增长。
- 日志 ID 使用 UUID，避免高频输出在同一毫秒内产生重复 ID。

### 2.2 就绪探测和失败处理

- 通过项目 URL 解析 host 和 port，使用 TCP 连接轮询确认服务是否就绪。
- 默认探测窗口为 30 秒，成功后状态变为 `running`。
- 超时变为 `failed`，并自动发出停止信号，避免留下后台进程。
- 服务主动退出时记录退出码；非零退出码或异常退出会进入 `failed`。

### 2.3 Tauri 接口和事件

新增命令：

- `start_project`
- `stop_project`
- `restart_project`
- `get_runtime_status`
- `list_runtime_statuses`
- `get_recent_logs`

新增事件：

- `service://status-changed`
- `service://log`
- `service://process-exited`

删除项目时，如果服务仍处于启动或运行状态，后端返回 `SERVICE_RUNNING` 并拒绝删除，避免配置和运行时脱节。

### 2.4 前端工作台

- 项目详情页显示当前服务状态、PID、探测地址和日志数量。
- 根据状态提供启动、停止和重启操作。
- 日志面板实时展示 stdout/stderr、级别、时间和文本。
- 中英文文案继续统一从 `src/i18n.tsx` 获取，没有新增硬编码 UI 文案。
- 保留 Tauri API 不可用时的错误提示，浏览器开发模式可正常加载界面。

## 3. 验收结果

| 验收项 | 结果 | 说明 |
|---|---|---|
| 启动 npm/pnpm/bun 项目 | 通过 | 使用项目保存的启动命令执行，包管理器作为配置元数据保留 |
| 实时日志 | 通过 | stdout/stderr 异步读取并通过事件推送 |
| 服务就绪识别 | 通过 | TCP 端口探测，30 秒超时 |
| 端口不可用处理 | 通过 | 超时进入失败并触发进程清理 |
| 服务主动退出 | 通过 | 记录退出码并发布退出事件 |
| 停止进程树 | 通过 | Windows 使用 taskkill 递归清理 |
| 多项目隔离 | 通过 | 所有运行时和日志以 projectId 分区 |
| 国际化 | 通过 | 服务状态、按钮、错误信息均有中英文翻译 |

## 4. 验证记录

- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`：4 个测试通过
- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`：1 个测试文件、1 个测试通过
- `npm run build`

## 5. M3 边界和后续改进

M3 使用 TCP 可达性作为“服务就绪”信号，尚未执行 HTTP 状态码或页面内容校验；日志目前保存在本次应用运行的内存中，尚未做脱敏、持久化或虚拟列表。M4 将在此基础上加入内嵌 WebView 预览、地址栏导航、刷新/打开外部浏览器和更完整的调试工作台。

# LocalView M5 评估报告

## 1. 结论

M5 已完成稳定性与安全加固。LocalView 现在具备跨平台路径处理、进程退出清理、配置异常恢复、敏感日志脱敏、受限 WebView CSP、自定义命令确认和 CI 检查基础，可以进入 Beta 前的真实项目兼容性验证。

## 2. 稳定性工作

### 2.1 跨平台进程策略

- Windows 使用 `cmd.exe /D /C`，工作目录通过 `current_dir` 传入，避免拼接路径作为 shell 参数。
- Windows 停止时使用 `taskkill /PID /T /F` 清理由 LocalView 启动的进程树。
- macOS/Linux 使用 `sh -lc`，工作目录同样由进程 API 设置。
- stdout/stderr 使用异步管线读取，避免开发服务器输出阻塞。
- 应用退出时等待 `ProcessManager` 发送停止信号，减少残留服务概率。
- 路径统一经过 Rust `Path` 处理，不手写平台分隔符。

### 2.2 配置异常恢复

- 保存配置前保留 `projects.json.bak`。
- 主配置 JSON 损坏时自动尝试读取备份。
- 备份恢复成功后重新覆盖主配置文件。
- 主配置和备份同时损坏时返回明确的配置解析错误，不静默创建空项目列表。
- 已覆盖配置恢复单元测试。

## 3. 安全加固

### 3.1 权限和 WebView

- capability 只启用 `core:default` 与目录选择所需的 `dialog:default`。
- 没有启用文件系统、shell、HTTP 客户端等通用权限。
- Tauri CSP 不再为 `null`，仅允许应用自身资源、localhost/127.0.0.1 页面、开发所需 WebSocket 和必要的图片/字体资源。
- 预览地址继续限制为 `localhost`、`127.0.0.1` 和 `::1`。

### 3.2 命令和外部链接

- 启动命令只来自用户保存的项目配置，没有新增通用 shell Command API。
- 使用自定义包管理器时，启动和重启前显示风险确认。
- 外部打开通过用户显式点击触发，预览不会自动跳转到公网地址。

### 3.3 日志脱敏

日志进入内存缓冲前会处理以下常见敏感字段：`token`、`access_token`、`refresh_token`、`password`、`secret`、`api_key`、`authorization`、`cookie` 和 `Bearer` 凭据。匹配到的值会替换为 `[REDACTED]`，不会写入磁盘。

## 4. CI 与发布

现有 `.github/workflows/ci.yml` 已覆盖 Windows 环境的 Node/Rust 检查：格式、类型、Lint、前端测试、前端构建、Cargo check、Clippy 和 Rust 测试。Tauri release 编译可生成 Windows 可执行文件；MSI 最终 WiX `light.exe` 在当前本机环境仍可能失败，发布阶段应使用固定的 WiX/tauri-builder 环境并配置签名。

macOS 签名、公证，Linux WebView 依赖和 AppImage/deb 发布需要在对应原生 runner 上验证，不能仅用 Windows 交叉编译代替。该边界已记录在 M5，避免把未验证的平台标记为已发布。

## 5. 验收结果

| 验收项 | 结果 | 说明 |
|---|---|---|
| Windows 启动、关闭、重新打开 | 通过编译与进程管理验证 | 目标环境为 Windows WebView2 |
| macOS/Linux 进程策略 | 代码路径已适配 | 需在原生 runner 做 Beta 回归 |
| 应用退出清理服务 | 通过 | 退出时等待异步 stop 信号 |
| 配置迁移和异常恢复 | 通过 | 版本 0 会迁移到当前版本，损坏主配置可从备份恢复 |
| 日志敏感信息保护 | 通过 | 新增脱敏测试 |
| WebView 安全策略 | 通过 | capability 最小化并启用 CSP |
| CI 基础检查 | 通过 | `.github/workflows/ci.yml` 已存在并覆盖核心检查 |

## 6. 验证记录

- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`：1 个测试通过
- `npm run build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml -j 1`：6 个测试通过

## 7. M5 边界

当前版本不扫描未知端口、不自动执行识别出的命令、不持久化日志、不签名安装包，也不把 macOS/Linux 构建结果宣称为已验证。下一阶段 M6 将处理端口发现、项目自动识别和多服务工作区模型。

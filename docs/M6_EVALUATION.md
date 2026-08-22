# LocalView M6 评估报告

## 1. 结论

M6 已完成。LocalView 在 M5 的稳定性和安全边界上增加了 Beta 级效率能力：扫描受限的本地端口、识别项目脚本与框架、保存可扩展的多服务配置，并提供桌面/平板/手机/自适应预览尺寸。

## 2. 端口发现

- 新增 `scan_local_ports` Tauri 命令。
- 默认扫描 `3000-3099`，单次最多 128 个端口。
- 先进行 TCP 连接，再发送轻量 HTTP HEAD 请求获取 Server 和 HMR 提示。
- 结果只作为候选服务展示，不会自动写入项目配置，也不会自动执行命令。
- 扫描目标固定为 `127.0.0.1`，每个端口有超时上限。
- 前端允许将候选地址带入当前预览历史。

## 3. 项目自动识别

- 新增 `detect_project` Tauri 命令。
- 读取项目目录下的 `package.json`，提取最多 20 个 scripts。
- 按 `dev`、`start` 优先级标记推荐脚本。
- 根据 lockfile 识别 npm、pnpm、yarn、bun。
- 识别 Vite、Next.js、Astro、Angular 和 Create React App。
- 提供默认端口建议，但不静默执行、不自动保存。
- 目录不存在、JSON 损坏等情况返回明确错误。

## 4. 多服务模型

`Project` 和 `ProjectInput` 新增可选的 `services` 字段：

```text
Project
└── services[]
    ├── id
    ├── name
    ├── startCommand
    ├── workingDirectory
    ├── url
    ├── port
    └── packageManager
```

- 旧版本 `projects.json` 缺少 `services` 字段时自动兼容。
- 新建旧式项目时生成 `service_main` 默认服务。
- 当前 M6 保持单项目主服务运行时，避免在 RuntimeRegistry 未扩展前引入进程串线风险。
- 数据模型已为 M7 多服务并行启动、独立日志和启动顺序预留边界。

## 5. 响应式预览

预览工具栏新增四种视口模式：

- 自适应：占满预览区域；
- 桌面：默认宽度；
- 平板：最大宽度 768px；
- 手机：最大宽度 390px。

视口变化只影响 iframe 容器，不改变服务进程、地址历史和日志状态。

## 6. 新增接口

- `scan_local_ports(startPort, endPort, timeoutMs)`
- `detect_project(rootPath)`

前端封装：

- `scanLocalPorts()`
- `detectProject(rootPath)`

## 7. 验收结果

| 验收项          | 结果 | 说明                                 |
| --------------- | ---- | ------------------------------------ |
| 受限端口扫描    | 通过 | 默认 100 个端口，最大 128 个         |
| HTTP 元数据提示 | 通过 | Server 和 HMR 特征提示               |
| 项目脚本识别    | 通过 | package.json scripts，dev/start 优先 |
| 包管理器识别    | 通过 | npm、pnpm、yarn、bun lockfile        |
| 框架识别        | 通过 | Vite、Next.js、Astro、Angular、CRA   |
| 多服务配置兼容  | 通过 | 旧配置自动生成主服务                 |
| 响应式预览      | 通过 | 自适应、桌面、平板、手机             |
| 不自动执行建议  | 通过 | 识别和扫描结果均需用户确认           |

## 8. 验证记录

- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml -j 1`：8 个测试通过

## 9. M6 边界

M6 不扫描公网或任意地址，不自动新增项目，不自动运行识别出的命令，也不承诺多服务并行运行已经完成。M7 将聚焦签名发布、安装升级、跨平台原生回归和 Beta 发布流程。

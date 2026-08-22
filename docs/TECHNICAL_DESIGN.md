# LocalView 技术设计文档

> 版本：0.1.0
>
> 状态：M5 实现基线
>
> 产品定位：专为本地开发服务器设计的极简桌面浏览器与预览调试工作台

## 1. 文档目标

本文档用于指导 LocalView 的产品拆分、技术选型、工程实现、测试和发布。目标不是实现一个通用浏览器，而是提供一套围绕 `localhost`、开发服务器和本地项目的高效工作流。

本文档默认采用：

- Tauri 2
- Rust
- React + TypeScript
- Vite
- 系统 WebView
- JSON 文件作为当前本地持久化方案，保留备份恢复路径

当前实现已完成 M1-M5。后续如果系统 WebView 无法满足高级调试需求，应先把调试能力拆成独立模块，再评估是否需要更换整个技术栈。

## 2. 产品定义

### 2.1 核心问题

开发者通常需要频繁地：

1. 启动项目的开发服务器；
2. 记住或查找端口号；
3. 在多个 localhost 页面之间切换；
4. 反复刷新页面并观察构建结果；
5. 在浏览器、终端和编辑器之间切换；
6. 检查服务是否启动、端口是否被占用以及页面为何无法访问。

LocalView 将这些操作集中到一个轻量桌面应用中。

### 2.2 产品边界

LocalView 应该是：

- 本地开发服务启动器；
- localhost 项目管理器；
- 本地页面预览器；
- 面向开发者的轻量调试入口。

LocalView 不应该在第一阶段成为：

- 支持账号同步的通用浏览器；
- 包含完整浏览器扩展生态的浏览器；
- 自带完整 Chromium 内核的浏览器；
- 远程服务器运维平台。

### 2.3 核心用户流程

```text
添加项目目录
    ↓
识别启动命令和默认端口
    ↓
启动开发服务器
    ↓
等待端口可用
    ↓
打开预览页面
    ↓
刷新 / 查看日志 / 打开 DevTools
    ↓
停止服务或关闭项目
```

## 3. MVP 范围

### 3.1 必须实现

- 创建、编辑、删除本地项目配置；
- 手动输入 localhost 地址；
- 检测指定端口是否可访问；
- 启动和停止项目开发服务器；
- 捕获开发服务器 stdout/stderr；
- 在应用窗口内预览页面；
- 页面刷新、后退、前进；
- 项目搜索和最近访问记录；
- 快捷键打开 DevTools；
- 启动失败、端口占用、连接超时等错误提示；
- 应用退出时按配置清理由 LocalView 启动的进程。

### 3.2 第二阶段

- 自动扫描常用本地端口；
- 自动识别 Vite、Next.js、Vue CLI 等项目；
- 同一项目多个服务；
- 移动端尺寸预览；
- 多窗口或分屏对比；
- 端口、路径和命令模板；
- 系统托盘；
- 项目级环境变量；
- 页面截图与复制调试信息。

### 3.3 暂不实现

- 浏览器账号体系；
- 云同步；
- 浏览器扩展市场；
- 自定义浏览器内核；
- 任意远程网页的完整浏览能力；
- 自动修改用户项目文件。

## 4. 技术选型

| 层级      | 技术                                        | 选择理由                             |
| --------- | ------------------------------------------- | ------------------------------------ |
| 桌面容器  | Tauri 2                                     | 体积小、启动快、原生能力完整         |
| 原生逻辑  | Rust                                        | 适合进程、端口、文件和系统能力管理   |
| UI        | React + TypeScript                          | 组件生态成熟，适合复杂状态交互       |
| 构建工具  | Vite                                        | 与前端开发生态兼容，开发反馈快       |
| 页面渲染  | 系统 WebView                                | 复用操作系统能力，降低安装包体积     |
| 状态管理  | Zustand 或 React Context                    | MVP 阶段保持简单，避免过度架构       |
| 本地存储  | JSON 起步，SQLite 可选                      | 项目数量较少时 JSON 足够，后续可迁移 |
| Rust 异步 | Tokio                                       | 处理进程输出、端口轮询和任务取消     |
| 日志      | tracing                                     | 结构化日志、可配置级别               |
| 测试      | Rust unit/integration + Vitest + Playwright | 覆盖核心逻辑与关键用户流程           |

## 5. 总体架构

```text
┌─────────────────────────────────────────┐
│              React UI                   │
│ 项目列表 / 服务状态 / 预览 / 日志 / 设置 │
└──────────────────┬──────────────────────┘
                   │ Tauri invoke / event
┌──────────────────▼──────────────────────┐
│              Tauri Commands              │
│ 项目管理 / 服务控制 / 端口检测 / 设置管理 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│              Rust Core                   │
│ ProjectStore / ProcessManager / Probe    │
│ EventBus / AppState / ErrorMapper        │
└───────┬──────────┬──────────┬────────────┘
        │          │          │
   文件系统     子进程管理    TCP/HTTP
        │          │          │
   项目配置   npm/pnpm/bun   localhost 服务
```

### 5.1 前端职责

- 呈现项目和服务状态；
- 发送用户操作命令；
- 订阅 Rust 事件；
- 管理临时 UI 状态；
- 渲染错误、日志和加载状态；
- 不直接执行 shell 命令或访问任意本地文件。

### 5.2 Rust 职责

- 校验路径、命令和 URL；
- 管理由应用启动的子进程；
- 检测端口和 HTTP 可用性；
- 持久化项目配置；
- 发出服务状态与日志事件；
- 应用退出时执行清理；
- 统一处理跨平台差异。

## 6. 目录结构

建议的工程结构如下：

```text
localview/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ProjectList/
│   │   ├── ServiceStatus/
│   │   ├── PreviewToolbar/
│   │   ├── LogPanel/
│   │   └── EmptyState/
│   ├── stores/
│   │   ├── projectStore.ts
│   │   └── runtimeStore.ts
│   ├── lib/
│   │   ├── tauri.ts
│   │   └── format.ts
│   ├── types/
│   │   └── project.ts
│   └── styles/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── state.rs
│   │   ├── commands/
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── process_manager.rs
│   │   │   ├── port_probe.rs
│   │   │   ├── project_store.rs
│   │   │   └── shutdown.rs
│   │   └── errors.rs
│   ├── capabilities/
│   ├── tauri.conf.json
│   └── Cargo.toml
├── docs/
├── package.json
└── README.md
```

## 7. 核心数据模型

### 7.1 Project

```ts
type Project = {
  id: string;
  name: string;
  rootPath: string;
  startCommand?: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun" | "custom";
  workingDirectory?: string;
  url: string;
  port?: number;
  autoStart: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
};
```

### 7.2 RuntimeService

```ts
type RuntimeService = {
  projectId: string;
  status: "idle" | "starting" | "running" | "stopping" | "stopped" | "failed";
  pid?: number;
  detectedUrl?: string;
  startedAt?: string;
  exitCode?: number;
  error?: string;
};
```

### 7.3 配置文件

MVP 可以保存到应用数据目录下的 `projects.json`。示例：

```json
{
  "version": 1,
  "projects": [
    {
      "id": "project_01",
      "name": "Demo App",
      "rootPath": "D:/projects/demo-app",
      "startCommand": "npm run dev",
      "packageManager": "npm",
      "url": "http://localhost:5173",
      "port": 5173,
      "autoStart": false,
      "createdAt": "2026-08-21T00:00:00Z",
      "updatedAt": "2026-08-21T00:00:00Z"
    }
  ]
}
```

保存时必须采用临时文件写入后替换的方式，避免应用崩溃导致配置文件损坏。

## 8. Tauri Command API

前端只通过白名单 Command 与 Rust 通信。

| Command               | 参数                 | 返回值           | 说明                     |
| --------------------- | -------------------- | ---------------- | ------------------------ |
| `list_projects`       | 无                   | `Project[]`      | 获取项目列表             |
| `create_project`      | `CreateProjectInput` | `Project`        | 创建项目                 |
| `update_project`      | `UpdateProjectInput` | `Project`        | 更新配置                 |
| `delete_project`      | `projectId`          | `void`           | 删除配置，不删除项目文件 |
| `start_project`       | `projectId`          | `RuntimeService` | 启动开发服务器           |
| `stop_project`        | `projectId`          | `void`           | 停止由应用启动的服务     |
| `restart_project`     | `projectId`          | `RuntimeService` | 重启服务                 |
| `get_runtime_status`  | `projectId`          | `RuntimeService` | 查询当前状态             |
| `probe_url`           | `url`                | `ProbeResult`    | 检测页面可访问性         |
| `get_recent_logs`     | `projectId`          | `LogLine[]`      | 获取缓存日志             |
| `scan_ports`          | `ScanOptions`        | `PortInfo[]`     | 扫描本地端口             |
| `open_project_folder` | `projectId`          | `void`           | 使用系统文件管理器打开   |

事件建议：

```text
service://status-changed
service://log
service://process-exited
service://probe-completed
```

事件 payload 必须包含 `projectId`，避免多个项目同时运行时前端错配日志或状态。

## 9. 进程管理设计

### 9.1 启动流程

1. 校验项目目录存在且为目录；
2. 校验启动命令不为空；
3. 检查该项目是否已有受 LocalView 管理的进程；
4. 创建子进程并设置工作目录；
5. 订阅 stdout/stderr；
6. 将状态设置为 `starting`；
7. 轮询目标端口或 URL；
8. 成功后设置为 `running` 并通知前端；
9. 超时后终止或标记为 `failed`，由配置决定。

### 9.2 停止流程

LocalView 只能停止自己启动并记录过 PID 的进程。不能根据端口直接杀掉未知进程。

停止时应：

- 先发送温和终止信号；
- 等待有限时间；
- 仍未退出时再使用平台对应的强制终止方式；
- 清除运行时映射；
- 发出最终状态事件。

Windows、macOS、Linux 的进程树行为不同。实际实现需要确保停止的是整个开发服务器进程树，而不是只停止 shell 包装进程。

### 9.3 命令执行安全

- 不把用户输入拼接成不可控的 shell 字符串；
- 优先使用程序名和参数数组；
- 自定义命令必须明确提示用户其会执行本地命令；
- 禁止默认以管理员权限运行；
- 路径必须规范化并在展示前进行脱敏处理；
- 记录启动命令时不要保存敏感环境变量值。

## 10. 端口与 URL 探测

探测分为两层：

1. TCP 连接探测：判断端口是否有服务监听；
2. HTTP 探测：判断服务是否能够返回响应。

建议默认参数：

- 连接超时：500ms；
- 启动等待总时长：30秒；
- 轮询间隔：250ms；
- 默认只探测 `127.0.0.1`、`localhost` 和用户明确输入的地址；
- 默认不扫描公网地址。

HTTP 状态码不应简单地全部视为失败。开发服务器返回 404、500 或带有特殊 HMR 响应时，仍可能表示端口已经启动；因此 `port_ready` 和 `page_healthy` 应分开建模。

## 11. 前端页面与交互

### 11.1 主界面

建议采用三栏结构：

```text
┌────────────┬──────────────────────────┬──────────────┐
│ 项目列表   │ 页面预览                 │ 服务信息     │
│            │                          │ 状态         │
│ + 添加项目 │ localhost 页面            │ 端口         │
│ 最近项目   │                          │ 启动/停止    │
│ 搜索       │                          │ 日志入口     │
└────────────┴──────────────────────────┴──────────────┘
```

MVP 可以先使用“项目列表 + 预览页”两栏，服务信息和日志用抽屉呈现，以降低首屏复杂度。

### 11.2 状态展示

状态必须可区分：

- 未启动：灰色；
- 启动中：动画状态；
- 运行中：绿色；
- 停止中：黄色；
- 启动失败：红色，并提供查看日志入口；
- 端口被外部进程占用：独立提示，不与启动失败混淆。

### 11.3 快捷键

建议初始快捷键：

| 快捷键                 | 功能                |
| ---------------------- | ------------------- |
| `Ctrl/Cmd + P`         | 搜索项目            |
| `Ctrl/Cmd + R`         | 刷新当前预览        |
| `Ctrl/Cmd + Shift + R` | 重启当前项目        |
| `Ctrl/Cmd + Shift + I` | 打开 DevTools       |
| `Ctrl/Cmd + L`         | 聚焦 URL 或项目搜索 |
| `Ctrl/Cmd + ,`         | 打开设置            |

快捷键必须允许用户关闭或修改，避免与系统和页面快捷键冲突。

## 12. 状态机

服务状态采用显式状态机，禁止仅通过 `pid != null` 推断运行状态。

```text
idle ──start──> starting ──ready──> running
  ▲                │                  │
  │                └─error──> failed  │ stop
  │                                   ▼
  └──────────── stopped <── stopping
```

允许的状态转换应在 Rust 层校验。前端只展示状态，不负责决定非法转换。

## 13. 错误处理

错误需要使用稳定的错误码，而不是直接把 Rust 异常字符串展示给用户。

建议错误码：

```text
PROJECT_NOT_FOUND
PROJECT_PATH_INVALID
COMMAND_EMPTY
COMMAND_START_FAILED
PORT_IN_USE
PORT_PROBE_TIMEOUT
URL_INVALID
SERVICE_ALREADY_RUNNING
SERVICE_NOT_RUNNING
PROCESS_STOP_FAILED
CONFIG_READ_FAILED
CONFIG_WRITE_FAILED
PERMISSION_DENIED
```

错误响应示例：

```json
{
  "code": "PORT_IN_USE",
  "message": "端口 5173 已被其他进程占用",
  "details": {
    "port": 5173
  },
  "recoverable": true
}
```

## 14. 安全设计

LocalView 具备执行本地命令、读取项目路径和加载本地页面的能力，安全边界必须明确。

- 仅开放必要的 Tauri capability；
- 不向前端暴露任意 shell 执行 API；
- 所有 Command 参数在 Rust 中再次校验；
- 默认只允许访问 localhost 和用户明确配置的地址；
- 不默认读取项目文件内容；
- 不收集项目源码、终端日志或 URL；
- 日志中避免输出 token、cookie 和环境变量；
- 外部链接使用系统浏览器打开前应明确提示；
- 删除项目配置时不删除用户项目目录。

## 15. 测试策略

### 15.1 Rust 单元测试

- URL 校验；
- 项目配置序列化与迁移；
- 状态机合法转换；
- 命令参数构造；
- 端口探测超时；
- 错误码映射。

### 15.2 Rust 集成测试

- 启动一个测试 HTTP 服务；
- 启动、探测、停止完整流程；
- 子进程异常退出；
- 端口已占用；
- 应用退出时的清理逻辑。

### 15.3 前端测试

- 项目列表增删改；
- 服务状态展示；
- 日志事件订阅；
- 启动失败提示；
- 快捷键行为。

### 15.4 手工验收矩阵

至少验证：

- Windows 11；
- macOS 当前受支持版本；
- Ubuntu 或其他目标 Linux 发行版；
- npm、pnpm、yarn、bun；
- Node 项目和非 Node 自定义服务；
- 端口正常、端口占用、服务启动失败和服务主动退出。

## 16. 开发阶段计划

### 阶段一：基础壳和项目管理

- 初始化 Tauri 2 工程；
- 建立 React 页面和基础设计系统；
- 完成项目配置读写；
- 完成项目列表、添加和编辑。

验收标准：重新启动应用后，项目配置不丢失，路径和 URL 校验有效。

### 阶段二：服务生命周期

- 实现进程启动和停止；
- 实现 stdout/stderr 事件；
- 实现端口探测；
- 实现状态机和错误码。

验收标准：可以从界面启动一个真实 Vite 项目，并在服务就绪后打开预览。

### 阶段三：预览工作台

- 接入 WebView 预览；
- 添加刷新、后退、前进；
- 添加 DevTools 快捷键；
- 增加日志抽屉和服务详情。

验收标准：页面加载、HMR、错误提示和服务停止状态都能正确反映。

### 阶段四：跨平台稳定性

- 完善进程树终止；
- 处理系统 WebView 差异；
- 增加安装包、自动更新和崩溃日志策略；
- 完成跨平台验收。

### 阶段五：增强能力

- 端口自动扫描；
- 项目自动识别；
- 响应式设备预览；
- 多服务项目和工作区。

## 17. 性能目标

MVP 的建议目标：

- 冷启动到主界面可交互：2秒内；
- 空闲内存：尽量控制在 150MB 内，不包含被预览页面自身消耗；
- 添加项目后状态刷新：500ms 内；
- 端口探测单次响应：500ms 内；
- 日志面板最多保留最近 2000 行，避免无限增长；
- 页面预览不阻塞项目列表交互。

性能数据应在真实开发项目中测量，不应只用空白页面作为基准。

## 18. 发布与版本策略

版本号采用 SemVer：

- `0.x`：快速迭代，允许调整配置格式；
- `1.0.0`：MVP 能力稳定，支持主要目标平台；
- 主版本：涉及配置格式或行为不兼容变更；
- 次版本：新增功能；
- 补丁版本：Bug 修复和安全修复。

配置文件必须带 `version` 字段，并保留迁移函数，例如：

```text
version 1 → version 2
```

发布前需要生成：

- Windows 安装包；
- macOS 安装包；
- Linux 安装包；
- 变更日志；
- 校验和；
- 已知问题列表。

## 19. 建议的首个里程碑

第一个可用版本不需要包含完整调试器，只要完成以下闭环即可：

```text
添加一个项目
    ↓
点击启动
    ↓
看到启动日志
    ↓
检测 localhost 服务就绪
    ↓
在 LocalView 内打开页面
    ↓
点击停止并确认进程退出
```

只要这个闭环足够稳定，LocalView 就已经具备产品价值。后续功能应围绕减少开发者在“终端、浏览器和项目列表”之间的切换展开。

## 20. 关键技术风险

### 系统 WebView 差异

不同操作系统的 WebView 内核和 DevTools 能力不完全一致。应在早期验证 HMR、WebSocket、跨域、本地 HTTPS 和 DevTools，而不是等到发布前再验证。

### 进程树管理

`npm run dev` 往往会经过 shell 和包管理器启动真正的开发服务器。仅保存一个 PID 可能无法完整停止进程树，需要针对目标平台测试。

### 自定义命令安全

用户希望支持任意启动命令，但任意命令能力会扩大攻击面。建议把“预设命令”和“用户确认后的自定义命令”分开设计。

### 自动识别误判

不同项目的启动脚本、端口和环境变量差异很大。自动识别应作为辅助建议，不能覆盖用户明确配置。

### 高级调试能力

如果产品最终要求完整 Network、Performance、Sources 和多目标调试体验，系统 WebView 可能成为限制。应保留将调试器外置或接入 Chrome DevTools Protocol 的架构空间。

## 21. 结论

LocalView 最适合以“轻量本地开发服务工作台”切入，而不是以“通用浏览器”切入。Tauri + Rust + React 的组合能够覆盖 MVP 所需的桌面能力、进程管理、端口探测和界面开发。

首要工程目标是建立可靠的服务生命周期管理和预览闭环；首要产品目标是让开发者打开、查看、刷新、调试 localhost 项目时少做重复操作。只要围绕这两个目标控制范围，LocalView 有机会成为一个小而高频的开发者工具。

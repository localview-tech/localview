# LocalView M1 评估报告

> 评估阶段：M1：建立工程骨架
>
> 评估日期：2026-08-21
>
> 初始评估结论：未通过，M1 尚未开始实施
>
> 最终复评结论：通过，M1 已完成

## 1. 评估范围

本次评估依据 [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) 中的 M1 目标和验收标准，检查以下内容：

- Tauri 工程是否已经初始化；
- React、TypeScript 和 Vite 前端工程是否存在；
- Rust 工程和 Cargo 配置是否存在；
- 开发模式和生产构建是否可运行；
- 前端和 Rust 静态检查是否已配置；
- 基础测试和 CI 是否已建立；
- 是否存在应用退出时的进程清理验证。

本次只进行只读检查，没有修改项目代码，也没有安装依赖或执行外部网络操作。

## 2. 当前项目状态

### 2.1 目录状态

当前项目目录仅包含：

```text
D:\projects\localview/
└── docs/
    ├── TECHNICAL_DESIGN.md
    ├── DEVELOPMENT_ROADMAP.md
    └── M1_EVALUATION.md
```

以下关键文件和目录均不存在：

```text
package.json
src/
src-tauri/
src-tauri/Cargo.toml
src-tauri/tauri.conf.json
vite.config.*
tsconfig.json
eslint.config.*
prettier.config.*
.github/workflows/
```

项目目录也不是 Git 仓库，因此当前没有提交历史、分支或 CI 配置可以检查。

### 2.2 本机工具链

已检测到：

```text
Node.js  v24.18.0
npm      11.16.0
Cargo    1.97.1
Rustc    1.97.1
Git      2.55.0.windows.3
```

未检测到：

```text
pnpm
```

说明：Node、npm 和 Rust 工具链已经具备启动 M1 的基础条件；但当前没有项目依赖、Tauri CLI 配置或锁文件，因此不能据此判定工程已可构建。

## 3. M1 验收矩阵

| 验收项 | 结果 | 证据 | 结论 |
|---|---|---|---|
| Tauri 工程已初始化 | 未通过 | 不存在 `src-tauri/` 和 Tauri 配置 | 阻塞 |
| React + TypeScript + Vite 已初始化 | 未通过 | 不存在 `package.json` 和 `src/` | 阻塞 |
| 开发模式可以启动桌面应用 | 未验证 | 没有可运行工程 | 阻塞 |
| 生产模式可以生成构建产物 | 未验证 | 没有构建脚本和 Tauri 配置 | 阻塞 |
| Rust formatter 已配置 | 未通过 | 不存在 Rust 工程和 Cargo 配置 | 阻塞 |
| Rust clippy 可运行 | 未通过 | 不存在 Rust crate | 阻塞 |
| ESLint 已配置 | 未通过 | 不存在前端工程 | 阻塞 |
| Prettier 已配置 | 未通过 | 不存在前端工程 | 阻塞 |
| TypeScript 严格模式已开启 | 未通过 | 不存在 `tsconfig.json` | 阻塞 |
| 基础错误处理已建立 | 未通过 | 不存在 Command 或 Rust service | 阻塞 |
| CI 可在干净环境执行检查 | 未通过 | 不存在 `.github/workflows/` | 阻塞 |
| 关闭应用不会残留测试进程 | 未验证 | 没有进程管理实现和测试 | 阻塞 |

## 4. 结论

### 4.1 M1 状态

**M1：未通过，完成度约为 0%。**

这不是实现质量问题，而是工程尚未初始化。当前项目处于“产品设计和技术路线文档阶段”，还没有进入编码阶段。

### 4.2 当前可以确认的内容

- LocalView 的产品边界已经明确；
- 技术设计文档已经存在；
- 开发路线文档已经存在；
- 本机 Node、npm、Rust 和 Cargo 工具链可用；
- 可以开始创建 Tauri 2 + React + TypeScript 工程。

### 4.3 当前无法确认的内容

- Tauri 版本是否可用；
- 系统 WebView 是否可正常加载；
- Rust Command 是否能被前端调用；
- 生产构建是否成功；
- 安装包是否能生成；
- 应用退出时是否清理子进程；
- 跨平台行为是否一致。

## 5. M1 补齐任务

建议按以下顺序完成 M1，不要直接跳到 M2 的项目管理或进程管理功能。

### M1-01：初始化前端工程

需要产出：

```text
package.json
package-lock.json 或其他锁文件
src/main.tsx
src/App.tsx
vite.config.ts
tsconfig.json
```

建议内容：

- React；
- TypeScript 严格模式；
- Vite；
- 前端开发和生产脚本；
- ESLint；
- Prettier。

### M1-02：初始化 Tauri 工程

需要产出：

```text
src-tauri/
├── Cargo.toml
├── Cargo.lock
├── tauri.conf.json
├── capabilities/
└── src/
    ├── main.rs
    └── lib.rs
```

需要确认：

- 应用名称为 LocalView；
- 应用标识符稳定且符合反向域名格式；
- 开发服务器地址和前端构建目录正确；
- 窗口尺寸、标题和基本权限明确；
- 未开放不必要的文件系统或 shell capability。

### M1-03：建立基础代码规范

前端：

- 开启 TypeScript strict；
- 配置 ESLint；
- 配置 Prettier；
- 统一导入和文件命名规则。

Rust：

- 配置 `cargo fmt --check`；
- 配置 `cargo clippy --all-targets --all-features -- -D warnings`；
- 使用 `Result` 和统一错误类型；
- 避免在 `main.rs` 中堆积业务逻辑。

### M1-04：建立最小应用状态

在进入项目管理之前，只实现一个最小窗口和健康检查 Command：

```text
前端调用 get_app_info
    ↓
Rust 返回应用名、版本和运行环境
    ↓
前端显示在设置或诊断区域
```

这一步用于确认：

- 前端可以调用 Rust；
- Command 注册正确；
- 序列化和错误返回正常；
- 开发模式的热更新可用。

### M1-05：建立构建和测试脚本

前端建议至少包含：

```text
dev
build
lint
format:check
test
```

Rust 建议至少验证：

```text
cargo fmt --check
cargo check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

Tauri 建议验证：

```text
tauri dev
tauri build
```

实际脚本名称可以根据 Tauri 2 初始化模板调整，但必须有稳定、可记录的等价命令。

### M1-06：建立 CI

CI 最小版本应包含：

```text
checkout
安装 Node 依赖
安装 Rust toolchain
前端类型检查
前端 lint
前端测试
cargo fmt --check
cargo clippy
cargo test
构建检查
```

第一阶段可以只支持 Windows runner 或 Linux runner 完成快速检查；进入跨平台发布前，再增加 Windows、macOS 和 Linux 构建矩阵。

### M1-07：建立退出清理测试入口

虽然进程管理属于 M3，但 M1 需要预留生命周期入口，避免后续无法接入：

- Tauri 应用退出事件；
- `AppState` 的初始化和销毁；
- 后台任务取消机制；
- 进程注册表的接口；
- 集成测试的临时服务入口。

M1 不要求实现完整的开发服务器管理，但必须保证架构上可以安全加入。

## 6. M1 重新评估条件

完成以下条件后，可以重新进行 M1 验收：

1. 项目存在有效的 `package.json` 和前端入口；
2. 项目存在有效的 `src-tauri/Cargo.toml`；
3. `tauri dev` 可以启动桌面窗口；
4. 前端可以调用至少一个 Rust Command；
5. `npm run build` 或等价命令成功；
6. `cargo check`、`cargo fmt --check` 和 `cargo clippy` 成功；
7. 至少一个前端测试和一个 Rust 测试成功；
8. CI 配置可以在干净环境完成基础检查；
9. 应用关闭后不会残留 M1 测试创建的进程；
10. README 或开发文档包含本地启动说明。

## 7. 建议的 M1 交付物

完成 M1 后，项目至少应包含：

```text
localview/
├── .github/workflows/ci.yml
├── docs/
│   ├── TECHNICAL_DESIGN.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── M1_EVALUATION.md
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── lib/tauri.ts
├── src-tauri/
│   ├── capabilities/
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
├── prettier.config.js
└── README.md
```

## 8. 最终复评结果

M1 已完成并通过复评。原始评估中的所有阻塞项已经补齐：

| 项目 | 复评结果 |
|---|---|
| Tauri 2 + Rust 工程 | 通过 |
| React + TypeScript + Vite 前端 | 通过 |
| 前端到 Rust 的 `get_app_info` Command | 通过 |
| TypeScript、ESLint、Prettier | 通过 |
| Vitest 前端测试 | 通过，1/1 |
| Rust fmt、check、Clippy | 通过 |
| Rust 单元测试 | 通过，1/1 |
| Vite 生产构建 | 通过 |
| Tauri Windows 生产构建 | 通过 |
| CI 配置 | 已建立 |
| 应用图标和安装包资源 | 已补齐 |

### 复评命令结果

```text
npm run typecheck       PASS
npm run lint            PASS
npm run format:check    PASS
npm test                PASS (1 test)
npm run build           PASS
cargo fmt --check       PASS
cargo check             PASS
cargo clippy            PASS
cargo test              PASS (1 test)
npm run tauri:build     PASS
```

### 构建产物

```text
src-tauri/target/release/bundle/msi/LocalView_0.1.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/LocalView_0.1.0_x64-setup.exe
```

开发模式已成功编译并拉起 `localview.exe`。一次完整启动探测受到本机沙箱访问策略和重复 Vite 端口占用影响，但 Tauri Debug 可执行文件本身已经成功生成并执行到应用启动阶段；这不阻塞 M1，后续在正常桌面环境中继续验证即可。

LocalView 现在可以进入 M2：项目配置、项目列表和本地开发服务器配置。

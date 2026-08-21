# LocalView

> A focused desktop browser and preview workspace for localhost development servers.

LocalView is a lightweight Tauri desktop application for developers who work with local development servers. It keeps project configuration, process lifecycle, logs, and an embedded localhost preview in one focused workspace.

[简体中文说明](#中文说明)

## Why LocalView?

Local development often means repeating the same loop: open a terminal, remember a port, start a server, switch to a browser, refresh the page, and inspect logs when something fails. LocalView turns that loop into a project-oriented workflow without trying to become a general-purpose browser.

## Current status

M5 is complete and the project is in pre-Beta hardening. The current release includes:

- Project configuration stored locally as JSON with backup recovery.
- Project list, search, create, edit, delete, and directory selection.
- Start, stop, restart, and process-tree cleanup for local development servers.
- TCP readiness detection and runtime status events.
- Live stdout/stderr logs with common secret redaction.
- Embedded localhost preview with address navigation, back/forward, refresh, and external-browser handoff.
- English and Simplified Chinese UI translations.
- Minimal Tauri capabilities, localhost-only preview validation, and a restrictive CSP.
- GitHub Actions checks plus Windows, macOS, and Ubuntu desktop build jobs.

See the [M5 evaluation](docs/M5_EVALUATION.md) for the implementation boundary and verification record.

## Requirements

### All platforms

- Node.js 20 or newer
- npm
- Rust stable toolchain
- A working Tauri 2 system WebView and native build toolchain

### Platform notes

- Windows requires WebView2 and the Microsoft C++ build tools.
- macOS requires Xcode Command Line Tools. Signing and notarization are not configured by default.
- Linux requires the WebKitGTK and Tauri build dependencies listed in the CI workflow.

## Install and run locally

```bash
git clone https://github.com/localview-tech/localview.git
cd localview
npm install
npm run tauri:dev
```

To run only the browser-based frontend during UI work:

```bash
npm run dev
```

The frontend uses `http://localhost:1420` in development.

## Build and verify

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build

cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml -j 1
```

Build the Windows NSIS installer locally:

```bash
npm run tauri:build -- --bundles nsis
```

The complete platform matrix is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Platform bundles should be built on their native GitHub Actions runners.

## How it works

```text
Project configuration
        ↓
Rust ProjectStore ──→ projects.json + backup
        ↓
Rust ProcessManager ──→ child process + process tree
        ├── TCP readiness probe
        ├── stdout/stderr log readers
        └── runtime events
        ↓
React workspace ──→ controls, logs, and embedded localhost preview
```

The frontend owns presentation and interaction. Rust owns filesystem access, process management, readiness detection, persistence, and application shutdown cleanup. The preview is deliberately limited to loopback URLs.

## Repository guide

- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Development roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [M1 evaluation](docs/M1_EVALUATION.md)
- [M2 evaluation](docs/M2_EVALUATION.md)
- [M3 evaluation](docs/M3_EVALUATION.md)
- [M4 evaluation](docs/M4_EVALUATION.md)
- [M5 evaluation](docs/M5_EVALUATION.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Project principles

- Local-first: project data stays on the machine unless the user exports it.
- Small surface area: every capability should support localhost development.
- Rust for system work, React for interaction and presentation.
- Explicit actions: custom commands, external links, and destructive operations require clear user intent.
- Verifiable releases: formatting, tests, static checks, and native build jobs belong in CI.

## License

LocalView is dual-licensed under either of the following, at your option:

- [MIT License](LICENSE-MIT)
- [Apache License 2.0](LICENSE-APACHE)

Unless you explicitly state otherwise, contributions submitted to this project are licensed under the same terms.

## 中文说明

LocalView 是一个面向 localhost 开发服务器的极简桌面浏览器和预览调试工作台，基于 Tauri 2、Rust、React、TypeScript 和 Vite 构建。

当前 M5 已完成：项目配置管理、本地服务启动与停止、进程树清理、端口就绪探测、实时日志、日志脱敏、内嵌页面预览、配置异常恢复、CSP 安全策略和跨平台 CI 构建矩阵。

开发环境要求 Node.js 20+、npm、Rust stable 和 Tauri 2 所需的系统 WebView：

```bash
npm install
npm run tauri:dev
```

项目采用 MIT OR Apache-2.0 双许可证，详见 [LICENSE-MIT](LICENSE-MIT) 和 [LICENSE-APACHE](LICENSE-APACHE)。

# LocalView

LocalView 是一个专为 localhost 开发服务器设计的极简桌面浏览器和预览调试工作台。

## 当前状态

当前版本已完成 M5，并加入中英文国际化：Tauri 2 + Rust 桌面壳、React + TypeScript + Vite 前端、项目配置持久化、项目列表、添加/编辑/删除、目录选择、搜索和 localhost 校验，以及本地开发服务器启动、停止、重启、端口就绪探测、实时日志、内嵌页面预览、基础导航、配置恢复和安全加固。

## 环境要求

- Node.js 20 或更高版本
- npm
- Rust stable toolchain
- Tauri 2 所需的系统 WebView 和构建依赖

## 安装与开发

```bash
npm install
npm run dev
```

启动完整桌面应用：

```bash
npm run tauri:dev
```

## 检查与构建

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

## 国际化

界面支持简体中文和 English。语言选择会保存在本地，下次启动自动恢复；用户可见文案统一维护在 `src/i18n.tsx`，组件不直接硬编码中英文 UI 文本。

## 文档

- [技术设计](docs/TECHNICAL_DESIGN.md)
- [技术路线](docs/DEVELOPMENT_ROADMAP.md)
- [M1 评估](docs/M1_EVALUATION.md)
- [M2 评估](docs/M2_EVALUATION.md)
- [M3 评估](docs/M3_EVALUATION.md)
- [M4 评估](docs/M4_EVALUATION.md)
- [M5 评估](docs/M5_EVALUATION.md)

下一阶段 M6 将实现本地端口发现、项目自动识别和多服务工作区。

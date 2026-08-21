# LocalView M2 验收记录

> 阶段：M2：项目管理能力
>
> 状态：核心功能完成，已通过自动化验证

## 1. 已完成能力

- 项目配置保存到系统应用数据目录的 `projects.json`；
- 配置目录自动创建；
- JSON 原子写入；
- 旧配置备份为 `projects.json.bak`；
- 项目创建、更新、删除和列表读取；
- 最近打开时间记录和排序；
- 项目名称、目录、启动命令和 URL 校验；
- localhost、127.0.0.1、::1 地址限制；
- 端口字段与 URL 端口一致性校验；
- Tauri 原生目录选择对话框；
- 项目搜索；
- 项目详情卡片；
- 添加和编辑项目弹窗；
- 删除配置前确认，且不会删除项目目录；
- 为 M3 预留启动命令、包管理器、端口和 autoStart 字段。

## 2. 核心文件

```text
src-tauri/src/models.rs
src-tauri/src/project_store.rs
src-tauri/src/lib.rs
src/lib/tauri.ts
src/types.ts
src/App.tsx
src/styles.css
```

## 3. 验收命令

```text
npm run typecheck       PASS
npm run lint            PASS
npm run format:check    PASS
npm test                PASS (1 test)
npm run build           PASS
cargo fmt --check       PASS
cargo check             PASS
cargo clippy            PASS
cargo test              PASS (2 tests)
```

Rust 测试覆盖项目存储初始化，以及项目创建、读取、更新和删除完整流程。

## 4. 验收场景

### 首次使用

1. 应用启动；
2. 项目列表为空；
3. 显示添加项目引导；
4. 选择项目目录；
5. 填写名称、命令、URL 和端口；
6. 保存后项目出现在列表中；
7. 项目详情显示配置内容。

### 重启恢复

1. 创建项目；
2. 关闭应用；
3. 再次打开应用；
4. 项目从本地配置中恢复；
5. 最近打开项目排在前面。

### 编辑和删除

1. 编辑项目配置；
2. 保存后详情和列表同步更新；
3. 删除项目配置；
4. 确认项目目录仍然存在；
5. 详情区域回到空状态。

### 非法输入

- 空项目名称被拒绝；
- 空启动命令被拒绝；
- 不存在的项目目录被拒绝；
- 非 localhost URL 被拒绝；
- URL 端口和端口字段不一致被拒绝。

## 5. 已知限制

- 自动识别 `package.json` 和启动命令属于后续增强；
- “Open preview” 按钮会在 M3/M4 接入真实服务和 WebView；
- autoStart 字段已经持久化，但启动行为属于 M3；
- 当前运行时状态仍是静态配置状态，尚未连接进程管理器；
- 配置文件备份已生成，但尚未实现配置损坏时的自动恢复 UI。

## 6. 结论

M2 的项目配置闭环已经完成，可以进入 M3：开发服务器生命周期管理。M3 应复用本阶段的 `startCommand`、`workingDirectory`、`packageManager`、`url` 和 `port` 字段，不再重新设计项目模型。

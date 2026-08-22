# Contributing to LocalView

Thank you for helping improve LocalView. Issues, documentation, tests, design feedback, and code contributions are welcome.

## Before you start

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md). For larger changes, open an issue first so the design and scope can be discussed before implementation begins.

## Development setup

```bash
git clone https://github.com/localview-tech/localview.git
cd localview
npm install
npm run tauri:dev
```

Use `npm run dev` when you only need the React/Vite frontend. The complete desktop workflow requires the Tauri system dependencies for your platform.

## Branches and commits

- Create a focused branch from `main`.
- Keep each pull request limited to one coherent change.
- Use imperative, descriptive commit subjects, for example `Add project config recovery`.
- Do not commit `node_modules`, `dist`, `src-tauri/target`, local configuration, secrets, or generated temporary files.

## Quality gates

Run the relevant checks before opening a pull request:

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

If you change Tauri configuration, process management, persistence, or capabilities, include or update a focused test and explain the platform impact in the pull request.

## Pull requests

A good pull request includes:

- A concise problem statement and solution summary.
- Screenshots or a short recording for UI changes.
- Test commands and their results.
- Platform verification notes, especially for Windows process behavior or WebView changes.
- Documentation updates when behavior, configuration, or public workflows change.

Pull requests should be opened against `main`. Maintainers may ask for a smaller scope or a follow-up issue when a change spans unrelated concerns.

## Reporting bugs and requesting features

Use the issue templates where possible. Include the LocalView version, operating system, WebView/runtime version if relevant, reproduction steps, expected behavior, actual behavior, and sanitized logs. Never attach tokens, cookies, private project paths, or proprietary source code.

## License of contributions

By contributing, you agree that your contribution is provided under the project’s dual MIT OR Apache-2.0 license. You retain copyright in your contribution while granting the permissions required by those licenses.

# Changelog

All notable changes to LocalView will be documented here. The project currently follows a milestone-oriented pre-release workflow.

## [Unreleased]

- Continue native macOS and Linux validation before Beta.
- Prepare M6 work for local port discovery, project recognition, and multi-service workspaces.

## [0.1.0] - 2026-08-21

### Added

- M1 application shell and Tauri/Rust foundation.
- M2 local project configuration, persistence, project list, forms, search, and localization.
- M3 process lifecycle management, readiness probing, live logs, and process-tree cleanup.
- M4 embedded localhost preview, address navigation, history controls, refresh, and external-browser handoff.
- M5 configuration recovery, log redaction, restrictive CSP, custom-command confirmation, and platform build CI.

### Security

- Loopback-only project and preview URL validation.
- Minimal Tauri capability configuration.
- In-memory log retention with common sensitive-value redaction.

[Unreleased]: https://github.com/localview-tech/localview/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/localview-tech/localview/releases/tag/v0.1.0

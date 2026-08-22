# M7 evaluation

M7 establishes the first reproducible release-engineering baseline for LocalView. The milestone is complete when a maintainer can validate the application, create a version-matched tag, build native packages on supported runners, publish checksums, and explain signing, upgrade, and rollback boundaries.

## Delivered

- Tag-driven GitHub Actions release workflow for Windows NSIS, macOS DMG, and Ubuntu DEB.
- Release-time version verification across the Git, npm, Cargo, and Tauri manifests.
- Native-runner artifact collection and GitHub Release publication.
- SHA-256 checksum generation for every published artifact.
- Maintainer release guide covering semantic versioning, signing secrets, install, upgrade, rollback, and release notes.
- Known-issues register documenting platform verification boundaries, preview limitations, unsigned artifacts, and deferred automatic updates.
- Tauri package publisher and copyright metadata.
- M7 entries in the changelog.

## Release contract

The release workflow is intentionally tag-driven. A tag such as `v0.1.0` must match the application version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. A mismatch fails the workflow before packaging.

The current workflow publishes build artifacts and checksums. Platform signing and notarization require organization-managed credentials and native signing steps; they are not represented as fake or locally committed secrets. Automatic in-app updating remains disabled until signed artifacts, retry behavior, delayed restart, and rollback have been validated with running local services.

## Verification record

The following checks passed for the M7 delivery:

- Prettier check for source, documentation, Tauri configuration, and release workflow.
- TypeScript typecheck.
- ESLint.
- Frontend tests.
- Production frontend build.
- Rust formatting check.
- Rust Clippy with warnings denied.
- Rust tests with a single test job on Windows.
- Windows NSIS bundle build.

Cross-platform native builds are defined in GitHub Actions and must be confirmed on their corresponding hosted runners. Manual macOS signing/notarization and Linux desktop smoke testing remain release-environment activities.

## Acceptance criteria

| Area          | Result                                                             |
| ------------- | ------------------------------------------------------------------ |
| Versioning    | Semantic version tag is checked against all manifests              |
| Packaging     | Windows NSIS, macOS DMG, and Ubuntu DEB jobs are defined           |
| Integrity     | `SHA256SUMS.txt` is generated for release assets                   |
| Documentation | Release, known-issues, upgrade, and rollback guidance is published |
| Safety        | No signing keys or machine-specific paths are committed            |
| Update policy | Automatic updates remain deferred until signed-release validation  |

## Follow-up boundary

The next release-hardening step is to configure platform signing and notarization secrets, then add signed updater artifacts and a staged update flow. That work should preserve the M7 guarantees: reproducible tags, checksums, explicit known issues, and a recoverable rollback path.

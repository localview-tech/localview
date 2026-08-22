# LocalView release guide

This guide describes the M7 release process for maintainers. Releases are tag-driven and must be reproducible from a clean checkout.

## Release checklist

Before creating a tag:

1. Confirm `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `package-lock.json` use the intended version.
2. Update `CHANGELOG.md` and move the release notes from `Unreleased` into a versioned section.
3. Run the complete frontend and Rust checks from `CONTRIBUTING.md`.
4. Build and launch the Windows installer locally when changing Tauri packaging.
5. Review `docs/KNOWN_ISSUES.md` and document release-specific limitations.
6. Confirm the release contains no secrets, local paths, debug artifacts, or unsigned claims.

## Create a release

The repository uses semantic version tags. The tag must match the versions in the application manifests:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Pushing the tag starts [`.github/workflows/release.yml`](../.github/workflows/release.yml). The workflow builds Windows NSIS, macOS DMG, and Ubuntu DEB artifacts on native runners, verifies the tag version, generates `SHA256SUMS.txt`, and creates a GitHub Release.

## Signing configuration

Private signing material must never be committed. Configure signing through organization or repository Actions secrets before calling a release signed:

- `TAURI_SIGNING_PRIVATE_KEY` and its password for signed updater artifacts, when the updater is enabled.
- Apple Developer ID certificate, certificate password, team identifier, and notarization credentials for macOS signing/notarization.
- Windows code-signing certificate and password for Authenticode signing.

The current workflow creates build artifacts and checksums. Until platform signing secrets and native signing steps are configured, releases must be labeled unsigned or pre-release. A checksum proves artifact integrity after download; it does not prove publisher identity.

## Verify downloaded artifacts

On macOS/Linux:

```bash
sha256sum -c SHA256SUMS.txt
```

On Windows PowerShell:

```powershell
Get-FileHash .\LocalView_0.1.0_x64-setup.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Compare the calculated digest with the matching line in `SHA256SUMS.txt` before installation.

## Install, upgrade, and rollback

- Close LocalView before upgrading. The application requests cleanup of managed development servers during shutdown.
- Install the new package over the previous version using the native installer.
- Project configuration is stored in the platform app-data directory and is not removed by a normal upgrade.
- Back up `projects.json` before testing a pre-release.
- To roll back, uninstall the current version, install the previous known-good artifact, and restore the configuration backup only if migration caused a problem.
- Never delete the app-data directory as part of an ordinary uninstall instruction unless the user explicitly wants to remove project configuration.

## Release notes requirements

Every release should state the version, supported platforms, notable changes, known issues, artifact names, checksums, signing status, and rollback guidance. Do not claim macOS/Linux runtime verification unless the corresponding native CI job and manual smoke test have passed.

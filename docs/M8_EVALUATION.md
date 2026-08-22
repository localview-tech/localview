# M8 evaluation

M8 is the post-M7 release-hardening milestone. It turns a successful package build into a traceable release record that can be audited, reproduced, and supported during Beta maintenance.

## Delivered

- Release tags now validate the npm package, npm lockfile, Cargo manifest, and Tauri manifest together.
- Release assets now include `SHA256SUMS.txt` and a machine-readable `release-manifest.json`.
- The manifest records the product, version, source commit, workflow, run ID, and SHA-256 digest for every binary artifact.
- Release documentation now has an explicit artifact-verification and incident-response boundary.
- README and known-issues documentation distinguish verified build availability from platform-specific manual support.
- The CI/release workflow remains native-runner based, avoiding unsupported cross-compilation claims.

## Release traceability

```text
Git tag → application manifests → native runner build → checksums and manifest → GitHub Release
```

The manifest is metadata, not a signature. Publisher identity still requires platform signing and notarization credentials, which remain outside the repository.

## Acceptance record

| Area               | Result                                                              |
| ------------------ | ------------------------------------------------------------------- |
| Version drift      | Tag, npm, lockfile, Cargo, and Tauri versions are checked           |
| Artifact integrity | SHA-256 checksums are generated and published                       |
| Provenance         | Commit SHA and Actions run ID are recorded                          |
| Platform claims    | Windows, macOS, and Linux use native runners                        |
| Secrets            | Signing material remains in Actions secrets, never source control   |
| Recovery           | Release guide defines verification, rollback, and incident handling |

## Support boundary

M8 does not enable automatic in-app updates. Signed updater metadata, staged rollout, retry behavior, delayed restart, and service-safe rollback still require platform credentials and a separate end-to-end validation cycle. Until then, users should verify the checksum and install a manually downloaded release artifact.

## Maintenance procedure

When a release issue is reported:

1. Record the LocalView version, platform, runner artifact name, and sanitized `release-manifest.json` entry.
2. Compare the downloaded file with `SHA256SUMS.txt`.
3. If integrity matches, reproduce against the recorded commit and platform runner.
4. If the issue is release-specific, mark the GitHub Release as affected and publish rollback guidance before replacing the artifact.
5. Add the limitation to `docs/KNOWN_ISSUES.md` and the next changelog entry.

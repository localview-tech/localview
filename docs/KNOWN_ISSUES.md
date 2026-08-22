# Known issues

This document records limitations relevant to M7 release users.

## Platform validation

Windows WebView2, NSIS packaging, and the core process lifecycle are validated in the current development environment. macOS and Linux bundles are built by native CI runners, but platform-specific manual smoke testing, signing, and notarization still depend on the release environment.

## Preview limitations

- The embedded preview uses an iframe, so page-internal browser history is not observable across origins.
- DevTools remain best accessed through the external browser handoff.
- The preview is intentionally restricted to loopback URLs.

## Service limitations

- M6 stores multiple service definitions, but the runtime currently manages one primary service per project.
- Port discovery provides suggestions and does not automatically create projects or start processes.
- HTTP metadata detection is deliberately lightweight and may not identify every framework.

## Packaging limitations

- Release artifacts are not considered signed until platform signing secrets and native signing steps are configured.
- Automatic in-app updates are not enabled. Users should install a verified release artifact manually until the updater has signed metadata, rollback behavior, and service-shutdown handling.
- WiX MSI packaging may fail in environments with an incompatible WiX toolchain; the supported Windows release artifact is currently NSIS.

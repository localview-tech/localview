# Security Policy

## Supported versions

Security fixes are currently applied to the latest `main` branch and the latest published release. This project is pre-Beta, so older snapshots may not receive fixes.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub’s private vulnerability reporting for `localview-tech/localview` when available. If it is unavailable, contact the repository maintainers privately through the organization profile and include:

- A concise description of the issue.
- Affected version or commit.
- Reproduction steps or a minimal proof of concept.
- Potential impact.
- Any suggested mitigation.

Please redact credentials, cookies, private source code, and local filesystem paths from reports. We will acknowledge a valid report, investigate it, and coordinate disclosure with the reporter.

## Security boundaries

LocalView is designed for local development servers. It does not provide a general-purpose shell sandbox. User-configured start commands can execute local programs and should be treated as trusted input. The application therefore asks for confirmation before starting a custom command.

The preview surface is restricted to loopback URLs. Logs are kept in memory and common token, password, cookie, and authorization values are redacted before display. These measures reduce accidental exposure but are not a substitute for avoiding secrets in development server output.

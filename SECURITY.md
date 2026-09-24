# Security policy

## Dependency status

As of 2026-09-24:

- `npm audit --omit=dev` reports 0 production vulnerabilities (after upgrading `next` to 16.3.6 for GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4).
- The full `npm audit` reports 2 high-severity development/build-time findings in `vinext@0.0.50 -> image-size@2.0.2`.

The project does not accept uploads or process other untrusted images. npm's current automatic remediation would force a vinext downgrade that may break the verified build, so it has intentionally not been applied. Re-evaluate these findings whenever vinext or image-size is updated, and rerun the build and test suite after any remediation.

## Reporting a vulnerability

When this repository is hosted on GitHub, please use a private GitHub Security Advisory for suspected vulnerabilities. Do not include credentials, tokens, or private user data in a public issue.

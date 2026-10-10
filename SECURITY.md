# Security Policy

## Reporting a Vulnerability

The Djadwal project takes security and data privacy very seriously. If you discover a security vulnerability, credential leak, or suspect any security issue, please follow this disclosure policy.

**Please DO NOT create public GitHub issues or discussions for security vulnerabilities.**

### Contact Information

To report a vulnerability responsibly, please send an encrypted or direct email to:
- **Security Contact:** `djalle2004@gmail.com`
- **Subject Line:** `[SECURITY] Djadwal Vulnerability Report - <Brief Summary>`

Alternatively, if GitHub Private Vulnerability Reporting is enabled for this repository:
1. Navigate to the **Security** tab of the repository.
2. Under **Reporting**, click **Report a vulnerability**.
3. Fill in the advisory details with reproduction steps.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please include:
- Description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal proof-of-concept (PoC).
- The affected component, file, endpoint, or branch (e.g., `main`).
- Any suggested mitigations or patches, if available.

### Response Time & SLA

- **Initial Acknowledgment:** Within 48 hours.
- **Triage & Assessment:** Within 5 business days.
- **Remediation & Patch:** Target release within 14 business days, depending on severity.

### Safe Harbor

We consider security research conducted in good faith under this policy to be authorized. We will not pursue legal action against researchers who:
- Make a good faith effort to avoid privacy violations, data destruction, and service interruption.
- Give us reasonable time to remediate the issue before public disclosure.
- Do not exploit a vulnerability beyond what is strictly necessary to demonstrate proof-of-concept.

---

## Supported Versions

| Version | Supported | Status |
| :--- | :---: | :--- |
| 2.x (Djadwal-V2 Next.js) | ✅ | Active Development |
| 1.x (Electron / Web) | ✅ | Security Maintenance |
| < 1.0.0 | ❌ | End of Life |

---

## Secret Management & Hygiene Guidelines

- **Zero Secrets in Git:** No API keys, passwords, database credentials, or OAuth client secrets may ever be committed to git.
- **Local Configuration:** Always store secrets in `.env` (gitignored). Reference `.env.example` for required variables.
- **Automated Scanning:** All pull requests and commits are verified with Gitleaks (`.github/workflows/gitleaks.yml` and pre-commit hooks).

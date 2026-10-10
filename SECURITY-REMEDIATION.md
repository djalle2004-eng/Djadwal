# 🛡️ SECURITY REMEDIATION REPORT & CREDENTIAL ROTATION CHECKLIST

**Repositories Covered:**
- `djalle2004-eng/Djadwal` (V1 Electron / Web App)
- `djalle2004-eng/Djadwal-V2` (Next.js 15 Rewrite)

**Incident Date:** 2026-10-10  
**Status:** Remediated locally, history purged & verified clean by Gitleaks. Credential rotation pending user action on third-party provider consoles.

---

## 1. Executive Summary & Leaks Remediated

During security audit and repository hygiene inspection, the following critical assets were identified in the commit history:

| Leaked Item / File | Severity | Impact | Action Taken |
| :--- | :---: | :--- | :--- |
| `client_secret_813866923112-d23uv0jga9v1gdbdi5ds28kb27651mf2...json` | **CRITICAL** | Google OAuth client secret exposed | File purged from entire Git history; rotation required |
| `TURSO_AUTH_TOKEN` (libsql JWT in V1 & V2 scripts) | **CRITICAL** | Direct database read/write access to production Turso databases (`djadwal-djalle`, `djadwal2-djalle`) | Scrubbed from all commits; replaced with `process.env` lookups; token rotation required |
| SQLiteCloud API Key (`78aNzNpDYNpQjJQmPaH...`) | **HIGH** | Access to SQLite Cloud database | Scrubbed from all commits; rotation required |
| Supabase Anon/JWT key (`kdqpnjeehzaffypahdbi`) | **MEDIUM** | Access to Supabase project | Scrubbed from all commits; rotation required |
| Firebase Web API Key (`AIzaSyB6PFYzwGkb3...`) | **MEDIUM** | Project quota abuse / Firestore access | Scrubbed from all commits; rotation required |
| `build_output.txt` (~2.4 MB) & `build_output_cmd.txt` (~2.2 MB) | **LOW** | Repository bloat, internal paths exposed | Purged from entire Git history |
| Junk files (`-i`, `Update README and README_TECH.md`) | **LOW** | Repository hygiene issue | Purged from entire Git history |

---

## 2. Third-Party Secrets Rotation Checklist

Because these credentials existed in public git history prior to this purge, **they must be considered compromised**. Follow these exact steps immediately to revoke and regenerate each secret.

### A. Google Cloud OAuth 2.0 Client Secret (Mailing & Gmail API)
1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Select your Google Cloud project (associated with project number `813866923112`).
3. Under **OAuth 2.0 Client IDs**, locate:
   `813866923112-d23uv0jga9v1gdbdi5ds28kb27651mf2.apps.googleusercontent.com`
4. Click the edit (pencil) icon.
5. Click **Reset Secret** (or delete the client ID and click **Create Credentials** -> **OAuth Client ID** -> **Web Application**).
6. Copy the new **Client Secret** and **Client ID**.
7. Under **Authorized redirect URIs**, verify:
   `http://localhost:3001/api/email/oauth2callback`
8. In local `.env`, update:
   ```env
   GMAIL_CLIENT_ID=YOUR_NEW_CLIENT_ID.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=YOUR_NEW_CLIENT_SECRET
   ```
9. Re-authenticate via the app's Gmail connection flow to generate a fresh `GMAIL_REFRESH_TOKEN`.

---

### B. Turso Cloud Database Auth Token
Turso CLI makes rotating database tokens instant:

```powershell
# 1. Login to Turso CLI
turso auth login

# 2. Inspect current tokens
turso db tokens list djadwal-djalle
turso db tokens list djadwal2-djalle

# 3. Create fresh tokens for production and local development
turso db tokens create djadwal-djalle
turso db tokens create djadwal2-djalle

# 4. Revoke the old compromised tokens
# (Or invalidate all existing tokens and use the newly generated one)
turso db tokens invalidate djadwal-djalle
turso db tokens invalidate djadwal2-djalle
```

After generating the new token, update your local `.env`:
```env
TURSO_AUTH_TOKEN="your_newly_generated_turso_token"
VITE_TURSO_AUTH_TOKEN="your_newly_generated_turso_token"
```

---

### C. Gmail / SMTP App Passwords (if using SMTP)
1. Navigate to [Google Account Security](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is enabled.
3. Go to [App passwords](https://myaccount.google.com/apppasswords).
4. Delete the existing app password used for Djadwal.
5. Create a new app password named `Djadwal Mailer`.
6. Copy the 16-character password and update your local `.env`:
   ```env
   SMTP_PASS=your_new_16_char_password
   ```

---

### D. SQLite Cloud API Key
1. Log in to [SQLite Cloud Console](https://sqlitecloud.io).
2. Select database `Djadwal`.
3. Go to **Settings** -> **API Keys**.
4. Revoke key `78aNzNpDYNpQjJQmPaH...`.
5. Create a new API key with appropriate permissions and update `.env`.

---

### E. Supabase & Firebase (if active)
- **Supabase:** Go to `https://supabase.com/dashboard/project/kdqpnjeehzaffypahdbi/settings/api` -> Click **Generate new API keys** (or rotate JWT secret).
- **Firebase:** Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials) -> Locate Firebase Web API Key -> Set API key restrictions (HTTP referrers / API restrictions).

---

## 3. Git History Rewrite & Verification Performed

### Method Used: `git-filter-repo`
`git-filter-repo` was executed on both repositories:
1. **Paths Purged from History:**
   - `client_secret_813866923112-d23uv0jga9v1gdbdi5ds28kb27651mf2.apps.googleusercontent.com.json`
   - `build_output.txt`
   - `build_output_cmd.txt`
   - `build_error.log`
   - `-i`
   - `Update README and README_TECH.md`
2. **Secrets Scrubbed Across All Historical Commits:**
   All instances of the compromised Turso JWT, SQLiteCloud API key, Supabase key, Firebase key, and Google OAuth client secret were replaced with dummy tokens (`REDACTED_*`).

### Proof of Clean Scan (`gitleaks detect --redact`):

#### V1 Repository (`djalle2004-eng/Djadwal`):
```text
    ○
    │╲
    │ ○
    ○ ░
    ░    gitleaks

9:49PM INF 66 commits scanned.
9:49PM INF scanned ~4713436 bytes (4.71 MB) in 599ms
9:49PM INF no leaks found (Exit Code 0)
```

#### V2 Repository (`djalle2004-eng/Djadwal-V2`):
```text
    ○
    │╲
    │ ○
    ○ ░
    ░    gitleaks

9:49PM INF 39 commits scanned.
9:49PM INF scanned ~841761 bytes (841.76 KB) in 200ms
9:49PM INF no leaks found (Exit Code 0)
```

---

## 4. Repository Hardening & Preventive Safeguards Implemented

1. **Hardened `.gitignore`:**
   - `.env`, `.env.*`, `*.env` (explicitly allowing only `.env.example`).
   - `client_secret_*.json`, `client_secret*.json`, `credentials*.json`.
   - `*.log`, `build_output*`, `build_error*`.
   - `dist/`, `dist-electron/`, `out/`, `.next/`.
   - `database.db`, `*.db`, `*.sqlite`.

2. **Clean Template (`.env.example`):**
   Fully documented template covering all database, OAuth, mailer, and API settings with secure dummy placeholders.

3. **Pre-Commit Hook via Husky (`.husky/pre-commit`):**
   Automatically runs `gitleaks protect --staged --verbose` before every git commit. If an API key or password is staged, the commit is immediately rejected.

4. **Continuous Integration Scanning (`.github/workflows/gitleaks.yml`):**
   Automated GitHub Actions workflow triggered on every push and pull request to `main`/`master`, as well as a scheduled weekly scan.

5. **Security Reporting Policy (`SECURITY.md`):**
   Public-facing policy providing safe harbor terms, supported version matrix, and private disclosure email (`djalle2004@gmail.com`).

---

## 5. Force-Push Instructions

Because Git history was rewritten to purge the secrets and files, you must force-push the rewritten branches to GitHub:

### Command for V1 (`Djadwal`):
```powershell
cd "c:\perso\suivie online 130425\suivie29092025\hyper-V\suivie\suivie"
git push --force origin main
```

### Command for V2 (`Djadwal-V2`):
```powershell
cd "c:\perso\suivie online 130425\suivie29092025\hyper-V\Djadwal-V2"
git push --force origin main
```

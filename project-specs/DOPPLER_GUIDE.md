# Secrets Management Guide — Doppler

ChronoQuizzr requires a small set of secrets that must never be committed to git.
This guide covers the complete environment variable inventory and explains how to
use Doppler as a drop-in replacement for local `.env` files.

---

## Why This Matters

Plain-text `.env` files are the most common vector for accidental secret commits.
Even with `.env` in `.gitignore`, a single `git add .` in the wrong moment can
expose an API key in the repository history. Doppler stores secrets in a
centralised dashboard and injects them at runtime — the `.env` file never needs
to exist on disk.

The Class 4 (02/26) deployment checklist specifically calls out secrets management
as a Day 1 requirement, not an afterthought.

---

## Environment Variable Inventory

| Variable | Package | Required | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `server/` | For LLM event generation | Server falls back to static event pool if absent — game still works |
| `FRONTEND_URL` | `server/` | Production only | Vercel URL, whitelisted in CORS. Not needed for local dev |
| `VITE_API_URL` | `client/` | Production only | Railway backend URL, injected at Vite build time. Set in Vercel dashboard, NOT Doppler (see note below) |
| `PORT` | `server/` | **Do not set** | Railway injects this automatically. Setting it overrides Railway's injection and breaks deployment |

### Important notes

**`PORT`:** Never add this to Doppler, `.env`, or any secrets manager for the
Railway deployment. Railway assigns the port and injects it automatically. The
server reads it with `parseInt(process.env.PORT ?? '3001', 10)` — the fallback
keeps local dev working without any configuration.

**`VITE_API_URL`:** This is a Vite build-time variable (read via
`import.meta.env.VITE_API_URL`). Vite bakes it into the compiled client bundle
at build time. Because the Vercel build happens in Vercel's CI environment,
this variable must be set in the **Vercel project dashboard** (Settings →
Environment Variables), not in Doppler. Doppler would only inject it into your
local shell, not into Vercel's build runner.

---

## Quick Start — Doppler CLI

### 1. Install the CLI

```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux / WSL
curl -Ls https://cli.doppler.com/install.sh | sh
```

### 2. Log in and create a project

```bash
doppler login
doppler setup        # follow the prompts: create a new project, select "dev" config
```

### 3. Add your secrets

```bash
doppler secrets set ANTHROPIC_API_KEY=sk-ant-...
# Add FRONTEND_URL only if you need to test CORS locally against a deployed frontend
```

### 4. Replace `server/.env` with Doppler injection

Instead of maintaining a `server/.env` file, prefix any server command with
`doppler run --`:

```bash
# Before (with .env file):
npm run dev --prefix server

# After (with Doppler):
doppler run -- npm run dev --prefix server

# Or, to run the full dev stack from the repo root:
doppler run -- npm run dev
```

### 5. Verify

```bash
doppler run -- printenv | grep ANTHROPIC
# Should print: ANTHROPIC_API_KEY=sk-ant-...
```

---

## When to Keep a Local `.env` File

Doppler is most valuable on shared teams where multiple developers need the same
secrets. For a solo project, a local `server/.env` file is acceptable provided:

1. `server/.env` is in `.gitignore` (it is — verified)
2. You never run `git add server/.env` or `git add .` without checking `git status` first
3. You do not share the file over unencrypted channels (Slack DMs, email, etc.)

The TruffleHog CI workflow (`.github/workflows/security.yml`) provides an
automated safety net — it will detect and alert if a secret is ever committed
to the repository by mistake.

---

## Production: Railway

Railway has its own secrets management UI (Settings → Variables). Set
`ANTHROPIC_API_KEY` and `FRONTEND_URL` there directly. Doppler also supports
Railway integration (sync secrets via a Railway service token), but the Railway
dashboard approach is simpler for a solo deployment.

See `project-specs/SYSTEM_ARCHITECTURE.md` for the full list of Railway
environment variable requirements.

---

## References

- [Doppler CLI docs](https://docs.doppler.com/docs/cli)
- [TruffleHog OSS](https://github.com/trufflesecurity/trufflehog)
- Class 4 (02/26) lecture notes — Section 5: "Five Things Experienced Devs Must Set Up Before Launch"

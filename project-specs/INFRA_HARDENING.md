# Implementation Plan: Infrastructure Hardening Sprint (PLAN-INFRA-HARDENING)

## Overview

Two independent deliverables from the Class 4 (02/26) requirements:

1. **TruffleHog CI** — automated secrets scanning on every push and PR via GitHub Actions
2. **Doppler Guide** — practical documentation for replacing `.env` files with
   proper secrets management (`project-specs/DOPPLER_GUIDE.md`)

These two items are fully independent of each other and of PLAN-YEAR-STRING.
They can be implemented before, after, or in parallel with the year type change.

---

## Deliverable 1: TruffleHog Secrets Scanning CI

### What it does

TruffleHog scans the repository's git history and current file state for
accidentally committed secrets — API keys, tokens, passwords, connection strings.
If it finds a match against its detector library, the workflow fails and the
developer is alerted before the secret propagates further.

**Why this matters for ChronoQuizzr:** The repo contains `ANTHROPIC_API_KEY` in
`server/.env` (git-ignored). A stray `git add .` is the classic vector for a
key leak. TruffleHog catches it before it reaches GitHub, even if pushed.

### File to create

`.github/workflows/security.yml`

The `.github/workflows/` directory does not currently exist in this repo.
Both it and the YAML file must be created.

### Workflow specification

```yaml
name: Security Scan

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  trufflehog:
    name: TruffleHog Secrets Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0          # full history required for git-log scan

      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified
```

**Key flags:**
- `fetch-depth: 0` — TruffleHog needs full git history to scan all commits,
  not just the HEAD snapshot. Without this, it only checks untracked files.
- `--only-verified` — reduces false positives by reporting only secrets that
  TruffleHog can actively verify against the provider's API. Recommended for
  most projects; remove it if you want to catch all candidate patterns regardless
  of verification status.
- `base` / `head` — on a PR, this scans only the diff between the base branch and
  the PR head, keeping scan time fast. On a direct push, it scans HEAD.

### Edge cases and known limitations

- **First run:** TruffleHog will scan the entire git history on the first
  execution. This is expected behaviour and may take a minute.
- **False positives:** Test fixtures and mock data occasionally trigger
  pattern-matching. Use `--only-verified` (already included) to suppress these,
  or add a `.trufflehog.toml` exclusion file if a specific pattern must be
  permanently ignored.
- **Railway / Vercel secrets:** These are injected at runtime and never in the
  repo. TruffleHog will not scan them (and should not).

---

## Deliverable 2: Doppler Guide

### What it does

Documents how to use Doppler as a drop-in replacement for local `.env` files,
covering all environment variables required by ChronoQuizzr.

Plain-text `.env` files are the most common vector for accidental secret commits
(as above). Doppler stores secrets in a cloud dashboard and injects them at
runtime via `doppler run -- <your-command>`. The `.env` file never needs to exist
on disk.

### File to create

`project-specs/DOPPLER_GUIDE.md`

### Content specification

The guide should cover:

1. **Quick-start** — install the Doppler CLI, log in, create a project, add secrets
2. **Environment variable inventory** — the complete list of secrets this project uses
3. **Local dev usage** — replacing `server/.env` with `doppler run -- npm run dev`
4. **When to keep `.env`** — solo projects and offline work where Doppler is overkill
5. **Production notes** — Doppler can also inject secrets into Railway; briefly noted

#### Environment variable inventory (complete)

| Variable | Used by | Required | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `server/` | Yes (for LLM generation; falls back to static pool if absent) | Anthropic API key for Claude Haiku event generation |
| `FRONTEND_URL` | `server/` | Production only | Vercel frontend URL, whitelisted in CORS |
| `PORT` | `server/` | Railway injects automatically | Do not set manually |
| `VITE_API_URL` | `client/` | Production only | Railway backend URL for Vercel build |

**`PORT` note:** Railway injects `PORT` automatically. Setting it in Doppler or
any `.env` would override Railway's injection and break deployment. Leave it out.

**`VITE_API_URL` note:** This is a Vite build-time variable read via
`import.meta.env.VITE_API_URL`. It must be set in the Vercel project dashboard
(not Doppler), because Vercel reads it during the `npm run build` step.

---

## Implementation Order

### Step 1: TruffleHog CI

1. Create `.github/` and `.github/workflows/` directories
2. Write `.github/workflows/security.yml` per the spec above
3. Push to GitHub
4. Verify the Action appears in the repo's **Actions** tab and runs on the push
5. Confirm it passes (no secrets in history — the `.env` has always been git-ignored)

### Step 2: Doppler Guide

1. Write `project-specs/DOPPLER_GUIDE.md` with the content described above
2. Keep it lean: installation, variable inventory, `doppler run` usage, caveats
3. No code changes required — this is documentation only

---

## Verification

### TruffleHog

After pushing the workflow file:

1. Navigate to GitHub → Actions → **Security Scan**
2. The workflow should appear and complete with a green check
3. Verify the scan covered git history (check the log output for "Scanning...")
4. Optionally: stage-test a fake secret to confirm detection works (in a throwaway
   branch; remove it before merging)

### Doppler Guide

1. Read through the finished document as if you were a new contributor
2. Confirm every env var in the inventory matches what's in `server/.env.example`
3. The `doppler run` command examples should be runnable without modification

---

## Out of Scope

- Full Doppler integration (service tokens, CI injection, team sync) — guide only
- AWS Secrets Manager or HashiCorp Vault — beyond the scope of this project
- OpenTelemetry observability — also from the class requirements but a separate sprint
- `claude-code-action` GitHub App — mentioned in class notes; separate decision
- Dependency scanning (Dependabot, Snyk) — not requested in this sprint

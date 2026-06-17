# Deploy Guide

## Platform recommendation: Fly.io

**Chosen platform:** [Fly.io](https://fly.io)

**Why Fly.io:**
- Free allowance covers this app: 3 shared-CPU VMs + 160GB outbound transfer/month — enough for a portfolio project with no extra cost
- First-class Docker support; `fly deploy` just works with the root `Dockerfile`
- `fly postgres` provisions a managed Postgres in one command, in the same region
- São Paulo region (`gru`) available — low latency for Brazilian users
- Auto-stop/start when idle: machine hibernates between requests, saving resources on the free tier
- Render's free Postgres was dropped (only 90-day trial); Railway is pricier for low-traffic apps

---

## Files created

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage production build (Go binary ~10 MB) |
| `.dockerignore` | Excludes node_modules, .env, build artifacts |
| `fly.toml` | Fly.io app config (region gru, 256 MB VM, scale-to-zero) |
| `DEPLOY.md` | This guide |

---

## API Deploy — Fly.io

**App name: `managerfc-api`** (defined in `fly.toml`; use this in all `--app` flags below)

### Prerequisites (your machine — requires your account)

```bash
# Install flyctl
brew install flyctl          # macOS
# or: curl -L https://fly.io/install.sh | sh

# Log in / create account  ← YOUR ACTION REQUIRED
fly auth login
```

### Step 1 — Create the Fly app

```bash
# From repo root (fly.toml is already committed — no need for fly launch)
fly apps create managerfc-api --org personal
```

> **Note:** if you already ran `fly launch` or the app exists, skip this step. The `fly.toml` at the repo root already defines the config.

### Step 2 — Provision Postgres

```bash
fly postgres create \
  --name managerfc-db \
  --region gru \
  --vm-size shared-cpu-1x \
  --volume-size 1          # 1 GB — enough for a portfolio DB

# Attach the DB to the app (sets DATABASE_URL secret automatically)
fly postgres attach managerfc-db --app managerfc-api
```

> **Your action:** confirm the provisioning prompts. Fly sets `DATABASE_URL` as a secret automatically after `attach`.

### Step 3 — Set remaining secrets

```bash
# Generate a strong secret and set it in one command:
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" --app managerfc-api
```

### Step 4 — Deploy

```bash
# From repo root
fly deploy
```

Fly builds the image, pushes it, and runs the container. Migrations run automatically on startup (same as local).

### Step 5 — Verify

```bash
fly status --app managerfc-api
# Should show: running

fly logs --app managerfc-api
# Should show lines like:
#   DATABASE_URL and JWT_SECRET found
#   migrations: no change (or applied N migrations)
#   Listening on :8080

# Hit the live health endpoint
curl https://managerfc-api.fly.dev/health
# Expected: {"status":"ok"}
```

### Useful commands

```bash
fly open --app managerfc-api          # open in browser
fly ssh console --app managerfc-api   # shell into the VM
fly postgres connect --app managerfc-db  # psql session
fly secrets list --app managerfc-api  # confirm secrets are set
```

---

## Troubleshooting: 502 "App is not listening on expected port"

This error always means the Go process **exited before calling `app.Listen()`**. The app crashes at startup for one of these reasons (check `fly logs --app managerfc-api`):

### Most common: missing secrets

```
fatal: DATABASE_URL is not set
```
or
```
fatal: JWT_SECRET is not set
```

**Fix:** run steps 2 and 3 above, then `fly deploy` again.

Confirm secrets are present:
```bash
fly secrets list --app managerfc-api
# Must show: DATABASE_URL, JWT_SECRET
```

### DB unreachable at startup

```
migrations failed: ...
database connection failed: ...
```

**Fix:** confirm the Postgres cluster is running and attached:
```bash
fly status --app managerfc-db       # Postgres cluster health
fly postgres attach managerfc-db --app managerfc-api  # re-attach if needed
```

### Diagnostic workflow (run in order)

```bash
# 1. What error is logged?
fly logs --app managerfc-api

# 2. What secrets exist?
fly secrets list --app managerfc-api

# 3. Is the machine even starting?
fly status --app managerfc-api
fly machines list --app managerfc-api
```

---

## Environment variables (production)

| Variable | Source | Value |
|---|---|---|
| `DATABASE_URL` | Set by `fly postgres attach` | `postgres://...` (full URL) |
| `JWT_SECRET` | Set with `fly secrets set` | Strong random string (32+ bytes) |
| `PORT` | `fly.toml [env]` | `8080` |

**Never commit `.env` or secrets to git.**

---

## Mobile — Expo / EAS (high-level)

The mobile app currently points to `http://localhost:8080`. Before publishing:

1. **Set the API base URL** to your production URL (`https://managerfc-api.fly.dev`) — update the constant in `mobile/` where `localhost:8080` is referenced.

2. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   eas login    # ← YOUR ACTION: Expo account required
   ```

3. **Configure EAS build:**
   ```bash
   cd mobile
   eas build:configure   # creates eas.json
   ```

4. **Build for stores:**
   ```bash
   eas build --platform ios      # submits to Apple TestFlight
   eas build --platform android  # generates APK / AAB
   ```
   > **Your action:** Apple Developer account ($99/yr) for iOS; Google Play account ($25 one-time) for Android.

5. **Submit to stores:**
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

For development preview without store submission, use **Expo Go** (scan QR from `npx expo start`) or an **internal distribution build** via EAS.

---

## Docker build validation

```bash
# Build locally from repo root (no account needed):
docker build -t managerfc-api .

# Run locally against local Postgres:
docker run --rm \
  -e DATABASE_URL="postgres://brassfoot:brassfoot@host.docker.internal:5432/brassfoot?sslmode=disable" \
  -e JWT_SECRET="dev-secret" \
  -p 8080:8080 \
  managerfc-api
```

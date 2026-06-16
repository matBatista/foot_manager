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
# From repo root
fly launch --no-deploy \
  --name brassfoot-api \
  --region gru \
  --dockerfile Dockerfile

# fly launch will detect fly.toml and ask if you want to use it.
# Answer: yes — or pass --config fly.toml
```

> **Your action:** accept the generated fly.toml or confirm the existing one.

### Step 2 — Provision Postgres

```bash
fly postgres create \
  --name brassfoot-db \
  --region gru \
  --vm-size shared-cpu-1x \
  --volume-size 1          # 1 GB — enough for a portfolio DB

# Attach the DB to the app (sets DATABASE_URL secret automatically)
fly postgres attach brassfoot-db --app brassfoot-api
```

> **Your action:** confirm the provisioning prompts. Fly sets `DATABASE_URL` as a secret automatically after `attach`.

### Step 3 — Set remaining secrets

```bash
# Generate a strong secret:  openssl rand -hex 32
fly secrets set JWT_SECRET="<replace-with-strong-secret>" --app brassfoot-api
```

> **Your action:** replace `<replace-with-strong-secret>` with a value from `openssl rand -hex 32`.

### Step 4 — Deploy

```bash
# From repo root
fly deploy --app brassfoot-api
```

Fly builds the image, pushes it, and runs the container. Migrations run automatically on startup (same as local).

### Step 5 — Verify

```bash
fly status --app brassfoot-api
# Should show: running

fly logs --app brassfoot-api
# Should show: "Listening on :8080", migration lines

# Hit the live health endpoint
curl https://brassfoot-api.fly.dev/health
# Expected: {"status":"ok"}
```

### Useful commands

```bash
fly open --app brassfoot-api          # open in browser
fly ssh console --app brassfoot-api   # shell into the VM
fly postgres connect --app brassfoot-db  # psql session
fly secrets list --app brassfoot-api  # confirm secrets are set
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

1. **Set the API base URL** to your production URL (`https://brassfoot-api.fly.dev`) — update the constant in `mobile/` where `localhost:8080` is referenced.

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
docker build -t brassfoot-api .

# Run locally against local Postgres:
docker run --rm \
  -e DATABASE_URL="postgres://brassfoot:brassfoot@host.docker.internal:5432/brassfoot?sslmode=disable" \
  -e JWT_SECRET="dev-secret" \
  -p 8080:8080 \
  brassfoot-api
```

> **Status:** CONFIRMED — `docker build -t brassfoot-api .` executed successfully in this session. `golang:1.25-alpine` is available on Docker Hub. Final image is ~18 MB (Alpine + binary).

# Brassfoot

A mobile football manager game where the user becomes a football manager.

## Stack

- **Mobile**: React Native with Expo (TypeScript)
- **Backend**: Go with Fiber framework
- **Database**: PostgreSQL 16 (Docker Compose), pgx/v5 + golang-migrate

## Project Structure

```
Brassfoot/
├── mobile/     # React Native (Expo) — iOS & Android
└── api/        # Go (Fiber) — REST API
```

## Core Game Features (planned)

- User authentication & manager profile
- Team selection and squad management
- Player attributes & stats
- Match simulation engine
- Transfer market
- Season / league progression

## Dev Notes

- Mobile and API are separate apps in the same monorepo
- API runs locally on port 8080 during development
- Start the database: `docker compose up -d` (repo root)
- Run the API: `cd api && cp .env.example .env && go mod tidy && go run ./cmd/server`
  - Migrations (embedded in `internal/db/migrations/`) run automatically on startup
- Run the mobile app: `cd mobile && npx expo start`
- Squad endpoint reads from Postgres; seed data lives in migration `0002_seed`

## Version control & multi-session workflow

This project may be edited from more than one AI session/tool. Git is the only
coordination layer between them — follow this to avoid collisions:

- **Commit after every working chunk.** Small, frequent commits are checkpoints
  you can always return to. Never leave large amounts of work uncommitted.
- **Prefer one session at a time.** Sequential editing is safe; two sessions
  editing the same files at once is what causes duplicate/overwritten code.
- **If running two at once, isolate them** — e.g. one on `api/` (Go), one on
  `mobile/` (TypeScript), or on separate git branches / `git worktree`.
- **Pull/check `git status` before starting** so you build on the latest state.
- Write clear commit messages describing what changed and why.

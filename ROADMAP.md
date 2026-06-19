# Roadmap — ManagerFC

Vision checklist of what's done and what's next. Sub-bullets only when an item needs context.

## Done

- [x] Manager auth (register / login / JWT)
- [x] Brasileirão Série A — 20 clubs, 38 rounds
- [x] Match simulation engine with player attributes
- [x] Live standings table
- [x] Save / load game (multiple slots)
- [x] Mobile app — League, Match, Squad tabs
- [x] Deep statistics — xG, possession, passes, pass accuracy, corners, fouls, shots per match; derived from the sim engine, no extra RNG; stored in JSONB snapshot
- [x] Analytics layer — MatchDetails modal (stat bars A vs B, tap any league result), season-aggregate analytics panel in League screen (`GET /leagues/:id/analytics`)
- [x] Navigation redesign — clean Home (2 CTAs) → Career Hub (tab navigator) → Match screen; removed flat tab bar; `(career)/` group with Hub, Elenco, Liga, Mercado, Base tabs
- [x] Green visual identity — design tokens in `constants/theme.ts`; palette: primary `#22c55e`, bg `#0d1a0f`, gold `#fbbf24`; applied to all screens/components
- [x] Match / Game screen — football field layout with 4-4-2 formation (green home / red away), score card, stat bars (green vs red), events timeline; dual-mode: career round results + standalone simulate
- [x] Career Hub dashboard — club header, season progress bar, "Jogar Próxima Rodada" CTA, menu grid (Elenco/Mercado/Liga/Base), last round results, mini standings

## Planned

- [ ] Career round match linking — wire "Jogar Próxima Rodada" to show the manager's specific match (not just a static field layout); add real player names on field dots
- [ ] Pre-game / match-day area — lineups, player fatigue, substitutions before kickoff
- [ ] Transfer market full cycle — AI-to-AI transfers, salary/contracts, transfer window dates, transaction history
- [ ] Player development — attributes evolve across seasons
- [ ] Deep statistics — top scorers, assists, cards per player
- [ ] Categoria de Base (Academy) — youth player recruitment and development
- [ ] Push notifications for match results

## Open decisions

- [ ] Project name — ManagerFC is the front-runner (check store/domain availability)

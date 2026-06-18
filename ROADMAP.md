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

## Planned

- [ ] Remove old Match Day page — drop the manual pick-two-teams screen (keep the sim engine)
- [ ] Pre-game / match-day area — both teams, lineups, player fatigue, substitutions before kickoff
- [ ] Transfer market — buy/sell players between clubs
  - needs: AI-to-AI transfers, salary/contracts, transfer window dates, transaction history
- [ ] Player development — attributes evolve across seasons
- [ ] Multiple seasons — promotion/relegation system
- [ ] Deep statistics — top scorers, assists, cards, possession, xG
- [ ] Push notifications for match results
- [ ] Sporty visual identity — green palette, card/whistle icons (Flashscore/Sofascore style)

## Open decisions

- [ ] Project name — ManagerFC is the front-runner (check store/domain availability)

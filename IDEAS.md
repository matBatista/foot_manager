# IDEAS — ManagerFC

Caderno de anotações. **Nada aqui está decidido** — são direções e observações soltas
para discutir com calma depois. Quando uma ideia vira trabalho de fato, ela sobe para o
**[ROADMAP.md](ROADMAP.md)** e aqui fica só a anotação com o link apontando para lá.

---

## 1. Nome do projeto / marca ✅ DECIDIDO

**Nome escolhido: ManagerFC.** Candidatos avaliados foram: Brassfoot, Brasfoot, Manager
Esportivo, Manager Sport Club, Sports Manager e ManagerFC. A escolha recaiu sobre ManagerFC
por comunicar claramente o papel (manager) e o contexto esportivo (FC), funcionar em PT e EN,
e não colidir com a marca registrada *Bras Foot*.

Implementado em: app.json (name/slug/scheme), telas mobile, AppName da API, docs e README.

---

## 2. Transferências — o que ficou "para depois"

Anotação a partir do commit `a6dc47a` (*Transfer Market — milestone 1: free-agent pool*).
A milestone 1 entregou só a compra/venda de agentes livres. O que ficou para depois:

- Clubes da IA fazendo transferências entre si
- Negociação de salários / contratos
- Janela de transferências com datas de abertura/fechamento
- Histórico de transações do manager

→ Roadmap: [Planned — Transfer market](ROADMAP.md#planned) (já listado como sub-itens)

---

## 3. Redesign de navegação e identidade visual — commit `592108f` (2026-06-19)

**Entregue:** fluxo Home → Career Hub → Match + paleta verde.

- Paleta verde: `#22c55e` primary, `#0d1a0f` bg, `#fbbf24` gold — centralizada em `constants/theme.ts`
- Nova estrutura Expo Router: `app/(career)/` com tab navigator (Hub, Elenco, Liga, Mercado, Base)
- Tela de Jogo: campo virtual 4-4-2, placar, stat bars verde/vermelho, modo career + standalone
- `store/matchStore.ts` conecta Hub → Partida (passa resultados da rodada)
- `screens/SelectTeamScreen.tsx` agora redireciona para `/(career)` após seleção

**Próximos passos desta direção:**
- Nomes reais dos jogadores nos pontos do campo (precisa combinar squad API com a tela de jogo)
- Animação básica dos eventos (gol, cartão) no campo durante a partida
- Tela de Academia com dados reais (base juvenil)

---

## 3. Estatísticas e análise durante/após a partida ✅ IMPLEMENTADO

Partida agora mostra posse, chutes/no alvo, **xG** (derivado das mesmas probabilidades
que geram gols — coerente), passes, precisão de passe, escanteios, faltas, cartões.
Engine extendida sem alterar o processo de simulação (XG acumulado por chance; demais
derivados determinísticos de shots/cards/possession).

→ Implementado em: `api/internal/match/engine.go`, `api/internal/league/fixtures.go`,
`api/internal/league/season.go`, `api/internal/handler/league.go`,
`mobile/screens/MatchScreen.tsx`, `mobile/components/MatchDetailsModal.tsx`

---

## 4. Camada analítica integrada à experiência de manager ✅ IMPLEMENTADO (base)

Tela de detalhes da partida (modal com barras comparativas A vs B), acessível ao tocar
num resultado na aba Liga. Análise agregada de temporada via `GET /api/v1/leagues/:id/analytics`
(xG for/against, posse média, chutes médios por time) com botão "Ver Análise" na Liga.

→ Implementado em: `mobile/components/MatchDetailsModal.tsx`,
`mobile/screens/LeagueScreen.tsx`, `api/internal/handler/league.go`

Itens para evoluir: comparação de jogadores para escalação, scout de adversários,
forma nas últimas N rodadas, gráfico de evolução na tabela.

---

## 5. Design com identidade esportiva

Visual com cara de futebol, inspirado em Flashscore/Sofascore: ícones de cartão amarelo/
vermelho, apito, campo, bola, substituição; tipografia condensada estilo transmissão.

→ Roadmap: [Planned — Sporty visual identity](ROADMAP.md#planned)

---

## 6. Identidade visual — paleta de cores

Direção: verde como cor primária. Em aberto: qual tom (campo / escuro / neon), cor
secundária, modo claro+escuro, e como o verde convive com os ícones de cartão amarelo/vermelho.

→ Roadmap: parte de [Sporty visual identity](ROADMAP.md#planned)

---

*Última atualização: 2026-06-18*

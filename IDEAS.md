# IDEAS — Brassfoot

Caderno de anotações. **Nada aqui está decidido** — são direções e observações soltas
para discutir com calma depois. Quando uma ideia vira trabalho de fato, ela sobe para o
**[ROADMAP.md](ROADMAP.md)** e aqui fica só a anotação com o link apontando para lá.

---

## 1. Nome do projeto / marca

`Brassfoot / Brasfoot` foi questionado — pode não ser ideal para lançamento ou portfólio
(*Bras Foot* já é marca registrada de uma série de jogos). Candidatos: Manager Esportivo,
Manager Sport Club, Sports Manager e **ManagerFC** (favorito atual).

Em aberto: comunica bem o escopo? PT, EN ou bilíngue? Público é BR ou recrutador
internacional? Verificar disponibilidade nas stores, domínio e redes.

→ Roadmap: [Open decisions — nome do projeto](ROADMAP.md#open-decisions)

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

## 3. Estatísticas e análise durante/após a partida

Hoje a partida mostra só placar. Ideia: posse de bola, chutes/chutes a gol, **xG**, passes,
faltas, escanteios, cartões, melhor jogador da partida. Em aberto: feed ao vivo vs. só
resumo pós-jogo; o que o motor em `api/internal/match/` já produz.

→ Roadmap: [Planned — Deep statistics](ROADMAP.md#planned)

---

## 4. Camada analítica integrada à experiência de manager

O jogador deve se sentir **manager/técnico**, não espectador: painel de desempenho do elenco,
comparação de jogadores para escalação, scout de adversários, forma nas últimas N rodadas,
gráfico de evolução na tabela. Em aberto: onde vive na UI e qual o mínimo viável.

→ Roadmap: relacionado a [Player development + Deep statistics](ROADMAP.md#planned)

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

*Última atualização: 2026-06-17*

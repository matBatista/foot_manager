# IDEAS — Brassfoot

Registro de ideias para discussão futura. **Nada aqui está decidido** — são direções levantadas para alinhar em sessões posteriores com mais calma. Adicionar aqui é suficiente; não cria nenhuma tarefa de implementação.

---

## 1. Nome do projeto / marca

O nome atual **Brassfoot / Brasfoot** foi questionado — pode não ser o ideal para um lançamento ou para o portfólio.

**Candidatos levantados:**
- Manager Esportivo
- Manager Sport Club
- Sports Manager

**Perguntas em aberto:**
- Qual nome comunica melhor o escopo (manager game + Brasil)?
- O nome precisa ser em português, inglês ou bilíngue?
- Qual o público-alvo principal: usuários brasileiros ou recrutadores internacionais?
- Verificar disponibilidade: nome do app nas stores (App Store / Play Store), domínio, redes sociais, possíveis conflitos de marca com jogos já existentes (ex: Bras Foot já é marca registrada de série histórica de jogos).

---

## 2. Estatísticas e análise durante/após a partida

Hoje a partida mostra apenas placar/resultado. A ideia é exibir dados analíticos que tornem a experiência mais rica:

**Possíveis métricas a exibir:**
- Posse de bola (%)
- Chutes a gol / chutes totais
- xG — gols esperados (expected goals)
- Passes completados / tentativas
- Faltas, escanteios, cartões
- Melhores jogadores da partida (rating por desempenho)

**Perguntas em aberto:**
- Quais métricas o motor de simulação já produz internamente? (Ver `api/internal/match/`)
- Exibir só no resumo pós-jogo ou também como feed ao vivo durante a simulação?
- Que nível de detalhe faz sentido para um MVP dessas estatísticas?

**Conexão com roadmap existente:** o item *"Deep statistics — top scorers, assists, cards"* no README já aponta nessa direção; esse tema expande o escopo para a partida individual.

---

## 3. Camada analítica integrada à experiência de manager

Ideia mais ampla: o jogador deve se sentir imerso no papel de **manager/técnico**, não só de espectador. Isso passa por uma camada analítica/estatística que dê ao jogador informação para tomar decisões.

**Exemplos de funcionalidades que se encaixam aqui:**
- Painel de desempenho do elenco ao longo da temporada
- Comparação de jogadores para decisões táticas (quem escalar)
- Relatórios de scout sobre adversários
- Histórico de desempenho por partida (jogador X nas últimas 5 rodadas)
- Gráfico de evolução na tabela ao longo do campeonato

**Perguntas em aberto:**
- Onde essa camada analítica vive na UI? (Aba dedicada? Integrada ao Squad? Tela de match detail?)
- Qual o mínimo viável para transmitir imersão sem sobrecarregar a UI?

**Conexão com roadmap existente:** se encaixa com *"Player development"* e *"Deep statistics"* — os dados coletados para estatísticas podem alimentar a evolução de atributos.

---

## 4. Design com identidade esportiva

O visual atual é funcional mas genérico. A direção levantada é um design com **cara de futebol**, inspirado em apps como Flashscore e Sofascore.

**Elementos sugeridos:**
- Ícones de cartão amarelo e vermelho
- Ícone de apito para partidas / rodadas
- Iconografia de campo, bola, substituição
- Tipografia e layout que lembrem painéis de transmissão ou apps de resultados
- Possível uso de fontes condensadas / bold style esportivo

**Perguntas em aberto:**
- Qual o grau de customização visual que o Expo/React Native permite de forma prática (sem sacrificar cross-platform)?
- Criar uma design system própria ou buscar uma biblioteca de componentes esportivos existente?
- Como garantir acessibilidade (contraste, tamanho de toque) com um visual mais denso?

---

## 5. Identidade visual — paleta de cores

**Direção levantada:** verde como cor primária do app.

**Perguntas em aberto:**
- Qual tom de verde? (Verde campo, verde escuro tipo uniforme, verde limão estilo neon?)
- Cor secundária/de apoio? (Branco, cinza escuro, preto, dourado?)
- A paleta precisa funcionar em modo escuro e claro?
- Como o verde interage com os ícones de cartão (amarelo/vermelho do item 4) sem colidir?

**Conexão com item 4:** paleta e ícones precisam ser definidos juntos como parte de uma única decisão de design.

---

## Como essas ideias se encaixam no roadmap atual

| Ideia aqui | Item no roadmap (README) | Relação |
|---|---|---|
| Estatísticas de partida (item 2) | Deep statistics — top scorers, assists, cards | Expande para o nível de partida individual |
| Camada analítica (item 3) | Player development + Deep statistics | Dados de performance alimentam evolução de atributos |
| Design esportivo (item 4) | — | Novo; não consta no roadmap |
| Identidade visual / verde (item 5) | — | Novo; não consta no roadmap |
| Renome do projeto (item 1) | — | Decisão de marca; afeta README, stores e deploy |

Os itens do roadmap ainda planejados (**transfer market**, **multiple seasons**, **push notifications**) continuam válidos e independentes dessas ideias — nenhuma delas os bloqueia ou substitui.

---

*Última atualização: junho 2026*

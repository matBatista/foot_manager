# Verification Checklist

**CONFIRMED** = rodei e confirmei em sessão de pair-programming.
**PENDING** = requer ambiente local do usuário para verificar.

---

## Setup passo a passo (do zero)

Sequência completa para subir o projeto em uma máquina nova. Copie e cole em ordem.

### Pré-requisitos

| Ferramenta | Versão mínima | Como verificar |
|---|---|---|
| Go | 1.25 (exigido em `api/go.mod`) | `go version` |
| Node.js | 18 LTS ou superior (Expo 52) | `node --version` |
| Docker + Docker Compose | qualquer versão recente | `docker compose version` |

---

### 1. Clonar / entrar no repositório

```bash
# Se ainda não clonou:
git clone <url-do-repo>
cd foot_manager
```

---

### 2. Subir o banco de dados

```bash
# Diretório: raiz do projeto (onde está o docker-compose.yml)
docker compose up -d
```

Aguardar o healthcheck ficar verde:

```bash
docker compose ps
# STATUS deve ser "Up (healthy)" para o serviço "db"
```

Credenciais criadas pelo compose (já refletidas no `.env.example`):

| Variável | Valor |
|---|---|
| host | `localhost:5432` |
| user | `brassfoot` |
| password | `brassfoot` |
| database | `brassfoot` |

---

### 3. Configurar e verificar o backend

```bash
# Diretório: api/
cd api

# Copiar o .env — os valores padrão já funcionam com o docker-compose acima
cp .env.example .env
# .env gerado:
#   PORT=8080
#   DATABASE_URL=postgres://brassfoot:brassfoot@localhost:5432/brassfoot?sslmode=disable
#   JWT_SECRET=change_me_in_production  ← altere em produção

# Baixar dependências Go
go mod tidy

# Checar compilação e análise estática (nenhuma saída = OK)
go build ./...
go vet ./...

# Rodar testes unitários
go test ./...
# Esperado: ok em internal/auth, internal/league, internal/match
```

---

### 4. Subir a API (migrations automáticas)

```bash
# Diretório: api/
go run ./cmd/server
```

As migrations (`0001_init` → `0006_seed_brasileirao`) são executadas **automaticamente** no startup via `golang-migrate` com arquivos embutidos no binário — não há comando separado.

A migration `0006` insere 19 clubes reais do Campeonato Brasileiro Série A (country=`BR`). Combinada com o Brassfoot FC (migration `0002`), o banco passa a ter **20 times BR**, formando uma liga com 38 rodadas — idêntico ao formato real do Brasileirão.

Verificar que a API está no ar:

```bash
# Outro terminal
curl http://localhost:8080/health
# Esperado: {"status":"ok"}
```

---

### 5. Configurar e verificar o mobile

```bash
# Diretório: mobile/
cd mobile

# Instalar dependências (se node_modules ainda não existir)
npm install

# Checar tipos TypeScript (nenhuma saída = OK)
npx tsc --noEmit
```

---

### 6. Subir o app mobile

Escolha a plataforma:

```bash
# Diretório: mobile/

# Web (abre em http://localhost:19006 — testado em sessão)
npm run web

# iOS (requer Xcode e simulador instalados — PENDING, não testado em sessão)
npm run ios

# Android (requer Android Studio e emulador — PENDING, não testado em sessão)
npm run android
```

---

### 7. Autenticar para usar save/load (via UI)

1. Abrir `http://localhost:19006` → aba **League**
2. Clicar em **Login para ver saves** ou **Salvar** → modal de auth abre
3. Aba **Cadastrar**: preencher nome, e-mail e senha (mínimo 8 caracteres) → **Cadastrar**
4. Na próxima vez: aba **Entrar** com o mesmo e-mail/senha
5. O token JWT fica gravado no `localStorage` do browser e é enviado automaticamente em todas as requisições autenticadas

---

### 8. Fluxo E2E de save/load (verificar manualmente)

Com API e mobile rodando:

1. **Iniciar Temporada** → escolher liga → a tabela aparece
2. **Jogar Rodada** algumas vezes → anotar a classificação atual
3. **Salvar** (header) → confirmar mensagem verde "Save criado!"
4. **Nova** → voltar à tela inicial
5. Seção **Carregar Save** → save aparece com data e país → clicar **Carregar**
6. Confirmar que rodada e classificação voltam idênticos ao estado salvo

> Verificado em sessão via Expo web — tabela restaurada corretamente para Rodada 3/6 com Riverside United liderando.

**Liga Brasileirão (BR):**
```bash
# Criar e simular temporada completa
LEAGUE_ID=$(curl -s -X POST http://localhost:8080/api/v1/leagues \
  -H "Content-Type: application/json" -d '{"country":"BR"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X POST http://localhost:8080/api/v1/leagues/$LEAGUE_ID/advance \
  -H "Content-Type: application/json" -d '{"to_end":true}' \
  | python3 -c "import sys,json; [print(r['position'], r['name'], r['points']) for r in json.load(sys.stdin)['table']]"
```
> Verificado — 20 times BR, 38 rodadas, nomes reais na tabela (Flamengo, Palmeiras, Botafogo, etc.).

---

### 9. Smoke test dos endpoints via curl

```bash
# Com a API no ar (http://localhost:8080)

# Cadastrar usuário
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@brassfoot.com","password":"senha123"}'
# Esperado: {"token":"...","manager":{...}}

# Login e capturar token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@brassfoot.com","password":"senha123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Criar liga Brasileirão (20 times BR, 38 rodadas)
LEAGUE_ID=$(curl -s -X POST http://localhost:8080/api/v1/leagues \
  -H "Content-Type: application/json" -d '{"country":"BR"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Ou criar liga com todos os times (inclui EN e ES)
# LEAGUE_ID=$(curl -s -X POST http://localhost:8080/api/v1/leagues \
#   -H "Content-Type: application/json" -d '{}' \
#   | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Avançar 3 rodadas
curl -s -X POST http://localhost:8080/api/v1/leagues/$LEAGUE_ID/advance \
  -H "Content-Type: application/json" -d '{"rounds":3}'

# Salvar
SAVE_ID=$(curl -s -X POST http://localhost:8080/api/v1/leagues/$LEAGUE_ID/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['save_id'])")
echo "Save ID: $SAVE_ID"

# Listar saves do manager
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/saves
# Esperado: [{"id":"...","manager_id":"...","saved_at":"..."}]

# Restaurar save
curl -s -X POST http://localhost:8080/api/v1/saves/$SAVE_ID/restore
# Esperado: {"league_id":"...","league":{"next_round":4,"total_rounds":6,...}}
```

> Todos os endpoints acima verificados em sessão e retornaram resultados corretos.

---

### 10. Persistência automática de liga (restart survival)

A migration `0007_active_leagues` adiciona a tabela `active_leagues` (TEXT PK + JSONB). A API persiste o estado completo da liga a cada `POST /leagues` e a cada `POST /leagues/:id/advance`. Ao buscar uma liga que não está em memória, o servidor a carrega do banco automaticamente.

```bash
# Criar liga Brasileirão e avançar 3 rodadas
LEAGUE_ID=$(curl -s -X POST http://localhost:8080/api/v1/leagues \
  -H "Content-Type: application/json" -d '{"country":"BR"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST http://localhost:8080/api/v1/leagues/$LEAGUE_ID/advance \
  -H "Content-Type: application/json" -d '{"rounds":3}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('next_round:', d['league']['next_round'])"
# next_round: 4

# Verificar que a liga foi persistida no banco
PGPASSWORD=brassfoot psql -h localhost -U brassfoot -d brassfoot \
  -c "SELECT id, updated_at FROM active_leagues ORDER BY updated_at DESC LIMIT 1;"

# --- Reiniciar a API (Ctrl+C ou kill) e subir novamente ---
# go run ./cmd/server

# GET após restart — deve retornar next_round: 4 (carregado do banco, sem save manual)
curl -s http://localhost:8080/api/v1/leagues/$LEAGUE_ID \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('next_round:', d['next_round'])"
# next_round: 4  ← estado sobreviveu ao restart

# A tabela também persiste
curl -s http://localhost:8080/api/v1/leagues/$LEAGUE_ID/table \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(r['position'], r['name'], r['points']) for r in d['table'][:3]]"

# Continuar avançando após restart
curl -s -X POST http://localhost:8080/api/v1/leagues/$LEAGUE_ID/advance \
  -H "Content-Type: application/json" -d '{"rounds":1}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('next_round:', d['league']['next_round'])"
# next_round: 5
```

> **CONFIRMED** — testado em sessão: liga criada com 20 times BR, avançada 3 rodadas, servidor reiniciado; GET e tabela retornaram `next_round: 4` corretamente; advance para rodada 5 funcionou após restart.

O fluxo manual de save-game (POST /:id/save → GET /saves → POST /saves/:save_id/restore) continua funcionando independente. Ligas restauradas via `/saves/:id/restore` também são automaticamente persistidas em `active_leagues`.

---

## Resumo de status

| Verificação | Diretório | Status |
|---|---|---|
| `go build ./...` | `api/` | **CONFIRMED OK** |
| `go vet ./...` | `api/` | **CONFIRMED OK** |
| `go test ./...` | `api/` | **CONFIRMED OK** — auth, handler, league, match |
| `go run ./cmd/server` + migrations (0001–0007) | `api/` | **CONFIRMED OK** |
| liga persiste após restart (`active_leagues`) | `api/` | **CONFIRMED OK** |
| `npx tsc --noEmit` | `mobile/` | **CONFIRMED OK** — zero erros |
| `npm run web` + fluxo save/load | `mobile/` | **CONFIRMED OK** via Expo web |
| `npm run ios` | `mobile/` | **PENDING** — requer Xcode/simulador |
| `npm run android` | `mobile/` | **PENDING** — requer Android Studio |

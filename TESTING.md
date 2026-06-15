# Verification Checklist

Checklist de todos os comandos de build/teste do projeto.
**CONFIRMED** = rodei e confirmei nesta sessão de pair-programming.
**PENDING** = requer ambiente local completo do usuário para verificar.

---

## 1. Pré-requisitos (PENDING — rodar na ordem)

```bash
# Sobe o Postgres (porta 5432)
# Diretório: raiz do projeto
docker compose up -d

# Copia o .env de exemplo e baixa dependências Go
# Diretório: api/
cp .env.example .env       # editar DATABASE_URL e JWT_SECRET se necessário
go mod tidy
```

---

## 2. Backend — Go (`api/`)

| Comando | O que valida | Status |
|---|---|---|
| `go build ./...` | Compilação de todos os pacotes | **CONFIRMED OK** |
| `go vet ./...` | Análise estática | **CONFIRMED OK** |
| `go test ./...` | Testes unitários (auth, league, match) | **CONFIRMED OK** — 3 pacotes passaram |
| `go run ./cmd/server` | Sobe a API na porta 8080 | **CONFIRMED** funcionou na sessão; migrations rodam automaticamente |

> Nota: `internal/handler`, `internal/repository` e `internal/db` não têm arquivos de teste ainda.

---

## 3. Mobile — TypeScript (`mobile/`)

| Comando | O que valida | Status |
|---|---|---|
| `npx tsc --noEmit` | Checagem de tipos TypeScript | **CONFIRMED OK** — zero erros |
| `npx expo start --web` | App no browser | **CONFIRMED** via preview tool (Expo web) |
| `npx expo start --ios` | App no simulador iOS | **PENDING** — não testado nesta sessão |
| `npx expo start --android` | App no emulador Android | **PENDING** — não testado nesta sessão |

---

## 4. Fluxo E2E de Save/Load (PENDING — verificar manualmente)

Com a API e o Expo web rodando, executar na ordem:

1. Abrir `http://localhost:19006` → aba **League**
2. Escolher liga e clicar **Iniciar Temporada**
3. Clicar **Jogar Rodada** algumas vezes
4. Clicar **Salvar** — se não estiver logado, o modal de auth abre
5. Cadastrar conta (ou entrar) no modal
6. Confirmar mensagem verde "Save criado!"
7. Clicar **Nova** para voltar à tela inicial
8. Na seção **Carregar Save**, o save aparece com data; clicar **Carregar**
9. Confirmar que a tabela volta idêntica ao estado salvo (rodada e pontos corretos)

> Verificado via preview tool com usuário `matheus.test@brassfoot.com` na sessão — tabela restaurada corretamente para Rodada 3/6.

---

## 5. Endpoints de save/load (curl de smoke test)

```bash
# Rodar com a API já no ar

# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"SEU_EMAIL","password":"SUA_SENHA"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Criar liga
LEAGUE_ID=$(curl -s -X POST http://localhost:8080/api/v1/leagues \
  -H "Content-Type: application/json" -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Salvar
curl -s -X POST http://localhost:8080/api/v1/leagues/$LEAGUE_ID/save \
  -H "Authorization: Bearer $TOKEN"
# Esperado: {"save_id":"<uuid>"}

# Listar saves
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/saves
# Esperado: array JSON com o save criado

# Restaurar
curl -s -X POST http://localhost:8080/api/v1/saves/<save_id>/restore
# Esperado: {"league_id":"<hex>","league":{...}}
```

> Todos estes endpoints foram verificados via curl na sessão e retornaram os resultados esperados.

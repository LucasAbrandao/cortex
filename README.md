# Cortex

Aplicação de análise de automobilismo: Next.js/React/TypeScript no
frontend, FastAPI/FastF1 no backend e tipos gerados de Pydantic/OpenAPI.

## Estado atual

Consulte [docs/STATUS.md](docs/STATUS.md) para o estado vigente, a próxima
entrega e as evidências. O Race Explorer é o módulo para a sessão real de
Belgium/Spa 2025; o Telemetry Lab importa e analisa CSV/JSON reais localmente,
com mapeamento confirmado e sem persistência. O [histórico](docs/history/STATUS_2026-09-09.md) preserva os
resultados das rodadas anteriores.

## Ambiente reproduzível

Use as versões de referência do projeto:

- Node.js 22;
- npm 11.7.0;
- Python 3.13;
- uv 0.12.4.

A CI configura Node.js 22, npm 11.7.0, Python 3.13 e uv 0.12.4, com instalação
pelos lockfiles. Resultados locais e da CI são registrados em `docs/STATUS.md`.

Execute todos os comandos a partir da raiz do repositório. `npm ci` recria as
dependências JavaScript exatamente a partir de `package-lock.json` e `uv sync
--frozen` usa `services/api/uv.lock` sem atualizá-lo. Isso evita que duas
máquinas resolvam versões diferentes.

### 1. Conferir a configuração local

Nenhum arquivo de ambiente é necessário para a execução padrão. Os defaults do
código, documentados em `.env.example`, conectam a web em
`http://127.0.0.1:3000` à API em `http://127.0.0.1:8000/api`. Os diretórios
`fastf1-cache` e `normalized-cache` são locais, ignorados pelo Git e podem
começar vazios.

O projeto não carrega automaticamente um `.env` na raiz. Quando precisar
alterar algum valor, defina a variável no terminal antes do comando que a usa.
Por exemplo, no PowerShell:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:8000/api"
$env:FASTF1_CACHE_DIR = "fastf1-cache"
$env:NORMALIZED_CACHE_DIR = "normalized-cache"
$env:CORTEX_ALLOWED_ORIGINS = "http://127.0.0.1:3000,http://localhost:3000"
```

`NEXT_PUBLIC_API_BASE_URL` deve estar definido antes de `npm run build` ou
`npm run dev:web`. As demais variáveis devem estar definidas no terminal que
inicia a API. Não registre caminhos privados, credenciais ou segredos.

### 2. Restaurar as dependências bloqueadas

```powershell
npm ci
uv sync --directory services/api --all-groups --frozen
```

Use `npm ci`, e não `npm install`, para reproduzir o lockfile sem recalcular
dependências. Não é necessário ativar manualmente um ambiente virtual: `uv run`
usa o ambiente de `services/api` criado pelo comando acima.

### 3. Validar e compilar antes de iniciar os servidores

```powershell
npm run check:core
```

`npm run check:core` executa lint, typecheck, testes web, testes API, verificação
dos contratos e build em sequência. Esses comandos também podem ser executados
individualmente. O lint inclui TypeScript/TSX com ESLint e Python com Ruff.
`npm run build` verifica o pacote de contratos e gera o build de produção da
web; a API é verificada por Mypy e Pytest.

`npm run contracts:check` gera OpenAPI e TypeScript em um diretório temporário
ignorado e compara o conteúdo com os artefatos atuais, normalizando CRLF. Não
modifica os arquivos versionados nem depende do índice Git. Se estiverem
desatualizados, execute `npm run contracts:generate` e revise as alterações.

Somente prossiga quando esses comandos passarem. Assim, erros de dependência,
tipagem, contrato ou compilação aparecem antes de qualquer servidor de
desenvolvimento ser iniciado.

### 4. Iniciar a API e depois a web

Abra dois terminais na raiz do repositório. No primeiro, inicie a API:

```powershell
uv run --directory services/api --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Confirme `http://127.0.0.1:8000/api/health`. Depois, no segundo terminal,
inicie a web:

```powershell
npm run dev:web
```

Acesse `http://127.0.0.1:3000`. Mantenha ambos os processos ativos durante o
desenvolvimento; alterações no backend e no frontend são recarregadas pelos
respectivos servidores.

### 5. Verificação E2E opcional

Com as dependências instaladas, o E2E determinístico pode ser executado com:

```powershell
npm run e2e -- --workers=1
```

Esse conjunto usa fixtures e não depende da rede FastF1. O smoke com a sessão
real é separado, exige API ativa e cache local previamente preenchido; veja
`docs/TESTING.md`. O projeto é executado localmente, sem deploy ou autenticação.

Para executar o core e depois o E2E determinístico com um worker, use
`npm run check`.

## Referências

- `docs/STATUS.md`: estado vigente, prioridades e validações atuais.
- `docs/history/STATUS_2026-09-09.md`: histórico integral das rodadas anteriores.
- `docs/DECISIONS.md`: decisões e precedência das evoluções.
- `docs/PROJECT_STANDARDS.md`: padrões do Race Explorer para o restante do projeto.
- `docs/RACE_EXPLORER_REQUIREMENTS.md`: comportamento atual do módulo.
- `docs/TELEMETRY_IMPORT_REQUIREMENTS.md`: formatos, limites e análise real local.
- `docs/DATA_CONTRACT.md` e `docs/API_CONTRACT.md`: integridade e API.

`apps/web`, `services/api`, `packages/contracts`, `fixtures`, `docs` e `prompts`
formam o monorepo. Prompts de fases concluídas são históricos; não reinicializar
o projeto nem reinstalar dependências para retomá-lo.

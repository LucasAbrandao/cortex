# Cortex

Aplicação bilíngue de análise de automobilismo: Next.js/React/TypeScript no
frontend, FastAPI/FastF1 no backend e tipos gerados de Pydantic/OpenAPI.
Português é o idioma inicial.

## Estado atual

Race Explorer funcional para Belgium/Spa 2025 Race, com carga explícita,
cache público, replay global ou comparação de voltas, cena 3D com fallback 2D,
classificação por registros e gráficos de amostras originais. A cena permite
mostrar todos os pilotos; foco e até quatro séries nos gráficos são independentes.

Telemetry Lab possui rotas e estados de protótipo. Seleção de arquivo está
desabilitada e a sessão é um placeholder; preview, mapeamento e workspace
com fixture da Fase 04 ainda precisam ser implementados. Não há upload real.

## Desenvolvimento local

As dependências estão fixadas em `package-lock.json` e `services/api/uv.lock`.
Configuração local de exemplo em `.env.example`; instalação de dependências
segue a autorização exigida em `AGENTS.md`.

- Web: `npm run dev:web`.
- API: `uv run --directory services/api uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
- Gates: `npm run lint`, `npm run typecheck`, `npm run test:web`,
  `npm run test:api`, `npm run build`, `npm run contracts:check`, `npm run e2e`.

A CI determinística usa fixtures. O smoke FastF1 real é separado e requer
API/cache local; veja `docs/TESTING.md`. Execução local, sem deploy ou autenticação.

## Referências

- `docs/STATUS.md`: estado vigente, validações e histórico.
- `docs/DECISIONS.md`: decisões e precedência das evoluções.
- `docs/PROJECT_STANDARDS.md`: padrões do Race Explorer para o restante do projeto.
- `docs/RACE_EXPLORER_REQUIREMENTS.md`: comportamento atual do módulo.
- `docs/TELEMETRY_IMPORT_REQUIREMENTS.md`: escopo futuro da Fase 04.
- `docs/DATA_CONTRACT.md` e `docs/API_CONTRACT.md`: integridade e API.

`apps/web`, `services/api`, `packages/contracts`, `fixtures`, `docs` e `prompts`
formam o monorepo. Prompts de fases concluídas são históricos; não reinicializar
o projeto nem reinstalar dependências para retomá-lo.

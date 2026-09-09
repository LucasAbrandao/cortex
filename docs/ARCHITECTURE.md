# Arquitetura

## Contextos

```text
apps/web
  ├─ navegação e apresentação
  ├─ estado do workspace
  └─ gráficos, tabela e pista
          │ HTTP + OpenAPI
services/api
  ├─ rotas e jobs
  ├─ normalização canônica
  ├─ adaptador FastF1
  └─ cache público
          │
FastF1 e fontes públicas
```

O Telemetry Lab do protótipo lê apenas amostras locais para preview visual; sua futura normalização deverá entrar por um adaptador e produzir o mesmo contrato.

## Monorepo

- `apps/web`: App Router, componentes, estilos, i18n e testes web.
- `services/api`: aplicação, modelos Pydantic, adaptadores, jobs, cache e Pytest.
- `packages/contracts`: saída gerada, cliente fino e validações compartilhadas do frontend.
- `fixtures`: dados mínimos, anônimos e versionáveis; nenhum dump real grande.
- `docs` e `prompts`: fonte de intenção e execução.

## Fonte de verdade

Pydantic define respostas e erros; FastAPI expõe OpenAPI; um script determinístico gera TypeScript. Não manter tipos públicos manualmente em dois idiomas.

## Fluxo FastF1

1. Frontend solicita job para `{year: 2025, event: "Belgium", session: "R"}`.
2. API valida contra capacidades habilitadas e cria job em memória.
3. Adaptador consulta cache normalizado; em miss, usa FastF1 com cache nativo habilitado.
4. Normalizador produz manifesto, replay, voltas, séries e disponibilidade.
5. Resultado público normalizado é cacheado com versão.
6. Frontend consulta o job, recebe `sessionId` e busca recursos sob demanda.

## Concorrência e ciclo de vida

- Jobs possuem estados discriminados e cancelamento cooperativo.
- Requisições idênticas em andamento compartilham o mesmo trabalho, sem iniciar downloads duplicados.
- Metadados do job ficam em memória e expiram; cache público tem ciclo separado.
- O protótipo usa polling com backoff limitado; transporte em tempo real fica adiado.

## Dependências futuras

Deploy exigirá armazenamento persistente para cache, limitação de uso, observabilidade e política de expiração distribuída. Esses itens não devem ser simulados no protótipo local.

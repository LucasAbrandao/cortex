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

O Telemetry Lab usa um worker nativo para ler, validar e normalizar CSV/JSON reais
em memória no navegador (D-020). Um provider no layout do módulo mantém o estado
efêmero entre inspeção e análise; saída, reset ou reload descartam tudo. Séries,
canais e amostras usam os tipos canônicos gerados; `ImportedTelemetrySession`
contém apenas metadados específicos da fonte local. Não há envio, endpoint de
upload ou persistência. FastF1/Pandas/RCZ continuam fora do navegador.

## Monorepo

- `apps/web`: App Router, componentes, estilos, i18n e testes web.
- `services/api`: aplicação, modelos Pydantic, adaptadores, jobs, cache e Pytest.
- `packages/contracts`: saída gerada, cliente fino e validações compartilhadas do frontend.
- `fixtures`: dados mínimos, anônimos e versionáveis; nenhum dump real grande.
- `docs` e `prompts`: fonte de intenção e execução.

## Fonte de verdade

Pydantic define respostas e erros; FastAPI expõe OpenAPI; um script determinístico gera TypeScript. Não manter tipos públicos manualmente em dois idiomas.

`ApiErrorResponse` publica o envelope de erro com código e request ID. O cliente
TypeScript o valida antes de expor `ApiRequestError`, preservando status, código
e request ID disponíveis. `contracts:check` gera saídas temporárias e compara
com os artefatos presentes, sem alterá-los ou exigir que estejam preparados no Git.

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
- Cancelar um job não permite que sua conclusão remova o registro ativo de uma nova tentativa da mesma seleção.
- Metadados do job ficam em memória durante a vida do processo; não há expiração automática implementada. O cache público tem ciclo separado.
- `useSessionLoad` controla cada tentativa e ignora respostas obsoletas. O polling começa em 650 ms e cresce até 2,5 s; cancelar ou sair invalida a tentativa e limpa seu timer. Transporte em tempo real fica adiado.

## Dependências futuras

Deploy exigirá armazenamento persistente para cache, limitação de uso, observabilidade e política de expiração distribuída. Esses itens não devem ser simulados no protótipo local.

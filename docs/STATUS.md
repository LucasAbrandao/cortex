# Status vigente — 2026-10-20

## Entrega funcional — revisão 1 de 3

- Branch `codex/functional-delivery`; trabalho anterior preservado no commit `0342e16`.
- Paleta: comandos explícitos PT/EN, rodapé traduzido, foco contido no diálogo e restaurado ao fechar. Idioma não altera a fixação da sidebar.
- Workspace compartilhado expõe disponibilidade e motivo das séries, inclusive na tabela; valores zero e ausências permanecem distintos.
- `npm run check` **passou**: lint, tipos, contratos, build, **85 testes web, 33 API e 20 E2E**. O CSS ausente detectado na primeira integração foi incluído e a cadeia completa repetida. Smoke real continua separado.
- Importação real em andamento. A seção abaixo preserva o estado da retomada anterior; os marcos atuais serão consolidados ao concluir a entrega.

## Retomada anterior — 2026-10-13

Este arquivo é o ponto de retomada. O [histórico completo até 2026-09-09](history/STATUS_2026-09-09.md) preserva entregas, comandos e limitações das rodadas anteriores; seus resultados não substituem a validação atual.

## Produto implementado

- **Fases 00–03:** monorepo Next.js/FastAPI, contratos gerados, API FastF1 e Race Explorer para Belgium/Spa 2025 Race. Demais sessões permanecem desabilitadas.
- **Race Explorer:** carga explícita, cache público, replay global ou comparação de voltas, gráficos/tabela canônicos, cena 3D com fallback 2D e classificação por registros. D-018/D-019 continuam vigentes; foco, carros visíveis e séries comparadas são independentes.
- **Telemetry Lab:** rotas existentes, seleção de arquivo desabilitada e sessão placeholder. Preview, mapeamento e workspace com fixture não foram entregues. **Fase 04 pendente.**
- **Qualidade:** CI e suítes determinísticas existem; **Fase 05 aberta**. Esta rodada validou o Race Explorer com dados reais e nas quatro larguras; importação, qualidade integrada da Fase 04 e medições de desempenho ainda precisam ser entregues.

O projeto permanece local, sem deploy ou autenticação. Upload backend, RCZ e outras corridas continuam fora do protótipo. O repositório tem histórico Git e remote; os relatos antigos de inicialização sem commit/remote estão preservados no histórico.

## Entrega desta retomada

- Documentação consolidada, com histórico integral preservado e status como ponto de retomada.
- `useSessionLoad`: polling de 650 ms até 2,5 s; tentativa vigente protegida contra respostas tardias, cancelamento e saída.
- Jobs: cancelamento/retry não permite que a tentativa antiga remova a nova seleção ativa.
- `useRaceLapCache`: mecanismo comum de cache para séries e pista, com dados separados por recurso e contexto, janela corrente e preparação das próximas voltas selecionadas; métricas extraídas para módulo próprio.
- Pista: índice preserva barreiras e ordem original dentro dos segmentos; continuidade visual permanece limitada à adjacência comprovada.
- Normalizador v6 e erros tipados no schema/cliente; chaves de cache anteriores preservadas.
- `check:core` e `check` disponíveis; `contracts:check` compara saídas temporárias sem modificar os artefatos ou depender do índice Git.
- CI com Python 3.13, npm 11.7.0 e uv congelado; ESLint passa a verificar TS/TSX. Atualizações aprovadas: typescript-eslint 8.71.2, Next.js 16.3.8 e Vitest 4.1.11, com lockfile atualizado.

Esta estabilização passou pelos gates locais e pela revisão independente. Fase 04 segue pendente e Fase 05 aberta; não há conclusão presumida de desempenho nem de execução da nova CI no GitHub. Alterações estão na branch `chore/cortex-structure-review`, sem commit ou publicação nesta rodada.

## Prioridades seguintes

1. **Fase 04, seleção e inspeção local:** CSV/JSON por seletor e arraste; limites explícitos de tamanho e amostra; preview seguro; estados de extensão inválida, excesso, vazio e JSON malformado; sem transmissão, persistência ou logs do conteúdo.
2. **Fase 04, mapeamento e demonstração:** tempo e canal numérico obrigatórios; sugestões confirmadas; fixture canônica identificada; banner persistente; gráficos/tabela compartilhados; descarte ao sair ou reiniciar. Aceite em `ACCEPTANCE_CRITERIA.md` e detalhes em `TELEMETRY_IMPORT_REQUIREMENTS.md`.
3. **Fase 05:** validar o produto após a importação, acompanhar a CI após integração autorizada e medir memória, bundle e atualização de gráficos antes de otimizar. Deploy depende de decisão futura.

## Evidências desta rodada

- Baseline relatada na retomada: **19 testes web e 6 testes API passaram**.
- Auditoria npm após as atualizações aprovadas: **0 vulnerabilidades reportadas**.
- `npm run check`: **passou** — ESLint TS/TSX e Ruff, TypeScript e Mypy, **81 testes web**, **33 testes API**, contratos sincronizados, build e **20 cenários Playwright**. O smoke real foi ignorado nessa suíte por ser opt-in.
- Smoke real separado: **passou** com sessão `2025-belgium-r-2-6`, normalizador v6, **20 pilotos e 879 voltas**. Verificou cache normalizado, avanço entre voltas e 1440/1200/1024/390 px, sem `pageerror` ou erros de console. Capturas foram inspecionadas.
- Preparação do cache v6: 158,65 s nesta execução, com `source: null`; a repetição no browser confirmou `normalized-cache`. Isso é um registro de execução, não um benchmark de carga fria ou FPS.
- Regressões controladas reproduziram falhas antes das correções; cancelamentos encadeados também foram exercitados na interface. O checker de contratos recusou cópias adulteradas e preservou os artefatos versionados.
- A alteração local preexistente em `apps/web/next-env.d.ts` foi preservada byte a byte. `git diff --check` passou; caches e capturas continuam fora do Git.

Limitações: CI remota não executada nesta rodada; sem medição de FPS ou hardware móvel físico. Persistem avisos transitivos de certificado do Conda, TestClient e `THREE.Clock`; não foram erros de execução nos cenários verificados. A correção do certificado foi limitada ao processo da API usado no smoke, sem alterar o ambiente global.

# Estratégia de testes

## Princípio

Cada risco recebe a menor evidência que prova o comportamento. CI obrigatório é determinístico e não depende da disponibilidade do FastF1.

## API — Pytest

- catálogo e allowlist Spa;
- cache hit/miss, chave versionada e artefato incompatível;
- coalescência de jobs, estados, cancelamento e falha;
- normalização, unidades, nulls e disponibilidade;
- redução sem interpolação e lacunas preservadas;
- aceleração derivada e limites de tempo;
- erros seguros e ausência de caminhos/payloads;
- manifesto, replay e pedido de séries.

Fixtures pequenas substituem FastF1 na suíte obrigatória. Teste real recebe marcador `live_fastf1`, é manual/agendado e registra duração e origem do cache.

## Web — Vitest e React Testing Library

- relógio, cache por volta e independência entre foco, monitoramento e comparação;
- leitura da última amostra anterior ao cursor e transição da classificação;
- sidebar, resize por teclado e mobile drawer;
- seleção com opções desabilitadas explicadas;
- polling, cancelamento, retry e estados do job;
- canal ausente, eixo distância bloqueado e série vazia;
- importação: arquivo vazio, inválido e mapeamento obrigatório;
- idioma, labels, foco e movimento reduzido.

## E2E — Playwright

1. Home → F1 → Spa → job controlado → replay → comparação.
2. Monitorar quatro pilotos, cruzar uma volta, alternar canais e validar cursor.
3. Cancelar e tentar novamente.
4. API offline e upstream limitado.
5. Home → Telemetry → fixture → preview → mapeamento → workspace demo.
6. Cena integrada/ampliada, exploração/fixação/restauração da câmera, suspensão fora da viewport; teclado e redução de movimento.
7. 1440×900, 1366×768, 1024×800 e 390×844, em português e inglês.

`apps/web/e2e/real-session.spec.ts` é um smoke opt-in e separado da CI. No
PowerShell, defina `$env:CORTEX_REAL_SMOKE = "1"` e então execute
`npm run e2e -- --grep "real cached Spa"`. Ele exige a API local e a sessão
real já carregada em cache.

## Contratos

Gerar OpenAPI, TypeScript e cliente; o check falha se houver diff. Validar fixtures contra schemas públicos.

## Gates existentes

Executar em sequência definida pelos scripts: lint, typecheck, testes web, build, Pytest, contratos e E2E. Os comandos estão em `package.json`. A lista de riscos acima é uma meta de cobertura; a jornada completa de importação depende da Fase 04.

## Verificação visual

Inspecionar rotas críticas em 1440 px, 1366 px, 1024 px e 390 px; conferir
overflow, contraste, foco, alvos, cena e coluna da classificação, erro, vazio, loading e redução
de movimento. Registrar resultados em `STATUS.md` sem inventar métricas.

# Estratégia de testes

## Princípio

Cada risco recebe a menor evidência que prova o comportamento. CI obrigatório é determinístico e não depende da disponibilidade do FastF1.

As listas abaixo definem riscos a cobrir, não uma declaração de cobertura concluída. `STATUS.md` registra resultados com data e distingue baseline, validação pendente e histórico.

## API — Pytest

- catálogo e allowlist Spa;
- cache hit/miss, chave versionada e artefato incompatível;
- coalescência de jobs, estados, cancelamento e falha;
- normalização, unidades, nulls e disponibilidade;
- preservação das amostras originais sem interpolação e com lacunas;
- aceleração derivada e limites de tempo;
- erros seguros e ausência de caminhos/payloads;
- manifesto, replay e pedido de séries.

Fixtures pequenas e adaptadores controlados substituem FastF1 na suíte obrigatória. Não há teste Pytest com marcador `live_fastf1` implementado. O smoke real existente é Playwright, opt-in e separado, descrito abaixo.

## Web — Vitest e React Testing Library

- relógio, cache por volta e independência entre foco, monitoramento e comparação;
- reprodução, pausa, seek, taxa, limites e cleanup do relógio;
- cache compartilhado, janela corrente e preparação das próximas voltas;
- indexação da pista preservando barreiras, voltas consecutivas e segmentos fora de ordem;
- métricas isoladas da apresentação, sem contar transições através de lacunas;
- leitura da última amostra anterior ao cursor e transição da classificação;
- sidebar, resize por teclado e mobile drawer;
- seleção com opções desabilitadas explicadas;
- polling progressivo, cancelamento, retry, respostas tardias e estados do job;
- canal ausente, eixo distância bloqueado e série vazia;
- importação: arquivo vazio, inválido e mapeamento obrigatório;
- idioma, labels, foco e movimento reduzido.

## E2E — Playwright

1. Home → F1 → Spa → job controlado → replay → comparação.
2. Monitorar quatro pilotos, cruzar uma volta, alternar canais e validar cursor.
3. Cancelar e tentar novamente.
4. API offline e upstream limitado.
5. Home → Telemetry → CSV/JSON controlado → preview → mapeamento confirmado → análise dos valores reais.
6. Cena integrada/ampliada, exploração/fixação/restauração da câmera, suspensão fora da viewport; teclado e redução de movimento.
7. 1440×900, 1200×900, 1024×800 e 390×844, em português e inglês; 1366×768 pode complementar a verificação do desktop.

`apps/web/e2e/real-session.spec.ts` é um smoke opt-in e separado da CI. No
PowerShell, defina `$env:CORTEX_REAL_SMOKE = "1"` e então execute
`npm run e2e -- --grep "real cached Spa"`. Ele exige a API local e a sessão
real já carregada em cache.

Esse cenário verifica a sessão real em cache; não prova uma carga fria nem identifica hit/miss do cache nativo. Uma validação fria separada deve registrar duração, tamanho e apenas a origem observável, preservando `source: null` quando rede e cache nativo não puderem ser distinguidos.

## Contratos

`npm run contracts:generate` atualiza OpenAPI e TypeScript dos modelos Pydantic.
O cliente fino consome os tipos gerados. `npm run contracts:check` gera novas
saídas em um subdiretório temporário de `.cache-uv-cortex` e compara o conteúdo
com os artefatos atuais, normalizando CRLF; não escreve neles nem consulta o
diff Git. Alterações intencionais ainda não preparadas no índice podem passar
quando correspondem ao schema. Validar também fixtures contra schemas públicos.

## Gates existentes

- `npm run check:core`: lint, typecheck, testes web, Pytest, contratos e build.
- `npm run check`: core seguido de Playwright com um worker.
- `npm run e2e -- --workers=1`: somente E2E determinístico; smoke real permanece opt-in.

ESLint verifica TypeScript/TSX; Ruff e Mypy verificam Python. A CI configura as
versões documentadas no README e usa lockfiles, incluindo `uv --frozen`.
Importação usa `telemetry-import.spec.ts`: arquivos reais controlados, valores,
PT/EN, quatro larguras, comparação por distância/tempo relativo, limites e
descarte. O provider é exercitado com workers controláveis para provar cancelamento,
retry, substituição e rejeição de respostas antigas. No modo dev, o banco interno
`__next_debug_channel` pertence ao inspetor Next, não à importação; a verificação
recusa outros bancos e exige localStorage/sessionStorage vazios e zero chamadas API.
Registrar resultados em
`STATUS.md`, sem transformar scripts existentes ou regressões focadas em prova
de aprovação de toda a rodada.

## Verificação visual

Inspecionar rotas críticas em 1440 px, 1200 px, 1024 px e 390 px; conferir
overflow, contraste, foco, alvos, cena e coluna da classificação, erro, vazio, loading e redução
de movimento. Registrar resultados em `STATUS.md` sem inventar métricas.

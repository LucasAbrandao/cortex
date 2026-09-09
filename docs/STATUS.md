# Status

## Estado vigente — consolidação de 2026-09-09

Fases 00–03 implementadas, incluindo cena 3D, apresentação ilustrativa rotulada,
câmera persistente, classificação com espaço reservado e ajuste do replay.
As seções anteriores de cada fase abaixo são histórico, não o estado vigente.
D-018/D-019 prevalecem sobre marcadores sem estimativa e mini-monitor flutuante.

Telemetry Lab ainda tem seleção desabilitada e workspace placeholder. A Fase 04
continua pendente, inclusive preview e mapeamento visual; upload backend e RCZ
continuam fora do escopo. A Fase 05 não foi encerrada.

`PROJECT_STANDARDS.md` consolida o que levar ao restante do projeto: componentes
canônicos, tokens, hierarquia, estados, acessibilidade, seleções independentes e
integridade dos dados. Não registra migração visual das outras telas como feita.
README, decisões, arquitetura frontend, sistema visual, roadmap, testes e guia
de prompts foram alinhados ao código. Nenhuma dependência ou API foi alterada
por esta consolidação.

O repositório foi encontrado sem commits e sem remote, com todos os arquivos
não rastreados na branch `codex/race-explorer-visual-audit`. O usuário autorizou
salvar as alterações na principal: esta entrega estabelece o primeiro snapshot
local em `main`, sem push ou publicação.

### Validação desta consolidação

- Lint, typecheck, 19 testes web, 6 testes API e build passaram.
- `npm run contracts:check` passou após preparar o índice Git: a regeneração
  não alterou OpenAPI nem TypeScript em relação ao snapshot preparado.
- `npm run e2e -- --workers=1`: 19 cenários passaram e o smoke real opt-in foi
  ignorado. A execução padrão com oito workers teve cinco falhas por timeout
  ou espera da cena; todas passaram na execução serial, sem alterar assertions.
  A estabilidade da execução concorrente neste hardware permanece uma limitação.
- Vitest, Pytest, build e browser precisaram executar fora do sandbox Windows
  por `spawn EPERM` e acesso negado a temporários. Lint/typecheck/contratos
  usaram `UV_CACHE_DIR` local ignorado. Permanece o aviso transitivo TestClient.
- Revisão do conteúdo preparado: caches, uploads e builds ignorados; nenhum
  arquivo acima de 2 MB nem padrão de credencial detectado na checagem básica.
- Removida somente uma linha vazia extra no EOF de `race-track-3d.tsx` para
  atender `git diff --cached --check`; nenhum comportamento foi modificado.
- Smoke real e nova inspeção visual manual não foram repetidos nesta revisão
  documental. As evidências reais anteriores permanecem identificadas no histórico.

## Ajuste da sincronização do replay — 2026-09-09

Após relato de `Maximum update depth exceeded` em um tick do relógio, a
publicação da cena em RaceStage passou de efeito passivo para efeito de layout.
Isso sincroniza a cena no mesmo commit visual e evita agendar uma atualização
passiva do contêiner a cada tick. Relógio, amostras e contratos não mudaram.

O cenário Chromium de reprodução agora observa console/pageerror e acompanha
mais de cinco segundos, pausa, seek e passagem de volta, sem erro. O aviso
original não foi reproduzido com a fixture pequena antes do ajuste; a condição
de carga real relatada permanece uma limitação da verificação determinística.
Lint, typecheck, build e 19 testes web passaram. O teste de seleção de todos
foi limitado ao grupo desktop porque JSDOM não oculta sua cópia mobile via CSS.


## Cena central do Race Explorer — 2026-09-08

Implementados fundo integrado da pista, câmera automática por scroll (8° de
azimute, 6° de inclinação e até 14% de recuo), exploração com grid durante o
gesto, fixação e restauração de vista. A câmera persiste fora do Canvas, que
continua suspenso fora da viewport. Carros genéricos ganharam asas e rodas.

A classificação agora ocupa coluna independente que atravessa cena e análise,
sem invadir gráficos. Durante o scroll resume top 3 mais foco; detalhes expandem
no próprio espaço. Abaixo de 1200 px, o resumo segue o fluxo acima da análise.
Transporte usa botões circulares, velocidades segmentadas, relógio global ou
de comparação e opções de volta recolhíveis no mobile. Cabeçalho e transporte
têm alturas medidas para posicionar elementos sticky.

Validação: lint, typecheck e build passaram; 19 testes web e 14 cenários
Playwright determinísticos passaram. O smoke real separado passou com os
20 pilotos e Spa em 1440/1200/1024/390 px. Capturas de cena e análise real
foram inspecionadas; PT/EN e movimento reduzido estão cobertos nos cenários
responsivos. O novo cenário cobre exploração/fixação/restauração, suspensão da
cena, espaço entre torre e gráfico e foco fora do top 3.

Sem dependências, contratos, API ou dados alterados. Limitações: perspectiva
plana não representa altitude; posição visual continua estimada entre amostras
válidas; classificação reflete registros de passagem. Não foi medido FPS em
hardware físico mobile. Capturas ficam em `test-results` (artefatos locais).

## Estado inicial — histórico anterior à Fase 00

- Kit documental criado.
- Produto, arquitetura, contratos, requisitos e prompts definidos.
- Nenhum projeto foi movido, apagado, criado ou versionado.
- Nenhuma dependência foi instalada.
- Implementação ainda não iniciada.

## Fase 00 — repositório, toolchains e contratos

**Concluída em 2026-08-14.** O projeto anterior foi preservado como
`cortex-legacy-2026-08-14`; o novo repositório local foi inicializado sem
remote, commit, push ou publicação. `telemetryCortex` permaneceu intocado.
Uma auditoria posterior removeu da nova raiz dois arquivos de instrução
residuais do legado, preservando-os no mesmo destino de legado sem os ler ou
usar.

### Entregas

- Kit documental canônico copiado para a nova raiz e estrutura de monorepo
  criada (`apps/web`, `services/api`, `packages/contracts`, `fixtures` e CI).
- npm workspaces, TypeScript estrito, Next.js, `uv` 0.12.4 e ambiente Python
  reproduzível configurados. Não há segredos, caches, uploads, dados locais ou
  builds versionados.
- API FastAPI mínima com `GET /api/health`, modelos Pydantic iniciais e
  respostas honestas: FastF1 e cache ainda aparecem como indisponíveis nesta
  fase, sem provocar download.
- OpenAPI é exportado deterministicamente em `services/api/openapi.json`; os
  tipos em `packages/contracts/src/generated/openapi.ts` são gerados com
  `openapi-typescript`. O cliente fino consome esses tipos sem duplicar
  contratos públicos.
- Fixtures públicas mínimas válida e inválida foram adicionadas e validadas
  pelo schema Pydantic.
- `.gitignore`, `.env.example` seguro, CI determinística e smoke web/API/E2E
  foram configurados.

### Contratos alterados

- Primeiro contrato público: `HealthResponse` de `GET /api/health`, com
  `requestId`, `status`, `version`, `fastf1Available` e `cacheConfigured`.
- Não houve mudança das decisões, do contrato canônico de dados ou da política
  de cache. FastF1, jobs e cache normalizado pertencem à Fase 02.

### Comandos e resultados

- `npm install` — concluído, sem vulnerabilidades reportadas.
- `uv sync --directory services/api --all-groups` — concluído.
- `npm run lint` — passou (ESLint + Ruff).
- `npm run typecheck` — passou (TypeScript + Mypy).
- `npm run test:web` — 1 teste passou.
- `npm run build` — passou; Next.js compilou a rota smoke `/`.
- `npm run test:api` — 3 testes passaram.
- `npm run contracts:check` — passou; OpenAPI e TypeScript gerado estão
  sincronizados.
- `npm run e2e` — 1 cenário Chromium passou.
- Smoke local `GET /api/health` — respondeu `200` com capacidades FastF1/cache
  explicitamente `false`; o processo foi encerrado sem listener residual.

### Browser verificado

- Chromium via Playwright: a rota smoke `/` renderiza o heading `Cortex`.
- A verificação responsiva e de acessibilidade das larguras 1440/1024/390 px
  começa na Fase 01, quando as rotas e controles existirem.

### Riscos e pendências reais

- A incompatibilidade de `jsdom` 30.0.1 com Node 22.19.0 foi resolvida na
  Fase 01 com o downgrade aprovado para `jsdom` 29.0.1.
- O ambiente Conda expõe um `SSL_CERT_DIR` sem certificados válidos, gerando
  aviso do `uv`; a sincronização e todos os gates locais passaram. O problema
  deve ser resolvido antes de qualquer fluxo que dependa de download externo.
- O `TestClient` do FastAPI emite aviso de depreciação transitivo; não afeta os
  três testes atuais, mas deve ser removido quando a suíte de API crescer.

### Próxima fase

Fase 01 — fundação do frontend, concluída abaixo.

## Fase 01 — fundação do frontend

**Concluída em 2026-08-14.** A interface agora tem shell navegável e visual
completo para a primeira jornada, ainda sem integração FastF1 ou processamento
de upload.

### Entregas

- Tokens do sistema visual, reset, foco visível e regra global de
  `prefers-reduced-motion` implementados em CSS nativo.
- Shell com sidebar compacta, expansão por hover/foco, fixação, divisor
  redimensionável por ponteiro/teclado e drawer mobile com Escape, foco inicial
  e retorno ao gatilho.
- Textos PT-BR/EN centralizados em `apps/web/src/i18n.ts`; os componentes não
  duplicam conteúdo por idioma.
- Rotas entregues: `/`, `/f1`, `/f1/2025/belgium/race`, `/telemetry`,
  `/telemetry/import` e `/telemetry/session`.
- Calendário 2025 exibe 24 eventos: apenas Belgium/Spa Race é link habilitado;
  os demais controles ficam desabilitados com explicação acessível.
- A página Spa expõe estados visuais inicial, loading, cancelado, erro, vazio e
  indisponível sem alegar integração com FastF1 antes da Fase 02.
- Telemetry Lab deixa explícito que a importação é local/demonstrativa e que
  nenhum arquivo é enviado, persistido ou processado pelo backend.
- Componentes compartilhados para loading, erro, vazio, aviso e
  indisponibilidade foram adicionados.

### Contratos alterados

- Nenhum contrato público, schema Pydantic, OpenAPI ou decisão arquitetural foi
  alterado. A fase consome somente conteúdo local de apresentação.

### Comandos e resultados

- `npm run lint` — passou.
- `npm run typecheck` — passou.
- `npm run test:web` — 5 testes passaram.
- `npm run build` — passou; as seis rotas previstas foram geradas.
- `npm run test:api` — 3 testes passaram.
- `npm run contracts:check` — passou.
- `npm run e2e` — 4 cenários Chromium passaram.

### Browser verificado

- 1440 px: Home, hierarquia e módulos Race Explorer/Telemetry Lab.
- 1024 px: calendário com 24 eventos e apenas link Spa habilitado.
- 390 px: drawer mobile, idioma, navegação e ausência de overflow horizontal.
- E2E cobriu rotas, evento habilitado/desabilitado, cancelamento/retry visual,
  hover, resize por seta, idioma e redução de movimento.

### Riscos e pendências reais

- A integração FastF1, o cache, jobs e replay continuam fora desta fase; a
  tela Spa declara essa limitação em vez de usar fixture como fallback.
- O ambiente Conda ainda expõe `SSL_CERT_DIR` sem certificados válidos. Isso
  não bloqueou os gates locais, mas precisa ser resolvido antes da carga FastF1
  real na Fase 02.
- O aviso transitivo de depreciação do `TestClient` FastAPI permanece na suíte
  Python existente e deve ser tratado ao expandi-la.

### Próxima fase

Fase 02 — API FastF1, cache e Spa real. Aguarda revisão e autorização
explícita.

## Ajuste pós-Fase 01 — seleção da sidebar

**Concluído em 2026-08-14.** Correção visual solicitada antes da Fase 02;
não altera escopo, contratos públicos, dependências ou a arquitetura.

### Entregas

- `AnimatedNavigationList` é um componente genérico reutilizável para listas
  de navegação: um único indicador persistente mede o item ativo e se move com
  `transform`, em vez de a seleção desaparecer e reaparecer.
- A correspondência de rota agora usa o caminho mais específico. Em
  `/telemetry/import`, somente **Importar telemetria** recebe `aria-current`
  e a aparência ativa; **Telemetria** permanece inativa.
- A animação é CSS, sem dependência adicional, e a regra global de
  `prefers-reduced-motion` continua reduzindo a transição.

### Verificação

- Teste de componente cobre a seleção exclusiva da rota específica.
- Playwright cobre a troca Telemetria → Importar telemetria e a presença do
  indicador único pronto para animação.
- `npm run test:web` passou: 2 arquivos e 6 testes.
- `npm run typecheck` passou (TypeScript, Mypy); o aviso externo de
  `SSL_CERT_DIR` permanece conhecido.
- `npm run lint` passou (ESLint e Ruff); `npm run build` passou e gerou as
  oito rotas estáticas.
- `npm run test:api` passou: 3 testes; permanece somente o aviso transitivo
  conhecido do `TestClient`. `npm run contracts:check` passou sem gerar diff.
- `npm run e2e` passou em 2026-08-14: 5 cenários Chromium, incluindo a troca
  Telemetria → Importar telemetria, redução de movimento e responsividade.
  Nenhuma alteração de produto ou contrato ficou pendente.

## Fase 02 — API FastF1, cache e Spa real

**Concluída em 2026-08-14.** Belgium 2025 Race é carregada pelo FastF1 3.8.3
somente no backend, por ação explícita e com os dois caches públicos
configurados. Não houve fallback para fixture ou dados sintéticos.

### Entregas

- `fastf1==3.8.3` (MIT) foi instalado pelo `uv` e fixado em `pyproject.toml` e
  `uv.lock`; o adaptador é a única área que importa FastF1.
- Health, capabilities, catálogo 2025, allowlist Belgium/R, jobs, manifesto,
  replay e séries foram modelados em Pydantic e exportados para OpenAPI. Os
  tipos e cliente TypeScript foram regenerados, sem contrato público manual.
- Cache FastF1 é habilitado uma vez em `FASTF1_CACHE_DIR`; cache normalizado
  usa chave com schema, FastF1, ano, evento, sessão e normalizador. O artefato
  JSON tem checksum SHA-256 e escrita atômica; arquivo inválido é miss.
- Jobs são coalescidos por seleção, canceláveis cooperativamente e retornam
  estados/erros seguros. A origem só declara `normalized-cache` quando o
  artefato validado foi usado; a primeira carga permanece `null` em vez de
  inferir rede versus cache nativo.
- A tela Spa inicia, acompanha, cancela e repete o job real; mostra etapa,
  tempo e origem. CORS aceita somente as origens locais configuradas.

### Contratos e decisões alterados

- `docs/API_CONTRACT.md`: capacidades de cache, allowlist antes do job,
  semântica de `source` e séries reduzidas sem interpolação.
- `docs/DECISIONS.md`: D-011 (artefato verificável) e D-012 (origem sem
  inferência).
- `docs/SECURITY_AND_PRIVACY.md` e `.env.example`: CORS local explícito,
  sem curingas, credenciais ou caminhos expostos.

### Comandos e resultados

- `uv add --directory services/api fastf1==3.8.3` — concluído; importação
  confirmou versão 3.8.3.
- `npm run lint` — passou.
- `npm run typecheck` — passou (TypeScript e Mypy).
- `npm run test:web` — passou: 6 testes.
- `npm run build` — passou: oito rotas estáticas.
- `npm run test:api` — passou: 6 testes determinísticos, cobrindo allowlist,
  CORS local, cache validado/corrompido, coalescência, cancelamento, replay e
  séries; permanece o aviso transitivo conhecido do `TestClient`.
- `npm run contracts:check` — passou sem diff.
- `npm run e2e` — passou: 5 cenários Chromium.

### Smoke FastF1 real e browser

- API local: `health` e `capabilities` responderam sem download implícito.
- Primeira carga real de Belgium 2025 Race: sucesso; 20 pilotos, 879 voltas,
  879 frames de classificação, 7 canais e série PIA/volta 1 com 234 amostras.
- Repetição do job: sucesso com `source: normalized-cache`; o artefato local
  normalizado foi validado antes da leitura.
- Browser em `/f1/2025/belgium/race`: a API local foi chamada por CORS
  permitido e a tela chegou ao estado pronto após o job cacheado.

### Riscos e pendências reais

- Coordenadas de pista continuam ausentes (`trackAvailable: false`); a Fase 03
  não deve inventar traçado e precisa renderizar apenas segmentos reais válidos.
- O primeiro cache normalizado real ocupa cerca de 45 MB; retenção por idade ou
  tamanho permanece decisão futura conforme `CACHE_POLICY.md`.
- O ambiente Conda ainda injeta `SSL_CERT_DIR` inválido nos comandos comuns do
  `uv`; para o download real ele foi removido somente do processo do servidor,
  usando certificados padrão do sistema. A configuração permanente do terminal
  continua pendente.

### Próxima fase

Fase 03 — Race Explorer sincronizado. Aguarda revisão e autorização explícita.

## Fase 03 — Race Explorer sincronizado

**Concluída em 2026-08-14.** A sessão real Belgium 2025 Race agora abre um
workspace sincronizado: replay, pista, classificação, comparações e gráficos
derivam do mesmo contrato normalizado, sem criar posições ou curvas ausentes.

### Entregas

- `POST /api/f1/sessions/{sessionId}/track` expõe segmentos de posição FastF1
  por piloto+volta. O contrato inclui `time`, `lapTime`, `x`, `y` e `onTrack`;
  coordenadas inválidas permanecem `null` e quebram o desenho da pista.
- O normalizador v4 mantém tempos de carro e posição relativos em `lapTime` e
  calcula `time` global apenas pela soma com o início oficial disponível da
  volta. Caches anteriores ficam incompatíveis de propósito.
- Race Explorer tem play/pause, seek, velocidades, navegação de volta,
  classificação sincronizada, foco independente e comparação piloto+volta.
  O cenário inicial real seleciona PIA volta 7 e NOR volta 9.
- Gráfico SVG nativo tem cursor compartilhado, zoom local, lacunas não
  conectadas e tabela acessível. A distância é bloqueada quando qualquer série
  não a suporta.
- Painéis de pista/classificação e gráficos usam resize por ponteiro/teclado,
  maximização/restauração e layout responsivo. Nenhuma dependência foi
  instalada: SVG, CSS e APIs nativas substituem as bibliotecas avaliadas.

### Contratos e decisões alterados

- `docs/DATA_CONTRACT.md`, `docs/API_CONTRACT.md` e OpenAPI registram o
  endpoint e as semânticas das amostras de pista.
- `docs/DECISIONS.md`: D-013 (posição bruta e marcador temporal limitado) e
  D-014 (gráficos e painéis nativos sem dependência aprovada).
- Tipos TypeScript e cliente foram regenerados exclusivamente a partir de
  Pydantic/OpenAPI.

### Comandos e resultados

- `npm run typecheck` — passou (TypeScript e Mypy).
- `npm run lint` — passou (ESLint e Ruff).
- `npm run test:web` — passou: 7 testes, incluindo foco independente,
  comparação volta 7/9, séries adicionais e play/pause.
- `npm run test:api` — passou: 6 testes, incluindo posições brutas e cache.
- `npm run contracts:check` — passou sem diff.
- `npm run build` — passou; oito rotas estáticas.
- `npm run e2e` — passou: 6 cenários Chromium, incluindo a jornada Race
  Explorer controlada por contrato.

### Smoke FastF1 real e browser

- A carga real v4 terminou com `trackAvailable: true`, 20 pilotos, 88
  segmentos PIA/NOR e 18.692 posições válidas retornadas para a seleção.
- PIA volta 7 e NOR volta 9 retornaram `lapTime` inicial de 0,02 s e 0,04 s,
  respectivamente, sem valores negativos; o segundo job lê o cache normalizado.
- Browser: desktop 1440 px, tablet 1024 px e mobile 390 px sem overflow. Play,
  pausa, foco independente, terceira comparação, resize por seta, maximização,
  tabela e mapa real foram verificados. A regra global de movimento reduzido
  continua coberta no E2E.

### Riscos e pendências reais

- A primeira criação de artefato com posições é mais lenta que a Fase 02 e o
  cache agregado cresceu. Não há limpeza pelo navegador, conforme a política.
- Um piloto sem posição comprovável dentro de 2 s do relógio não recebe
  marcador; isso é ausência honesta, não um fallback visual.
- O aviso transitivo de depreciação do `TestClient` e o `SSL_CERT_DIR` Conda
  inválido permanecem riscos conhecidos do ambiente, sem falha nos gates.

### Próxima fase

Fase 04 — Telemetry Lab visual/local. Aguarda revisão e autorização explícita.

## Ajuste pós-Fase 03 — leitura comparativa do Race Explorer

**Concluído em 2026-08-15.** Correção de leitura e interação aprovada antes da
Fase 04. Nenhuma dependência, rota, contrato público, cache ou dado FastF1 foi
alterado.

### Entregas

- Comparações são limitadas a quatro combinações piloto+volta. Cartões e uma
  legenda reutilizável tornam a seleção legível; o botão de adicionar fica
  desabilitado no limite.
- A mesma cor determinística de cada piloto é usada na legenda, cartões,
  gráficos e pista. A atribuição distingue PIA e NOR na seleção inicial.
- O pedido de séries usa somente os canais já publicados e exibe gráficos SVG
  sincronizados para os canais marcados. Canais sem amostras mostram o estado
  vazio, sem curva inventada.
- Cartões apresentam métricas agregadas de amostras e dados oficiais já
  existentes (tempo de volta, velocidades, contagens de amostras ativas e
  mudanças de marcha). Toda ausência continua visível como “Indisponível”.
- A tabela acessível é recolhível. Espaço reproduz/pausa e as setas avançam ou
  recuam cinco segundos fora de campos editáveis; a dica permanece visível.
- O cursor só substitui o tempo do marcador da pista no eixo de tempo global;
  a posição continua limitada a uma amostra bruta válida de até dois segundos,
  sem interpolação.

### Contratos e decisões

- OpenAPI, Pydantic, cliente gerado e contrato de dados não mudaram.
- `docs/DECISIONS.md`: D-015 registra o limite de comparação, cores estáveis,
  métricas sem fabricação de dados, marcador temporal e atalhos locais.

### Comandos e resultados

- `npm run lint` — passou (ESLint e Ruff).
- `npm run typecheck` — passou (TypeScript e Mypy).
- `npm run test:web` — passou: 3 arquivos, 7 testes; acrescenta cobertura do
  limite, dos canais, das métricas e do atalho de teclado.
- `npm run test:api` — passou: 6 testes; permanece somente o aviso transitivo
  conhecido do `TestClient`.
- `npm run contracts:check` — passou sem diff gerado.
- `npm run build` — passou; sete rotas estáticas além de `_not-found`.
- `npm run e2e` — passou: 6 cenários Chromium; cobre as quatro comparações, a
  tabela recolhível e o workspace controlado por contrato.

### Browser e smoke real

- Belgium 2025 Race foi aberta pelo cache normalizado local. A API retornou
  44 segmentos por piloto e 9.341 posições válidas de PIA, incluindo 226 na
  volta 7; o mapa real foi confirmado depois do carregamento assíncrono.
- Desktop 1440 px, tablet 1024 px e mobile 390 px não tiveram overflow
  horizontal. Gráficos, legenda com PIA/NOR em cores distintas, controles,
  estado de ausência de Brake e cartões de métricas foram inspecionados.
- Os processos locais temporários da API e do Next.js foram encerrados após a
  validação.

### Riscos e pendências reais

- Brake não possui amostras válidas nesta seleção real e aparece explicitamente
  como ausente. Não foi convertida em zero nem conectada por interpolação.
- O aviso transitivo do `TestClient` e o `SSL_CERT_DIR` inválido injetado pelo
  Conda seguem como riscos de ambiente; não falharam os gates.

### Próxima fase

Fase 04 — Telemetry Lab visual/local. **Não iniciada; aguarda autorização
explícita do usuário.**

## Atualização obrigatória por fase

Registre:

1. objetivo e resultado entregue;
2. arquivos/contratos relevantes alterados;
3. comandos executados e resultados;
4. telas e estados verificados no navegador;
5. riscos, limitações e pendências reais;
6. próxima fase autorizada.

Não declare funcionalidade baseada apenas em fixture como integração real. Não declare fase concluída com gate obrigatório falhando.

## Auditoria e evolução estrutural do frontend — 2026-09-04

**Implementada; validação de browser e alguns runners aguardam ambiente com
permissão de spawn.** Esta mudança atende à evolução visual e estrutural do
frontend sem alterar contratos, API, dados, cache ou regras de negócio.

### Entregas

- Auditoria documentada em `docs/FRONTEND_AUDIT.md`, com inventário de rotas,
  componentes, decisões de reutilização e riscos reais.
- Tokens semânticos complementares (superfície, texto, estados, ritmo, raios e
  elevação) centralizados no CSS; o esquema existente continuou compatível com
  o Race Explorer.
- `AppShell` evoluído com top bar contextual, project switcher preparado para
  múltiplos módulos, sidebar compacta preservada e command palette global.
- Command palette suporta `Ctrl+K`, `/` fora de campos, busca por categoria,
  setas, Enter e Escape. Ela abre apenas rotas e ações reais já existentes.
- Primitivos reutilizáveis `Icon`, `StatusBadge` e `PageHeader` passaram a
  padronizar ícones, status e headers. Home virou Mission Control baseada em
  capacidades reais, sem atividade ou métricas inventadas.
- Estados preservam semântica honesta; `StatePanel` anuncia erros como alert.
  O drawer e o separador de sidebar mantêm foco, teclado e comportamento mobile.

### Verificações executadas

- `npm run lint` — passou (ESLint + Ruff), com cache UV temporário isolado.
- `npm run typecheck` — passou (contratos, web e Mypy), com o mesmo cache.
- `git diff --check` — passou.
- `npm run build` — passou no terminal local do usuário: oito rotas estáticas
  foram geradas após typecheck e coleta de dados.
- `npm run e2e` — passou no terminal local do usuário: 7 cenários Chromium,
  incluindo palette, sidebar e Race Explorer.
- `npm run test:web` — o usuário identificou duas falhas de regressão: evento
  global em `document` e mock sem `useRouter`. Ambas foram corrigidas. Neste
  ambiente Windows gerenciado, o Vitest ainda não inicia por `spawn EPERM`,
  antes de executar os testes; a nova execução deve ocorrer no terminal local.

### Pendências reais

- Reexecutar `npm run test:web` no terminal local para confirmar os dois
  reparos. Build e E2E já foram confirmados nesse terminal; a revisão manual
  em Home, catálogo, Telemetry Lab e Race Explorer nas larguras 1440, 1024 e
  390 px permanece recomendada.
- A Fase 04 de importação/normalização real continua separada e não foi
  iniciada por esta refatoração de interface.

## Auditoria visual — Race Explorer Belgium Race — 2026-09-04

**Implementada e validada; candidata a padrão visual, ainda não aprovada para
replicação nas demais telas.** A entrega transforma a sessão em uma bancada de
análise sem alterar API, OpenAPI, contratos públicos, cache FastF1 ou dados.

### Entregas

- O Race Explorer agora separa explicitamente `Corrida real` (relógio global)
  de `Comparação de voltas` (relógios relativos individuais). Trocar modo,
  piloto em foco ou volta pausa a reprodução; as quatro velocidades e a regra
  de fim da volta ficam visíveis no controle compacto.
- Voltas são classificadas exclusivamente por início, fim e duração
  comprováveis. Séries sem estes termos, marcadores sem posição bruta recente
  e comparações sem duração válida aparecem como indisponíveis, sem repetição,
  interpolação ou trajetória inventada.
- Pista, classificação temporal e análise estão organizadas em zonas. A
  classificação mantém todos os pilotos do manifesto e oferece leitura `No
  instante` e `Na volta escolhida`, sem derivar posição ou estado temporal de
  `Finished`.
- O mapa usa eixos iguais, segmentos quebrados em lacunas e marcadores de até
  dois segundos; gráficos preservam os tipos contínuo, degrau e evento,
  inclusive valores booleanos falsos, com origem original/derivada explícita.
- O padrão visual técnico foi documentado com a nova paleta, hierarquia e
  pontos de quebra. Foram incluídos testes puros de tempo, teste de interface
  e cobertura Playwright dos três viewports; o cenário offline passou a
  simular falha de rede no navegador, sem depender da API local.

### Arquivos e decisões relevantes

- `apps/web/src/features/race-explorer/race-explorer-screen.tsx` e
  `race-explorer-model.ts`: estado de workspace, relógios e renderização
  honesta de pista/séries/classificação.
- `apps/web/app/styles.css`, `apps/web/src/i18n.ts` e
  `apps/web/e2e/navigation.spec.ts`: composição responsiva, textos bilíngues
  e verificações de viewport/falha de rede.
- `docs/RACE_EXPLORER_REQUIREMENTS.md`, `docs/FRONTEND_ARCHITECTURE.md`,
  `docs/DESIGN_SYSTEM.md` e `docs/DECISIONS.md` registram o contrato de
  interação; D-016 formaliza os dois relógios e a classificação temporal.

### Verificações executadas

- `npm run lint` — passou (ESLint e Ruff).
- `npm run typecheck` — passou (contratos, web e Mypy).
- `npm run test:web` — passou: 4 arquivos, 11 testes.
- `npm run test:api` — passou: 6 testes; permanece apenas o aviso transitivo
  do `TestClient`.
- `npm run contracts:check` — passou sem alteração gerada.
- `npm run build` — passou; oito rotas estáticas.
- `npm run e2e` — passou: 8 cenários Chromium, incluindo falha de API,
  workspace controlado e 1440/1024/390 px exatos.
- Browser com sessão Belgium 2025 real já em cache: desktop 1440 px, tablet
  1024 px e mobile 390 px foram inspecionados sem overflow horizontal.

### Limitações e próxima decisão

- A pista só mostra um marcador quando a posição original é suficientemente
  próxima do relógio; esta ausência é esperada nas lacunas de telemetria.
- A Fase 04 permanece não iniciada. Antes de levar este padrão às outras telas,
  falta apenas a aprovação visual explícita do usuário.

## Evolução — painel companheiro de corrida — 2026-09-04

**Implementação e validação concluídas.**
Esta seção substitui a composição visual anterior do Race Explorer.

### Entregas

- Corrida real usa até quatro pilotos monitorados, independentes do foco. A
  volta ativa de cada piloto deriva do relógio global; busca e torre permitem
  adicionar, remover e focar sem perder o instante.
- Relógio começa no primeiro limite comprovável, continua entre voltas por
  padrão, oferece ±1 s, velocidades existentes e pausa opcional no fim da
  volta. A inspeção do gráfico pausa e permite retornar ao acompanhamento.
- Séries e pista têm caches incrementais por piloto/volta. A janela de 30, 60
  ou 120 s sobrepõe pilotos por canal, prepara a próxima volta e nunca mostra
  amostra futura nem solicita dados por frame.
- A classificação virou uma torre ordenada pelos registros disponíveis.
  Mudanças comprovadas usam transição FLIP durante play contínuo; seek e
  redução de movimento atualizam diretamente.
- Pista integrada, ampliada ou flutuante compartilha o mesmo replay. O
  mini-monitor pode ser movido, redimensionado, encaixado, fixado e restaurado
  dentro da viewport. No mobile, o transporte não encobre a pista ao rolar e
  a troca de breakpoint não desloca nem corta o conteúdo durante o fechamento
  do drawer.
- Gráfico e tabela canônicos foram extraídos para `shared`; o Telemetry Lab
  poderá reutilizá-los quando sua importação real for implementada. O atalho
  Mac e seus rótulos foram removidos; permanecem `Ctrl+K`, `/` e botões.
- Não houve mudança de API, Pydantic ou OpenAPI. D-017 registra o modelo de
  caches e a separação entre movimento de layout e integridade dos dados.

### Verificações executadas

- `npm run lint` — passou (ESLint e Ruff).
- `npm run typecheck` — passou (contratos, web e Mypy).
- `npm run test:web` — passou: 5 arquivos, 17 testes.
- `npm run test:api` — passou: 6 testes; permanece apenas o aviso transitivo
  de depreciação do `TestClient`/`httpx`.
- `npm run contracts:check` — passou sem diferença gerada.
- `npm run build` — passou; oito rotas estáticas foram geradas.
- `npm run e2e` — passou: 12 cenários Chromium e 1 smoke real corretamente
  ignorado na suíte determinística.
- Smoke opt-in com Spa real em cache — passou. A reprodução atravessou PIA
  volta 7 → 8, exercitou pista flutuante e gráficos e gerou capturas em
  1440×900, 1366×768, 1024×800 e 390×844.
- As 12 capturas do smoke foram inspecionadas. Além de ausência de overflow,
  o teste mede a contenção do cabeçalho, transporte e seleção na viewport;
  controles, classificação, mini-monitor e informação principal ficaram
  acessíveis nas quatro larguras.

### Limitações preservadas

- A torre só muda quando um registro temporal comprova a nova ordem. Entre
  passagens pode haver defasagem; nenhuma ultrapassagem é inferida pelo GPS.
- O replay é sincronizado manualmente com a televisão e usa dados históricos;
  não existe integração automática com vídeo ou corrida ao vivo.
- O Telemetry Lab ainda mantém as limitações de importação já documentadas. O
  workspace compartilhado está pronto para reutilização, mas esta entrega não
  introduz um importador novo.

## Evolução — replay 3D de Spa — 2026-09-08

**Implementação e validação concluídas.** O Race Explorer ganhou cena Three.js em
perspectiva com grid, pista de referência fixa, carros selecionáveis e câmera
explorável. Todos os pilotos podem aparecer na simulação; até quatro pilotos
alimentam os gráficos de forma independente. A cena sai da viewport durante o
scroll, suspende o WebGL e retorna no mesmo relógio compartilhado.

O normalizador v5 preserva todas as amostras originais, e `track` aceita filtro
piloto+volta. A suavização existe somente nos carros e rejeita ausência,
off-track, tempo inválido, lacunas e saltos implausíveis; gráficos continuam com
amostras originais e linhas interrompidas. Three.js, React Three Fiber e tipos
foram adicionados com aprovação explícita.

### Verificação

- `npm run lint`, `npm run typecheck`, `npm run build` e
  `npm run contracts:check` passaram.
- `npm run test:web` passou: 5 arquivos e 19 testes; `npm run test:api`
  passou: 6 testes, mantendo apenas o aviso transitivo conhecido do TestClient.
- Playwright determinístico passou: 13 cenários e 1 smoke real ignorado por
  padrão. O cenário cobre grid de 20 carros, scroll com relógio contínuo,
  comparação e 1440/1366/1024/390 px.
- Smoke opt-in com Spa real e cache v5 passou nos quatro viewports, inclusive
  com os 20 pilotos selecionados. As capturas foram inspecionadas e o overflow
  mobile encontrado na primeira execução foi corrigido e retestado.
- O cache normalizado v5 real ocupa aproximadamente 132 MB, contra cerca de
  64 MB no artefato reduzido anterior. O aumento preserva todas as amostras e
  deve orientar uma futura política de retenção, sem degradar sua fidelidade.

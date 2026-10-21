# Arquitetura do frontend

## Stack implementada

Next.js App Router, React, TypeScript estrito e CSS com tokens do produto. Dependências de gráficos, chamadas, estado, tabelas e painéis só são instaladas após aprovação na Fase correspondente.

## Rotas

- `/`: Home.
- `/f1`: ano, evento e sessão.
- `/f1/2025/belgium/race`: carregamento e Race Explorer.
- `/telemetry`: entrada do laboratório.
- `/telemetry/import`: rota reservada para seleção, preview e mapeamento da Fase 04.
- `/telemetry/session`: rota reservada para workspace demonstrativo com fixture.

Layout raiz fornece idioma e shell. Áreas que dependem de browser, Three.js, upload, replay ou ResizeObserver são Client Components isolados. Conteúdo estático e catálogos iniciais podem ser Server Components; não transformar toda a árvore em cliente.

## Shell e navegação

`features/navigation/AppShell` é o ambiente comum: sidebar redimensionável,
top bar contextual, project switcher, drawer mobile e command palette. A
palette é uma navegação extensível por categorias, e não uma busca falsa: cada
resultado leva a uma rota ou ação real.

`shared/ui.tsx` hospeda apenas primitivas sem dependência de domínio
(`Icon`, `StatusBadge`, `PageHeader`). Estados e padrões de domínio permanecem
nas suas features para não transformar o design system em uma camada de regras
de negócio.

## Camadas

- `features/navigation`: shell, sidebar e idioma.
- `features/f1-catalog`: seletores e disponibilidade.
- `features/session-load`: `useSessionLoad` controla job, polling progressivo, cancelamento e retry com proteção contra respostas tardias.
- `features/race-explorer`: relógio, caches por volta, cena 3D, classificação e análise.
- `features/telemetry`: rotas de laboratório e placeholders; importação ainda desabilitada.
- `shared/telemetry-workspace.tsx`: gráficos e tabela canônicos reutilizáveis.
- `shared`: controles, estados, formatação e cliente gerado.

## Estado

Dados remotos pertencem à camada de consultas. Estado efêmero do workspace fica nos hooks e componentes; suas ações representam:

```text
focusDriver, monitorDriver, addComparison, selectChannels,
setMode, setCursor, setActiveLap, setWindow,
play, pause, seek, setPlaybackRate, setTrackPresentation, resizePanel
```

Não duplicar payload remoto inteiro na store. URL guarda somente seleção navegável; não expõe job ou caminho local. Recarregar perde sessão efêmera e informa o usuário.

## Sincronização

Um relógio de replay é fonte do `cursorTime`. Hover de gráfico pode pausar/atualizar cursor conforme modo explícito. Atualização visual usa `requestAnimationFrame`; não dispara requisição por frame. Mudança de volta restaura enquadramento padrão, salvo quando o usuário fixa zoom.

No Race Explorer, hooks especializados separam relógio, cache incremental de
pista e estado de apresentação. `useRaceLapCache` centraliza o mecanismo usado
por séries e pista; cada recurso e contexto mantém seus dados próprios, retendo
a janela solicitada e as próximas voltas selecionadas pelo consumidor.
Manifesto e frames permanecem imutáveis.
Corrida real deriva as voltas ativas do tempo global e prepara a volta seguinte
sem requisitar por frame; comparação usa tempo relativo e nunca aparenta que os
carros dividiram o mesmo instante. Gráfico e tabela reutilizáveis vivem em
`shared` e recebem o modelo canônico, permitindo uso posterior pelo Telemetry Lab.

`race-metrics.ts` concentra métricas de amostras, separadas da apresentação.
`indexTrackSamples` ordena blocos sem reorganizar as amostras internas: ausência
ou timestamp inválido continua uma barreira. Fronteiras de voltas consecutivas
com adjacência comprovada podem conservar a estimativa visual, sujeita aos
limites de tempo e salto de `visualTrackPosition`; lacunas, sobreposição ou
voltas desconhecidas/não consecutivas não autorizam conexão entre blocos.

## Erros e estados

Painéis reutilizáveis e mensagens localizadas tratam os estados conhecidos. Não há boundary de erro dedicado por rota implementado. Erro de um canal não deve derrubar replay; controles indisponíveis preservam explicação acessível. Cobertura e validação atuais ficam em `STATUS.md`.

## Performance

A cena Three.js/React Three Fiber é carregada dinamicamente sem SSR. Suspender WebGL fora da viewport e manter estado de câmera fora do Canvas. Atualizar séries incrementalmente, evitar requisições por frame e medir antes de virtualizar. Gráficos usam SVG nativo; ECharts não está instalado.

A publicação da cena no contêiner usa efeito de layout para sincronizar o commit visual com o relógio; não alterar amostras ou contratos para corrigir renderização. Para reutilização no restante do produto, seguir `PROJECT_STANDARDS.md`.

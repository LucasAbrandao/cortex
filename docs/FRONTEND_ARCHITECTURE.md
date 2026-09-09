# Arquitetura do frontend

## Stack implementada

Next.js App Router, React, TypeScript estrito e CSS com tokens do produto. Dependências de gráficos, chamadas, estado, tabelas e painéis só são instaladas após aprovação na Fase correspondente.

## Rotas

- `/`: Home.
- `/f1`: ano, evento e sessão.
- `/f1/2025/belgium/race`: carregamento e Race Explorer.
- `/telemetry`: entrada do laboratório.
- `/telemetry/import`: fluxo visual de importação.
- `/telemetry/session`: workspace com fixture.

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
- `features/session-load`: job, polling, cancelamento e retry.
- `features/race-explorer`: relógio, caches por volta, cena 3D, classificação e análise.
- `features/telemetry`: rotas de laboratório e placeholders; importação ainda desabilitada.
- `shared/telemetry-workspace.tsx`: gráficos e tabela canônicos reutilizáveis.
- `shared`: controles, estados, formatação e cliente gerado.

## Estado

Dados remotos pertencem à camada de consultas. Estado efêmero complexo do workspace usa reducer/store com ações explícitas:

```text
focusDriver, monitorDriver, addComparison, selectChannels,
setMode, setCursor, setActiveLap, setWindow,
play, pause, seek, setPlaybackRate, setTrackPresentation, resizePanel
```

Não duplicar payload remoto inteiro na store. URL guarda somente seleção navegável; não expõe job ou caminho local. Recarregar perde sessão efêmera e informa o usuário.

## Sincronização

Um relógio de replay é fonte do `cursorTime`. Hover de gráfico pode pausar/atualizar cursor conforme modo explícito. Atualização visual usa `requestAnimationFrame`; não dispara requisição por frame. Mudança de volta restaura enquadramento padrão, salvo quando o usuário fixa zoom.

No Race Explorer, hooks especializados separam relógio, cache de séries por
piloto+volta, cache incremental de pista e estado de apresentação. Manifesto e
frames permanecem imutáveis fora destes caches. Corrida real deriva as voltas
ativas do tempo global e prepara a volta seguinte sem requisitar por frame;
comparação usa tempo relativo e nunca aparenta que os carros dividiram o mesmo
instante. Gráfico e tabela reutilizáveis vivem em `shared` e recebem apenas o
modelo canônico, permitindo uso posterior pelo Telemetry Lab.

## Erros e estados

Boundary por rota, painéis reutilizáveis e mensagens localizadas. Erro de um canal não derruba replay. Controles indisponíveis preservam explicação acessível.

## Performance

A cena Three.js/React Three Fiber é carregada dinamicamente sem SSR. Suspender WebGL fora da viewport e manter estado de câmera fora do Canvas. Atualizar séries incrementalmente, evitar requisições por frame e medir antes de virtualizar. Gráficos usam SVG nativo; ECharts não está instalado.

A publicação da cena no contêiner usa efeito de layout para sincronizar o commit visual com o relógio; não alterar amostras ou contratos para corrigir renderização. Para reutilização no restante do produto, seguir `PROJECT_STANDARDS.md`.

# Status vigente — 2026-10-20

## Produto

- **Race Explorer:** sessão real Belgium/Spa 2025 Race, carga/cache/cancelamento,
  replay, comparação, gráficos/tabela e cena com fallback 2D. Outras sessões
  continuam explicitamente indisponíveis.
- **Telemetry Lab:** CSV/JSON reais no navegador, worker cancelável, inspeção,
  mapeamento/unidades confirmados e sessão canônica em memória. Quatro séries,
  canais, cursor, zoom, tempo relativo derivado e distância condicional. Sem
  envio, persistência, logs do conteúdo, fixture substituta ou pista inventada.
- Português/inglês nos mesmos componentes. Sem novas dependências, autenticação,
  RCZ, expansão de GPs ou deploy nesta entrega.

## Três pontos de revisão

1. **Concluído:** trabalho anterior preservado em `0342e16`; navegação, idioma,
   foco e disponibilidade corrigidos em `d618e34`. `npm run check` passou com
   85 testes web, 33 API e 20 E2E.
2. **Concluído:** importação real de D-020, reutilização dos gráficos/tabela,
   proteção contra respostas antigas e descarte. `npm run check` passou com
   **137 testes web, 33 API e 28 E2E**, incluindo os dois módulos. Contratos,
   lint, tipos e build passaram. Smoke real permanece opt-in separado.
3. **Entregue:** revisão independente de código e imagens, smoke Spa real e
   medição com 50 mil registros/500 mil células. Branch publicada e
   [PR de revisão #1](https://github.com/LucasAbrandao/cortex/pull/1), sem merge
   na principal ou deploy. A primeira
   [CI de integração passou](https://github.com/LucasAbrandao/cortex/actions/runs/39522427390);
   os checks da revisão final ficam vinculados ao PR.

## Evidências e limites

- Playwright importou CSV por seletor e JSON por arraste, conferiu valores reais,
  zero/false/ausências, milissegundos, duas voltas da mesma entidade, quatro séries,
  erros, privacidade e descarte por reset/navegação/reload.
- PT/EN e larguras 1440/1200/1024/390 passaram; teclado e redução de movimento
  foram exercitados. Capturas/artefatos permanecem ignorados pelo Git.
- Smoke de navegador real **passou em produção**: sessão `2025-belgium-r-2-6`,
  **20 pilotos/879 voltas**, `source: normalized-cache`, quatro larguras e zero
  erros de página/console. Carga até manifesto **44,09 s**; manifesto **70.324 bytes**.
- Medição em produção **passou**: inspeção **748 ms**, análise **1.182 ms** e
  cursor com mediana **50 ms** (automação + dois frames). Contexto, memória,
  bundle e limitações em `PERFORMANCE.md`; nenhuma alegação de ganho ou FPS.
- Verificação final completa: **137 testes web, 33 API e 28 E2E determinísticos**;
  os dois cenários opt-in também passaram separadamente. Contratos, lint, tipos
  e build sincronizados. A inspeção final corrigiu contraste do botão de reset.
- Avisos conhecidos: certificado Conda, depreciação TestClient/THREE.Clock e
  cores do terminal. Nenhum gate foi ignorado. Sem medição de FPS ou hardware móvel.

Detalhes: `TELEMETRY_IMPORT_REQUIREMENTS.md`, `TESTING.md`, `PERFORMANCE.md`, `DECISIONS.md` e
`DATA_CONTRACT.md`. O [status anterior](history/STATUS_2026-10-13.md) e o
[histórico até setembro](history/STATUS_2026-09-09.md) preservam a retomada.

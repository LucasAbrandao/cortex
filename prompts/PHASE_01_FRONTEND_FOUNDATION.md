# Fase 01 — fundação do frontend

## Objetivo

Entregar a composição visual completa e navegável antes de integrar FastF1 real.

## Contexto

Leia `DESIGN_SYSTEM.md`, `FRONTEND_ARCHITECTURE.md`, brief e aceite. Preserve contratos e scripts definidos na Fase 00.

## Entregas

- Tokens, tipografia, reset e layouts responsivos.
- Shell com sidebar compacta, expansão por hover/foco, fixação, redimensionamento acessível e drawer mobile.
- PT-BR/EN com textos separados de componentes.
- Home com entradas para Race Explorer e Telemetry Lab.
- `/f1` com calendário 2025: Belgium habilitada, demais visíveis/desabilitadas com explicação.
- Rotas de Spa, Telemetry, importação e sessão com estados controlados.
- Componentes compartilhados de loading, progresso, vazio, erro, aviso e indisponibilidade.
- Fixtures e testes de componentes/E2E para navegação.

## Dependências

Antes de instalar ícones, motion, estado, query, resize ou UI kit, apresente licença, tamanho, acessibilidade e alternativa nativa. Prefira CSS para movimento simples. Não introduza biblioteca de gráficos nesta fase.

## Verificação

Browser em 1440, 1024 e 390 px; mouse, teclado, foco, idioma e `prefers-reduced-motion`. Não aceitar overflow horizontal ou controles sem label.

## Aceite

Todas as rotas são coerentes e navegáveis, limitações estão claras e a interface respeita o sistema visual. Gates passam, status é atualizado e o agente para.

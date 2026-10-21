# Roadmap

## Sequência de entrega

`STATUS.md` é a fonte de estado vigente, prioridades e evidências. Este roadmap
define o escopo das fases; `PROJECT_STANDARDS.md` orienta os padrões compartilhados
e `ACCEPTANCE_CRITERIA.md` define as condições de aceite. A próxima jornada de
produto é a Fase 04, após fechar a estabilização da retomada; não reinicializar
as fases de fundação já registradas no histórico.

## Fase 00 — repositório e contratos

Preservar o projeto anterior, criar monorepo, toolchains, OpenAPI, tipos gerados, fixtures, scripts e CI mínimo. Nenhuma interface extensa antes do contrato compilar nos dois lados.

## Fase 01 — fundação visual

Criar tokens, shell, sidebar, idiomas, Home, seleção F1, rotas Telemetry e estados reutilizáveis. Validar desktop, tablet, mobile e teclado.

## Fase 02 — FastF1 real

Implementar cache, catálogo 2025, Spa Race, jobs, normalização, manifest, replay e séries. Cobrir carga FastF1, cache normalizado, cancelamento, retry, erro e indisponibilidade; origem é `normalized-cache` quando comprovada, ou `null` quando rede e cache nativo não podem ser distinguidos.

## Fase 03 — Race Explorer

Integrar mapa real, classificação, controles, piloto em foco, comparação, canais, cursor e zoom. Distância somente quando válida; cache compartilhado não altera amostras e a estimativa visual respeita barreiras e limites de continuidade.

## Fase 04 — importação visual

Construir seleção e arraste de CSV/JSON, leitura limitada no navegador e preview seguro. Definir limites explícitos; cobrir extensão inválida, tamanho excedido, vazio e JSON malformado. Depois exigir tempo e canal numérico no mapeamento confirmado, abrir fixture canônica no workspace compartilhado e manter banner de demonstração. Descartar estado ao sair/reiniciar; não transmitir ou persistir arquivos.

## Fase 05 — qualidade

Fechar acessibilidade, E2E integrado e documentação. Verificar PT/EN, teclado, movimento reduzido e larguras 1440/1200/1024/390. Registrar smoke real separado e medir memória, bundle e atualização de gráficos antes de otimizar. Preparar informações para uma decisão futura de deploy, sem publicá-lo nesta fase.

## Dependências

Cada fase depende das capacidades anteriores e de seus gates aplicáveis. Mudança de contrato exige regeneração e verificação do schema/tipos, sem reinicializar o repositório; mudança de identidade visual atualiza `DESIGN_SYSTEM.md` antes de código, com a autorização exigida por `AGENTS.md`.

# Roadmap

## Sequência de entrega

`STATUS.md` é a fonte de estado vigente, prioridades e evidências. Este roadmap
define o escopo das fases; `PROJECT_STANDARDS.md` orienta os padrões compartilhados
e `ACCEPTANCE_CRITERIA.md` define as condições de aceite. A próxima jornada de
produto evolui conforme D-020 (importação real local); não reinicializar
as fases de fundação já registradas no histórico.

## Fase 00 — repositório e contratos

Preservar o projeto anterior, criar monorepo, toolchains, OpenAPI, tipos gerados, fixtures, scripts e CI mínimo. Nenhuma interface extensa antes do contrato compilar nos dois lados.

## Fase 01 — fundação visual

Criar tokens, shell, sidebar, idiomas, Home, seleção F1, rotas Telemetry e estados reutilizáveis. Validar desktop, tablet, mobile e teclado.

## Fase 02 — FastF1 real

Implementar cache, catálogo 2025, Spa Race, jobs, normalização, manifest, replay e séries. Cobrir carga FastF1, cache normalizado, cancelamento, retry, erro e indisponibilidade; origem é `normalized-cache` quando comprovada, ou `null` quando rede e cache nativo não podem ser distinguidos.

## Fase 03 — Race Explorer

Integrar mapa real, classificação, controles, piloto em foco, comparação, canais, cursor e zoom. Distância somente quando válida; cache compartilhado não altera amostras e a estimativa visual respeita barreiras e limites de continuidade.

## Fase 04 — importação real local (D-020)

Seleção/arraste CSV/JSON, leitura limitada por bytes/registros/células, preview
seguro e mapeamento/unidades confirmados. Worker normaliza os valores reais para
séries canônicas compartilhadas, com comparação, cursor e zoom. Descartar estado
ao sair/reiniciar/recarregar; não transmitir, persistir ou substituir por fixture.

## Fase 05 — qualidade

Fechar acessibilidade, E2E integrado e documentação. Verificar PT/EN, teclado, movimento reduzido e larguras 1440/1200/1024/390. Registrar smoke real separado e medir memória, bundle e atualização de gráficos antes de otimizar. Preparar informações para uma decisão futura de deploy, sem publicá-lo nesta fase.

## Dependências

Cada fase depende das capacidades anteriores e de seus gates aplicáveis. Mudança de contrato exige regeneração e verificação do schema/tipos, sem reinicializar o repositório; mudança de identidade visual atualiza `DESIGN_SYSTEM.md` antes de código, com a autorização exigida por `AGENTS.md`.

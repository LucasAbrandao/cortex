# Roadmap

## Posição atual — 2026-09-09

Fases 00–03 concluídas, com evoluções do Race Explorer até D-019 e correção
de sincronização do replay. Fase 04 ainda pendente: rotas do Telemetry Lab são
placeholders, não um fluxo completo de importação. Fase 05 ainda não encerrada.
`STATUS.md` registra evidências; `PROJECT_STANDARDS.md` orienta a adoção dos
padrões compartilhados. A lista abaixo preserva o escopo de cada fase.

## Fase 00 — repositório e contratos

Preservar o projeto anterior, criar monorepo, toolchains, OpenAPI, tipos gerados, fixtures, scripts e CI mínimo. Nenhuma interface extensa antes do contrato compilar nos dois lados.

## Fase 01 — fundação visual

Criar tokens, shell, sidebar, idiomas, Home, seleção F1, rotas Telemetry e estados reutilizáveis. Validar desktop, tablet, mobile e teclado.

## Fase 02 — FastF1 real

Implementar cache, catálogo 2025, Spa Race, jobs, normalização, manifest, replay e séries. Cobrir rede, cache, cancelamento, erro e indisponibilidade.

## Fase 03 — Race Explorer

Integrar mapa real, classificação, controles, piloto em foco, comparação, canais, cursor e zoom. Distância somente quando válida.

## Fase 04 — importação visual

Construir upload seguro no navegador, preview, inferência visual, mapeamento e workspace demonstrável com fixtures, rotulando a limitação.

## Fase 05 — qualidade

Fechar acessibilidade, E2E, smoke real, performance medida, documentação e preparação para a decisão futura de deploy.

## Dependências

Cada fase depende da anterior e só inicia após seus gates. Mudança de contrato retorna à Fase 00; mudança de identidade visual atualiza `DESIGN_SYSTEM.md` antes de código.

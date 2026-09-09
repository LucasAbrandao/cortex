# Auditoria do frontend — 2026-09-04

> Registro histórico. Para a cena Three.js, apresentação e composição atuais,
> consultar D-018/D-019, `DESIGN_SYSTEM.md` e `PROJECT_STANDARDS.md`.


## Inventário encontrado

- Next.js App Router com seis rotas de produto e TypeScript estrito.
- `AppShell` já concentrava idioma, sidebar responsiva, redimensionamento e
  acessibilidade do drawer. Esses comportamentos foram preservados.
- Features já tinham bons limites: catálogo F1, carregamento de sessão, Race
  Explorer e Telemetry Lab. Nenhuma chamada de API foi movida ou alterada.
- SVG nativo já atende os gráficos e o mapa, sem uma dependência de gráficos
  justificada. A decisão D-014 permanece válida.

## Manter e reutilizar

- Contrato OpenAPI gerado e cliente fino em `@cortex/contracts`.
- Estados honestos de loading, erro, vazio, limitação e indisponibilidade.
- Painéis redimensionáveis e controles do Race Explorer.
- i18n centralizado em `src/i18n.ts` e regra global de movimento reduzido.

## Melhorar e abstrair

- Tokens: os tokens iniciais eram úteis, mas misturavam papéis semânticos e
  valores de implementação. O CSS agora expõe aliases para canvas, superfície,
  texto, estados, espaçamento, raios e elevação.
- Navegação: a sidebar tinha boa base, mas não oferecia contexto, troca de
  projeto ou navegação rápida. O shell passa a conter top bar, switcher e
  command palette.
- Componentes: `PageHeader`, `StatusBadge` e `Icon` consolidam padrões antes
  repetidos em páginas de catálogo e Telemetry Lab.
- Home: a antiga apresentação foi convertida em Mission Control de capacidades
  reais; não foram adicionadas métricas sintéticas ou dados de atividade.

## Riscos e limites observados

- Não há biblioteca externa de ícones, tabelas ou gráficos. Isso reduz bundle e
  dependências, mas amplia a responsabilidade dos componentes nativos.
- O CSS ainda contém regras específicas do Race Explorer por ser um workspace
  denso; elas devem ser extraídas apenas quando houver um segundo consumidor
  real, para evitar uma abstração prematura.
- Importação real e dados privados continuam fora da UI: os estados da Fase 04
  permanecem explícitos, sem fallback de fixture.

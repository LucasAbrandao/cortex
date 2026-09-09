# Padrões compartilhados a partir do Race Explorer

## Escopo — 2026-09-09

Esta consolidação documenta as decisões D-018 e D-019 e orienta a evolução do
projeto. O Race Explorer é a referência implementada; isso não significa que
Home, catálogo e Telemetry Lab já receberam sua composição visual. Mudanças
futuras do sistema visual continuam sujeitas às regras de aprovação de AGENTS.md.

## O que deve ser reutilizado

- Hierarquia com uma visualização dominante, controles próximos e detalhes
  progressivos. Reservar espaço para painéis; não encobrir gráficos ou transporte.
- Tokens semânticos de `apps/web/app/styles.css`, primitivas de `shared/ui.tsx`,
  estados de `shared/state-panel.tsx`, shell e navegação existentes.
- Gráficos, tabela e cores estáveis de `shared/telemetry-workspace.tsx`, alimentados
  pelo contrato canônico; não duplicar renderizadores ou tipos por origem.
- Seleção em foco independente das séries comparadas e da apresentação visual.
  Relógio único por workspace; comparação explicita seu eixo relativo.
- Cache incremental por entidade/volta e carregamento fora do ciclo de animação.
  Suspender renderização pesada fora da viewport sem perder cursor ou câmera.
- Português e inglês nos mesmos componentes, teclado, foco visível, alternativa
  tabular, toque e redução de movimento. Validar 1440, 1200, 1024 e 390 px quando
  a composição compartilhada mudar.
- Loading, progresso honesto, cancelamento, retry, vazio, erro e indisponibilidade
  com explicação local. Um canal ausente não invalida os demais.

## Integridade que vale para todos os módulos

Ausência é `null`; zero e `false` válidos continuam dados. Não conectar lacunas,
corrigir GPS, preencher canais ou trocar falha real por fixture. Disponibilidade,
unidade, origem e derivação devem acompanhar a leitura. Distância só pode alinhar
uma comparação quando todas as séries selecionadas a suportam.

Pydantic/OpenAPI continua sendo a fonte pública de verdade. FastF1 e futuros
adaptadores privados produzem o mesmo modelo; navegador não normaliza FastF1,
Pandas ou RCZ. Cache público é permitido; uploads privados não são persistidos.

## O que é específico do Race Explorer

Cena Three.js/React Three Fiber, torre top 3 mais foco e seleção de carros são
recursos de corrida, não exigências para todas as páginas. A perspectiva é plana,
sem altitude medida. Somente carros podem estimar posição entre amostras válidas
adjacentes, com limites e indicação explícita; essa estimativa jamais alimenta
API, gráficos, métricas ou classificação. Posições originais seguem disponíveis.

A apresentação ilustrativa anterior à carga está rotulada, pode ser pausada e
não substitui pista ausente da sessão real. A torre usa registros de passagem,
sem inferir ultrapassagens por GPS. Não há sincronização automática com TV.

## Aplicação nas próximas entregas

Home e catálogo devem adotar hierarquia, tokens e estados conforme sua jornada.
Telemetry Lab deve reutilizar gráficos e tabela canônicos ao implementar a
Fase 04, com banner persistente de fixture. Hoje não há preview, mapeamento ou
workspace de importação funcional. Backend de upload, RCZ, outras corridas,
autenticação e publicação continuam fora desse escopo.

Cada adaptação deve registrar o que foi entregue, testar os estados e conferir
browser nas larguras afetadas. Não confundir diretriz documentada com migração
implementada ou medição de desempenho concluída.

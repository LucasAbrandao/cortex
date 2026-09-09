# Sistema visual

## Direção

Centro de análise de corrida: escuro, técnico, fluido e expressivo, com alta densidade organizada. Cada viewport possui um foco dominante; no Race Explorer é a pista, no workspace é o gráfico ativo. Evitar neon excessivo, glassmorphism generalizado, sombras pesadas e movimento decorativo contínuo.

## Tokens iniciais

```css
--color-bg: #090f1d;
--color-surface: #111b2e;
--color-surface-raised: #172640;
--color-border: #293b5b;
--color-text: #f2f6ff;
--color-text-muted: #93a6c5;
--color-primary: #83b3ff;
--color-cyan: #87e5d0;
--color-lavender: #b9aaff;
--color-coral: #ff9fad;
--color-amber: #f5c77a;
--radius-control: 8px;
--radius-panel: 14px;
--motion-fast: 140ms;
--motion-base: 220ms;
--motion-panel: 420ms;
```

Cores semânticas sempre recebem texto, ícone, padrão ou posição. Cor do piloto identifica série; coral/ciano/lavanda identificam eventos e não substituem a série.

## Evolução do sistema — 2026-09-04

O CSS nativo em `apps/web/app/styles.css` centraliza os tokens;
`apps/web/app/race-experience.css` define a composição específica da cena. Além
dos tokens legados compatíveis com os workspaces, o sistema centraliza aliases
semânticos: `--bg-canvas`, `--bg-surface`, `--bg-surface-hover`,
`--bg-elevated`, `--border-subtle`, `--text-primary`, `--text-secondary`,
`--text-muted`, `--accent` e os estados `--status-*`.

- Espaçamento: `--space-1` a `--space-8` (base de 4 px).
- Raios: `--radius-sm`, `--radius-md`, `--radius-lg`; controles são compactos,
  superfícies institucionais usam o nível grande.
- Elevação: uma única sombra discreta para menus e palette. Painéis usam
  contraste de superfície e borda sutil como regra.
- Tipografia: interface sans-serif; metadados, atalhos, status, IDs e números
  usam `ui-monospace` e numerais tabulares.

### Componentes compartilhados

- `PageHeader`: contexto, título, descrição e ações de página.
- `StatusBadge`: ponto, texto e tom semântico; nunca só cor.
- `Icon`: conjunto SVG local de traço consistente, sem nova dependência.
- `StatePanel`: loading, erro, vazio, alerta e indisponibilidade com live
  region; erros expõem `role=alert`.

### Padrões de interação

- Use a command palette para navegação, projeto e ações globais (`Ctrl+K`
  ou `/` fora de campos). Ela aceita setas, Enter e Escape.
- Use drawer para navegação mobile e detalhes contextuais. Modal é reservado
  para operações que interrompem a tarefa; a palette é o único diálogo global
  atual.
- Cards representam capacidade, resumo ou ação. Propriedades técnicas devem
  preferir pares chave:valor ou tabela compacta; não cartões aninhados.

## Tipografia e ritmo

Fonte sem serifa legível com numerais tabulares. Escala pequena e controlada: título de página, seção, corpo, metadado. Espaçamento em múltiplos de 4 px; alvos de toque mínimos de 44 px em telas compactas.

## Shell e sidebar

Desktop: sidebar compacta por padrão, expande por hover/foco e pode ser fixada. O usuário pode redimensioná-la dentro de limites; o divisor funciona por teclado e anuncia largura. Mobile: drawer modal com foco contido e retorno ao gatilho. Itens: Home, Race Explorer, Importar telemetria e idioma.

## Painéis

Bordas sutis, cabeçalho persistente, ações previsíveis e estado de foco. Divisores permitem redimensionar mapa/classificação e gráficos/tabela; botões maximizam/restauram sem perder cursor ou zoom.

## Movimento

Usar `transform`/`opacity` para sidebar, painel e seleção. Amostras analíticas permanecem originais. Somente carros da cena podem usar a estimativa visual limitada de D-018, identificada e alternável para posições originais. `prefers-reduced-motion` reduz deslocamento e preserva todo conteúdo.

## Responsividade

- ≥1200 no Race Explorer: cena e análise com coluna própria para classificação.
- <1200: classificação no fluxo acima dos gráficos.
- <768: controles compactos com wrap, opções de volta recolhíveis e sem overflow horizontal.

## Acessibilidade

Foco visível de alto contraste, landmarks, headings ordenados, labels persistentes, nomes acessíveis nos gráficos, alternativa tabular, status por `aria-live` sem excesso e operação completa por teclado.

## Referência atual — Race Explorer 2026-09-08

Cena integrada ao fundo, câmera automática por scroll, exploração, fixação e
restauração; movimento reduzido mantém enquadramento estático. WebGL suspende
fora da viewport e dispõe de fallback 2D. A cena pode ser ampliada; o mini-monitor
flutuante foi substituído. Profundidade visual não representa altitude medida.

Transporte abaixo do cabeçalho com alturas medidas, botões circulares e
velocidades segmentadas. Torre tem espaço próprio, resume top 3 mais foco na
análise e expande sem invadir gráficos. Cores de pilotos permanecem estáveis.

A direção compartilhável e os limites de adoção estão em
`PROJECT_STANDARDS.md`. As demais rotas ainda não foram migradas nesta entrega.

## Paleta local da experiência atual

`race-experience.css` delimita superfícies neutras (`#101317`, `#20262d`,
`#2a333d`), texto claro (`#f1f0eb`), ações e foco azuis (`#80b4f5`) e acentos
quentes nos dados. Esses overrides são locais ao Race Explorer; os tokens
iniciais acima não descrevem sua paleta final. Levar essa direção às outras
rotas exige uma adaptação explícita, sem copiar seletores específicos de corrida.

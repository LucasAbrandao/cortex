# Requisitos da importação de telemetria

## Estado implementado — 2026-09-09

As rotas existem, mas seleção de arquivo está desabilitada e a sessão é um
placeholder. Os requisitos abaixo são entregas planejadas da Fase 04, não
funcionalidades concluídas. Reutilizar `shared/telemetry-workspace.tsx` e seguir
`PROJECT_STANDARDS.md` ao implementá-las. Upload real continua fora desta fase.

## Limite da fase

O protótipo demonstra a jornada completa com fixtures versionadas e preview local. Não envia nem normaliza uploads no backend. A interface deve mostrar “Protótipo com dados de exemplo” no mapeamento e no workspace.

## Rotas

- `/telemetry`: finalidade, privacidade, formatos e CTA.
- `/telemetry/import`: seleção, inspeção e mapeamento.
- `/telemetry/session`: workspace demonstrável.

## Upload visual

Aceitar seleção e drag-and-drop de `.csv`/`.json`. Validar extensão, tamanho máximo do protótipo e leitura. Ler somente cabeçalho e amostra limitada no navegador; nunca registrar o conteúdo.

Para E2E, fixtures válidas e inválidas cobrem: colunas esperadas, nomes alternativos, canal ausente, arquivo vazio, JSON malformado e tipos mistos.

## Inspeção

Mostrar nome seguro, tamanho, contagem aproximada quando conhecida, colunas, tipos inferidos e avisos. Não mostrar caminho local.

## Mapeamento

Papéis: tempo, piloto/entidade, volta, distância, latitude, longitude e canais. Tempo e pelo menos um canal numérico são obrigatórios para avançar na demonstração. Sugestões nunca são aplicadas sem confirmação visível.

## Workspace demonstrável

Após confirmação, usar uma fixture canônica correspondente ao cenário mapeado. Exibir banner persistente de demonstração, catálogo dinâmico, seleção de série, gráficos, tabela e estados ausentes.

## Futuro

O backend real deverá validar limites, unidades, ordenação, duplicatas e disponibilidade, criar sessão efêmera e descartar dados. Esta fase não deve criar endpoint falso que aparente esse processamento.

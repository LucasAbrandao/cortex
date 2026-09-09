# Fase 04 — protótipo visual de importação

## Objetivo

Demonstrar upload, inspeção, mapeamento e workspace de arquivos de automobilismo sem implementar normalização backend.

## Entregas

- Dropzone e seletor acessíveis para CSV/JSON.
- Leitura local limitada de cabeçalho/amostra, sem upload ou log.
- Validação de extensão, tamanho, vazio e JSON malformado.
- Preview de colunas, tipos e avisos.
- Mapeamento explícito de tempo, piloto, volta, distância, coordenadas e canais.
- Regras mínimas para avançar e revisão do mapeamento.
- Workspace abastecido por fixture canônica correspondente.
- Banner persistente “Protótipo com dados de exemplo”.
- Testes de componentes e E2E para fixtures válidas e inválidas.

## Restrições

Não criar endpoint de upload, persistência, histórico ou normalização simulada. Não mostrar caminho local. Não inserir valores do arquivo como HTML.

## Aceite

O fluxo é funcional e honesto: seleção e mapeamento respondem ao arquivo, enquanto a análise é claramente demonstrativa. Teclado, mobile, erro e descarte ao sair foram verificados. Atualize status e pare.

# Brief do produto

## Produto

Cortex é um ambiente técnico e acessível para compreender corridas por replay e telemetria, conduzindo o usuário da visão geral à comparação volta a volta.

## Público

Entusiastas de automobilismo, estudantes e analistas de dados, pilotos e equipes amadoras. O primeiro uso não pressupõe conhecimento de FastF1 ou do schema do arquivo.

## Problema

Dados de corrida chegam em fontes, frequências, unidades e níveis de qualidade diferentes. Ferramentas comuns expõem números sem explicar disponibilidade, sincronização ou lacunas, tornando comparações fáceis de interpretar incorretamente.

## Proposta

- Race Explorer: escolher sessão, carregar dados reais, reproduzir posições e investigar voltas.
- Telemetry Lab: inspecionar e mapear arquivo de automobilismo, então usar o mesmo workspace.
- Núcleo comum: séries “piloto + volta”, canais dinâmicos, eixos de tempo/distância, cursor, zoom, pista e tabela.

## Jornada crítica do protótipo

Home → F1 → calendário 2025 → Spa Race → carregar → acompanhar progresso → replay → selecionar piloto → marcar séries → escolher canais → comparar voltas.

Jornada secundária: Home → Telemetry → importar fixture → inspecionar → mapear → abrir workspace demonstrável.

## Dentro do protótipo

Frontend completo, Spa real, cache, jobs, comparação por tempo, distância quando válida, estados honestos, PT-BR/EN, responsividade e CI.

## Fora do protótipo

Deploy, autenticação, pagamentos, colaboração, live timing, upload normalizado no backend, suporte irrestrito a planilhas genéricas e habilitação real de outras corridas.

## Sucesso observável

Uma pessoa consegue entender as duas entradas pela Home, carregar Spa, reproduzir a corrida, comparar volta 7 de um piloto com volta 9 de outro e saber por que uma visualização está indisponível. O fluxo de importação demonstra a experiência futura sem se apresentar como processamento final.

# Importação real de telemetria — D-020

## Jornada e formatos

`/telemetry` apresenta o módulo; `/telemetry/import` seleciona/recebe arraste,
inspeciona e confirma o mapeamento; `/telemetry/session` analisa os valores reais
do arquivo. Acesso à sessão sem memória oferece nova importação. Não há fallback
para fixture, endpoint de upload ou pista/classificação inventada.

- CSV UTF-8 com cabeçalho único e não vazio; delimitador vírgula, ponto e vírgula
  ou tabulação. Aspas escapadas e quebras dentro de campos são suportadas.
- JSON como array de objetos planos escalares ou `null`; chaves ausentes são
  `null`. Objetos aninhados, JSONL e RCZ são recusados com orientação.
- Máximo 5 MiB, 50.000 registros, 64 colunas e 500.000 células. Exceder qualquer
  limite bloqueia, sem truncar o conjunto analisado. Preview de até 20 registros,
  com limite visual por célula; o dado analisado permanece integral.

## Mapeamento e integridade

Tempo e um canal numérico com tempo válido são obrigatórios. Nomes reconhecidos
são sugestões; unidade s/ms, base temporal e confirmação exigem ação explícita.
Decimal usa ponto ou vírgula, sem separadores de milhares. Canais podem declarar
unidade; unidade omitida continua desconhecida. Campos booleanos preservam `false`.

Entidade e volta são opcionais. Sem entidade, `FILE` é apenas um identificador
técnico; sem volta, `lap: null`. Volta zero original é preservada. Tempo contínuo
deve crescer por entidade, inclusive entre voltas. Tempo reiniciado deve crescer
por entidade/volta. Duplicata/regressão bloqueia com índice do registro lógico
(inclui cabeçalho no CSV); não se reordena nem deduplica. Dados ausentes/invalidáveis
ficam `null` e interrompem curvas. Conversão s/ms não cria amostras.

Distância exige coluna explícita e unidade m/km confirmada. Só habilita quando
todas as séries selecionadas têm ao menos duas amostras e distância/tempo finitos
e estritamente crescentes. Não se deriva distância por velocidade/GPS. Lacunas
são medidas em segundos em todos os eixos; não há interpolação ou extrapolação.
Amostras isoladas são pontos. Tempo desde o início de cada série é derivado
explicitamente do primeiro timestamp válido quando a base é contínua.

## Estado e análise

Worker nativo realiza leitura/normalização canceláveis; troca, cancelamento e
saída invalidam respostas antigas. Estado vive apenas no layout do módulo e
é descartado ao sair, reiniciar ou recarregar. Não há envio, armazenamento de
conteúdo em disco/browser, recuperação de sessão ou logs do arquivo.

`ImportedTelemetrySession` contém metadados locais e os tipos gerados de canais,
amostras e séries. O manifesto/endpoints FastF1 não são simulados para arquivos.
Gráficos e tabela são compartilhados. Há até quatro séries, seleção de canais,
cursor, zoom e motivos de indisponibilidade. Busca/paginação limita controles
montados na lista de séries; os dados continuam integrais.

## Verificação

Testes unitários cobrem parsing, limites, unidades, `null`/zero/`false`, relógios
e erros seguros. Provider cobre cancelamento, substituição e cleanup. Playwright
percorre arquivos controlados reais, valores conhecidos, PT/EN, teclado, quatro
larguras, privacidade e descarte. Resultados pertencem ao `STATUS.md`.

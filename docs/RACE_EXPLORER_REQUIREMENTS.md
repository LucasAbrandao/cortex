# Requisitos do Race Explorer

## Seleção

A página `/f1` apresenta 2025 e todos os eventos conhecidos. Eventos não validados permanecem visíveis, desabilitados e rotulados. Belgium permite Race e encaminha para `/f1/2025/belgium/race`.

## Carregamento

Inicia somente por ação explícita. O usuário vê estágio, mensagem, origem do dado, tempo decorrido e cancelamento. Erro oferece nova tentativa; cancelamento volta à seleção.

## Composição

- mapa real como elemento dominante;
- controles e volta ativa imediatamente legíveis;
- classificação sincronizada;
- painel comparativo secundário e redimensionável;
- torre de classificação ocupa coluna reservada ao lado da pista/análise a
  partir de 1200 px; abaixo disso, resumo horizontal acima dos gráficos.

## Estado

- `focusedDriverCode`: um piloto em foco no mapa;
- `comparisonSeries`: pares independentes de piloto e volta;
- `selectedChannels`;
- `activeLap` e `cursorTime`;
- `alignmentMode`: global, volta ou distância;
- `zoomWindow` local por gráfico;
- `playbackRate` e `isPlaying`.

Mudar foco não altera comparação. Alterar comparação não altera foco.

## Replay

O replay tem dois modos explícitos: **Corrida real** usa o relógio global da sessão; **Comparação de voltas** começa cada piloto+volta em seu próprio tempo relativo. Trocar modo, piloto em foco ou volta pausa a reprodução. Na corrida real, alterar o foco preserva o instante global; na comparação, o limite é a maior duração confiável entre as séries e cada série para no próprio fim.

Play, pause, seek, anterior/próxima volta e velocidades 0,5×, 1×, 2× e 5× permanecem disponíveis. A seleção direta de volta posiciona a corrida no início **derivado** dela apenas quando término e duração estão presentes; se faltar um desses termos, o limite fica indisponível, sem estimativa. Em Corrida real, continuar entre voltas é o padrão; o usuário pode escolher pausar no fim da volta selecionada. Ajustes de −1 s e +1 s permitem alinhar manualmente o replay com uma gravação externa sem prometer sincronização automática.

Até quatro pilotos monitorados são independentes do foco. A volta ativa de cada
um deriva do relógio global. Séries completas são armazenadas por piloto+volta,
com preparação da volta seguinte e sem requisição por frame. Gráficos usam uma
janela móvel de 30, 60 ou 120 s e mostram somente amostras até o cursor. Inspeção
manual pausa o replay e oferece retorno explícito ao acompanhamento.

## Comparação

Adicionar série exige piloto e volta. Volta 7 de A e volta 9 de B são combinações válidas. São permitidas no máximo quatro combinações por vez; a interface bloqueia a quinta para manter leitura e desempenho.

Cada canal usa gráfico e unidade próprios: linha para velocidade/RPM/acelerador, degrau para marcha, eventos para freio/DRS e linha derivada para aceleração longitudinal. `connectNulls` permanece falso.

## Pista

O traçado 3D deriva de uma volta de referência identificada, com proporção igual,
sobre um plano e grid técnico; profundidade visual não representa altitude real.
Até todos os pilotos da sessão podem aparecer como carros simples, enquanto os
gráficos mantêm até quatro pilotos independentes. Movimento visual interpola
linearmente apenas amostras adjacentes válidas e próximas; ausência, off-track,
tempo inválido, lacuna ou salto rejeitado interrompe e oculta o carro. A interface
permite alternar entre movimento estimado e posições originais. O scroll pode
retirar a cena da viewport sem alterar o relógio; ao retornar, ela mostra o
instante compartilhado atual. O mapa integrado pode ser ampliado, mas não usa
mais o mini-monitor flutuante.

A câmera automática gira discretamente com o scroll, sem acumular rotação.
Explorar habilita órbita e zoom; grid aparece durante interação. Fixar preserva
a vista, inclusive após ampliar ou sair da viewport. Restaurar vista reativa o
enquadramento automático. Movimento reduzido mantém enquadramento estático.
Carros genéricos são construídos com geometrias simples, sem asset externo.

A classificação na análise resume top 3 e piloto em foco, sem duplicação.
Ver classificação expande os registros no espaço reservado, com rolagem interna.
Controles de transporte ficam abaixo do cabeçalho; opções de volta são
recolhíveis no mobile. Velocidades são botões segmentados acessíveis.

## Classificação temporal

`No instante` mostra o último registro disponível até o relógio global, com marca de registro parcial ou anterior; não é uma classificação contínua por GPS. `Na volta escolhida` usa a posição registrada na passagem de cada piloto por aquela volta e informa que as passagens aconteceram em tempos diferentes. Todo piloto do manifesto permanece visível; ausência é `—`. O status final da sessão não substitui esse registro temporal.

A torre ordena exclusivamente posições registradas. Em reprodução contínua,
uma alteração comprovada move as linhas; seek, troca de modo e redução de
movimento atualizam sem transição para não encenar ultrapassagens intermediárias.

## Estados obrigatórios

Inicial, carregando, cancelado, API offline, upstream limitado, sessão vazia, pista ausente, canal ausente, série sem amostras, eixo distância indisponível e sucesso via cada camada de cache.

## Apresentação anterior à carga

A introdução usa geometria local ilustrativa de Spa e movimento identificado
como apresentação, com pausa e opção de pular. Após a carga, a cena usa somente
os segmentos da sessão; a ilustração não é fallback para telemetria ausente.
Padrões transferíveis para outros módulos estão em `PROJECT_STANDARDS.md`.

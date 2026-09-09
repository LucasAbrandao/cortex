# Fase 03 — Race Explorer

## Objetivo

Transformar a sessão Spa normalizada em replay e análise sincronizados com qualidade de produto.

## Entregas

- Mapa de pista real com proporção correta e interrupção de segmentos inválidos.
- Marcadores de pilotos, foco independente e trajetória semântica quando suportada.
- Play, pause, seek, volta anterior/próxima e velocidades previstas.
- Classificação e volta ativa sincronizadas com o relógio global.
- Seleção de séries por piloto+volta e canais dinâmicos.
- Gráfico individual por canal/unidade, cursor compartilhado, zoom local e alternativa tabular.
- Comparação por tempo de volta; distância somente quando todas as séries suportam.
- Painéis redimensionáveis, maximização e layout compacto.
- Estados ausente/parcial/vazio/erro sem curvas zeradas.

## Dependências

Apresente avaliação de ECharts e da biblioteca de painéis antes da instalação. Confirme canvas/SVG, bundle, licença, acessibilidade e comportamento de resize. Não adicione WebGL decorativo.

## Cenário obrigatório

Comparar volta 7 do piloto A com volta 9 do piloto B em velocidade, acelerador e freio; mudar foco sem mudar comparação; mover cursor e verificar pista/tabela.

## Verificação

Testes unitários do estado, componentes interativos e Playwright da jornada. Browser nas três larguras, teclado, movimento reduzido, dados ausentes e mais de três séries.

## Aceite

Replay, classificação, pista e gráficos compartilham o mesmo tempo; nenhuma lacuna é inventada; critérios da Fase 03 passam. Atualize status e pare.

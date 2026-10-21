# Critérios de aceite

Estes critérios definem o fechamento das entregas. O estado aprovado e as
evidências datadas pertencem a `STATUS.md`; a presença de um critério não
significa que já foi validado.

## Fase 00

- Projeto anterior preservado e novo repositório identificado sem ambiguidade.
- Workspaces, Python, contratos e CI mínimo executam com comandos documentados.
- Nenhum segredo, cache ou dado local rastreado.

## Fase 01

- Todas as rotas existem e navegam sem overflow.
- Sidebar expande, fixa, redimensiona por mouse/teclado e vira drawer no mobile.
- PT-BR/EN não duplicam componentes.
- Loading, vazio, erro, aviso e indisponibilidade possuem componentes acessíveis.

## Fase 02

- Calendário 2025 visível e apenas Spa Race habilitada.
- Carga real usa FastF1 com cache nativo habilitado. Uma repetição com artefato normalizado válido informa `normalized-cache`; quando a origem individual não é comprovável, informa `null` sem inferir rede/cache nativo.
- Job exibe estágio, permite cancelamento e não duplica trabalho idêntico. Cancelamento seguido de retry não perde a tentativa nova nem permite que resposta obsoleta restaure a interface.
- Manifesto, replay e séries validam contra o contrato.

## Fase 03

- Mapa usa pista real e não liga segmentos inválidos.
- Replay, classificação, cursor e volta permanecem sincronizados.
- Foco e comparação são independentes.
- Volta 7 de A e volta 9 de B podem ser comparadas por tempo de volta.
- Distância só habilita quando todas as séries suportam.
- Ausência interrompe gráfico e mostra motivo.
- Amostras inválidas permanecem barreiras na pista; voltas consecutivas só conservam movimento estimado quando a adjacência e os limites de tempo/salto permitem.
- Monitoramento e comparação reutilizam séries da janela corrente; preparação da próxima volta não cria requisições por frame.

## Fase 04

- CSV/JSON pode ser selecionado ou arrastado e recebe preview limitado.
- Limites de bytes/amostra são explícitos; extensão inválida, excesso de tamanho, vazio e JSON malformado recebem orientação.
- Mapeamento exige tempo e canal numérico.
- Arquivo inválido produz orientação; arquivo válido abre análise dos seus próprios valores, sem fallback para fixture.
- Unidades e base temporal exigem confirmação; valores conhecidos coincidem com gráficos/tabela e ausências permanecem visíveis.
- Comparação limita quatro séries e distância exige validade em todas; cancelar/trocar arquivo ignora respostas antigas.
- Conteúdo não é enviado, persistido ou registrado; estado é descartado ao sair ou reiniciar a importação.

## Fase 05

- Todos os gates passam em ambiente limpo e GitHub Actions.
- Smoke Spa real passa separadamente e registra duração, tamanho e origem observável (`normalized-cache` ou `null`); não apresenta rede/cache nativo como identificados por inferência.
- Browser verificado em 1440, 1200, 1024 e 390 px, PT/EN, teclado e movimento reduzido.
- `contracts:check` passa sem alterar artefatos versionados; falha quando estão desatualizados, independentemente do índice Git.
- Memória, bundle e atualização de gráficos têm medições registradas antes de qualquer alegação de ganho de performance.
- Documentação e status descrevem exatamente o comportamento entregue.

## Aceite global

Nenhuma tela sugere cobertura inexistente; nenhuma ausência vira zero; nenhum upload é persistido; nenhum deploy, commit ou credencial ocorre sem autorização.

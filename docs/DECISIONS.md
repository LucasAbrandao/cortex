# Decisões técnicas

## Precedência vigente

Decisões posteriores substituem apenas os trechos conflitantes das anteriores.
D-018 atualiza os marcadores discretos de D-013/D-015 exclusivamente na cena:
API e gráficos seguem sem interpolação. D-018/D-019 substituem o mini-monitor
flutuante de D-017 pela cena integrada/ampliada. D-014 continua válida para
gráficos SVG e painéis nativos; a cena usa as dependências aprovadas em D-018.
O limite de quatro refere-se à análise, não ao número de carros visíveis.
Diretrizes transversais e entregas ainda pendentes: `PROJECT_STANDARDS.md`.

## D-001 — reconstrução integral

**Aprovada.** O novo Cortex começa em estrutura limpa. Antes da implementação, o projeto anterior será preservado como `cortex-legacy-2026-08-14`. `telemetryCortex` não será modificado.

## D-002 — monorepo

**Aprovada.** Next.js vive em `apps/web`, FastAPI em `services/api` e contratos gerados em `packages/contracts`. npm workspaces coordena JavaScript; `uv` gerencia Python.

## D-003 — contrato API-first

**Aprovada.** Pydantic/OpenAPI é a fonte de verdade; tipos TypeScript são gerados. O CI falha se a geração produzir diff não registrado.

## D-004 — cache permitido e obrigatório

**Aprovada.** O cache nativo FastF1 permanece habilitado em diretório configurável. Payload normalizado público pode ser cacheado por chave versionada. Uploads privados não são persistidos.

## D-005 — cobertura inicial

**Aprovada.** O calendário de 2025 fica visível; somente Belgium/Spa 2025 Race é habilitada e validada. Demais opções mostram estado “ainda não disponível”.

## D-006 — carregamento como job

**Aprovada.** Carregamento FastF1 é assíncrono, cancelável e consultado por polling no protótipo. Progresso pode ser indeterminado em etapas sem percentual mensurável.

## D-007 — protótipo de importação

**Aprovada.** CSV/JSON apresenta upload, inspeção, mapeamento e workspace com fixtures. Não envia arquivo para normalização real nesta fase e informa essa limitação.

## D-008 — direção visual

**Aprovada.** Interface escura, técnica, fluida e expressiva; mapa ou gráfico é o foco dominante. Movimento usa CSS quando suficiente e respeita redução de movimento.

## D-009 — validação

**Aprovada.** Vitest/RTL, Pytest e Playwright compõem a base. CI usa fixtures; FastF1 real é smoke manual/agendado.

## D-010 — itens adiados

**Aprovada.** Deploy, autenticação, custos, processamento real de upload, RCZ e outras corridas não pertencem ao primeiro protótipo.

## D-011 — artefato normalizado verificável

**Aprovada na Fase 02.** O cache normalizado público guarda somente o payload
canônico de Belgium 2025 Race, seu checksum SHA-256, chave versionada e data de
criação. A escrita é atômica; JSON incompleto, checksum inválido ou chave
incompatível é removido e tratado como miss, sem adaptação silenciosa.

## D-012 — origem observável sem inferência

**Aprovada na Fase 02.** `normalized-cache` só é informado quando o artefato
canônico foi validado. FastF1 mantém seu cache nativo habilitado, mas uma carga
cujo hit/miss individual não seja verificável permanece com `source: null`; a
API não afirma origem de rede ou cache nativo por estimativa.

## D-013 — pista por posições brutas e marcadores limitados no tempo

**Aprovada na Fase 03.** O mapa recebe somente amostras `X/Y/Status` originais
de `Lap.get_pos_data()` do FastF1, sem a união interpolada de telemetria. O
relógio global soma exclusivamente o tempo relativo original de carro ou
posição ao início oficial da volta, e fica `null` se essa soma não for
comprovável. A UI
interrompe segmentos inválidos e mostra marcador apenas a partir da última
posição válida de até dois segundos antes do relógio do replay. Quando essa
evidência não existe, a posição permanece ausente.

## D-014 — gráficos e painéis nativos no protótipo local

**Aprovada na Fase 03.** ECharts e `react-resizable-panels` foram avaliados,
mas não instalados sem aprovação explícita. O protótipo implementa SVG nativo,
zoom local, cursor compartilhado, tabela acessível e painéis CSS/Pointer/teclado
com APIs nativas, sem nova dependência.

## D-015 — comparação visual limitada, rastreável e sem novos dados

**Aprovada no ajuste pós-Fase 03.** O Race Explorer mantém no máximo quatro
combinações piloto+volta por vez para preservar leitura e desempenho. A cor de
cada piloto é estável entre cartões, gráfico e pista, independentemente da
ordem das comparações. O frontend pode solicitar conjuntamente canais já
publicados no contrato e apresentar somente métricas diretamente observáveis
nas amostras retornadas; métrica sem canal ou amostra válida permanece ausente.
O cursor só posiciona um marcador na pista quando há uma posição bruta válida
no mesmo eixo temporal, sem interpolação. Atalhos de replay são locais,
descobríveis e não interceptam campos de formulário.

## D-016 — relógios explícitos e classificação por registro

**Aprovada na auditoria visual do Race Explorer em 2026-09-04.** Corrida real
opera em tempo global; comparação de voltas em tempo relativo independente por
série. O começo de uma volta é derivado apenas de término menos duração quando
ambos são válidos; sem esse limite o workspace informa indisponibilidade, sem
estimativa. A classificação `No instante` é o último registro até o relógio e
`Na volta escolhida` é a passagem registrada por piloto. Nenhuma delas é
apresentada como posição contínua por GPS ou como resultado final da sessão.

## D-017 — painel companheiro, caches por volta e movimento sem interpolação

**Aprovada na evolução do Race Explorer em 2026-09-04.** Corrida real mantém
pilotos monitorados independentes do foco e deriva a volta ativa de cada um do
relógio global. Séries e pista são carregadas incrementalmente e reutilizadas;
o avanço do relógio não dispara rede. A torre só anima mudanças de ordem
presentes nos registros, enquanto seek atualiza diretamente. Pista integrada,
ampliada e flutuante compartilham o mesmo estado. Movimento de layout não
altera, conecta ou interpola amostras canônicas.

## D-018 — cena 3D e interpolação exclusivamente visual

**Aprovada em 2026-09-08.** O Race Explorer usa Three.js/React Three Fiber para
uma cena técnica em perspectiva. A API e os gráficos preservam todas as amostras
originais. Somente os carros podem interpolar linearmente duas posições válidas
adjacentes; valores ausentes, off-track, tempos inválidos, lacunas e saltos
implausíveis quebram o movimento. A cena informa a estimativa e permite exibir
posições originais. Carros visíveis, foco e até quatro pilotos nos gráficos são
seleções independentes. O WebGL é suspenso fora da viewport e tem fallback 2D.

## D-019 — cena central e classificação com espaço reservado

**Aprovada em 2026-09-08.** A pista integra o fundo do Race Explorer. Scroll
move somente a câmera automática; explorar suspende esse movimento, fixar
preserva a vista e restaurar retorna à direção automática. O estado da câmera
fica fora do Canvas para sobreviver à suspensão de WebGL. Movimento reduzido
desativa a direção por scroll. A torre ocupa uma coluna própria no desktop,
mostra top 3 mais foco na análise e expande no mesmo espaço; abaixo de 1200 px
segue o fluxo acima dos gráficos. Nenhum desses estados altera dados ou relógio.

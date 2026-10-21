# Contrato canônico de dados

## Regras globais

- `schemaVersion` acompanha todo payload persistível.
- Tempo usa segundos e distância metros. FastF1 usa velocidade km/h e aceleração m/s²; canais importados mantêm unidade explicitamente confirmada ou `null`, sem inferência.
- Valores não finitos e ausentes viram `null`.
- Ordem original é preservada; duplicatas e inversões são reportadas. Importação bloqueia relógios não crescentes, sem ordenar ou deduplicar.
- Não preencher, suavizar ou conectar lacunas no contrato.
- Campo derivado inclui `origin: "derived"` e sua fórmula documentada.

## Tipos conceituais

```ts
type AvailabilityStatus =
  | "available" | "partial" | "absent"
  | "unmapped" | "uncalibrated";

type DataAvailability = {
  status: AvailabilityStatus;
  validSamples: number;
  totalSamples: number;
  reason: string | null;
};

type ChannelDefinition = {
  id: string;
  label: string;
  valueType: "continuous" | "integer" | "boolean" | "category" | "event";
  unit: string | null;
  origin: "source" | "derived";
  suggestedView: "line" | "step" | "events" | "table";
};
```

`SessionManifest` permanece específico de FastF1. A sessão local de D-020 usa
`ImportedTelemetrySession`, que referencia os mesmos tipos gerados de canais,
amostras e séries, com metadados locais; não inventa ano, evento ou versão FastF1.

`TelemetrySample` contém `time`, `lapTime`, `distance`, `lapNumber` e `values: Record<channelId, number | boolean | null>`.

`TelemetryTrackSample` acrescenta `x`, `y` e `onTrack`, todos anuláveis. Associação por proximidade temporal só é válida com diferença máxima documentada e nunca cria coordenadas.

Na Fase 03, cada amostra de carro ou posição mantém seu tempo relativo
original em `lapTime`. `time` global é a soma desse valor com o início oficial
disponível da volta; se um desses termos faltar, fica `null`. Cada ponto de
pista também expõe `lapNumber`, `x`, `y` e `onTrack`. A interface pode escolher
o último ponto válido de um piloto até 2 s antes do relógio do replay para
representar um marcador; acima desse limite o marcador fica ausente. Não há
interpolação entre posições, nem junção de dados de carro e posição. A API
preserva a sequência completa recebida. O Race Explorer pode interpolar apenas
a posição visual entre duas amostras adjacentes válidas; essa representação é
identificada como estimada e nunca altera a série canônica ou os gráficos.

`ComparisonSeries` identifica uma combinação de piloto, volta/janela, eixo e amostras. Piloto em foco não faz parte da série de comparação.

`ReplayPoint` contém tempo e posição real normalizada. `StandingSnapshot` contém tempo, voltas completadas, posição oficial disponível e status.

## Canais canônicos iniciais

`speed`, `rpm`, `gear`, `throttle`, `brake`, `drs` e `longitudinalAcceleration`. Canais desconhecidos são preservados como não mapeados; não são adivinhados.

## Aceleração derivada

```text
a = ((speedAtual - speedAnterior) / 3.6) / Δtempo
```

Resultado é `null` quando falta velocidade, `Δtempo <= 0` ou a lacuna excede 1 s. O cálculo deve ocorrer em um único lado do contrato; o protótipo adotará a API como fonte para evitar resultados divergentes.

## Eixos

- `globalTime`: mesmo instante real da corrida.
- `lapTime`: tempo desde o início da volta selecionada.
- `distance`: mesmo ponto percorrido, somente com distância válida para todas as séries.

O eixo ativo deve estar explícito em pedidos e respostas.

Na importação, `time` é o timestamp confirmado em segundos para base contínua;
em base reiniciada fica `null`. `lapTime` é o timestamp confirmado da série
reiniciada, ou, na base contínua, `timestamp - primeiro timestamp válido` do grupo
(eixo derivado explicitamente indicado). Identidade ausente usa chave técnica
`FILE`; volta ausente continua `null`. IDs `import:<coluna>` evitam aplicar escalas
específicas FastF1 a canais de unidades desconhecidas.

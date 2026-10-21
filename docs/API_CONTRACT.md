# Contrato da API

Base local: `/api`. Respostas de negócio incluem `requestId`; erros tratados
de validação e domínio usam o envelope `ApiErrorResponse` com código estável
e mensagem segura.

## Infraestrutura

### `GET /api/health`

Retorna estado da API, versão, FastF1 importável e cache configurado. Não realiza download.

Na Fase 02, `fastf1Available` e `cacheConfigured` descrevem apenas a
capacidade local. A resposta não carrega sessão, não mede rede e não expõe
caminhos. `GET /api/capabilities` inclui contagens e tamanhos dos caches em
bytes, nunca seus diretórios absolutos.

### `GET /api/capabilities`

Retorna idiomas, anos visíveis, formatos planejados, eixos/canais e sessões habilitadas.

## Catálogo

### `GET /api/f1/2025/events`

Retorna calendário ordenado. Cada evento inclui `availability: enabled | comingSoon`; Belgium é `enabled`.

### `GET /api/f1/2025/belgium/sessions`

Retorna sessões visíveis; somente Race (`R`) é habilitada.

O catálogo é estático e não provoca consulta ao calendário FastF1. Pedido fora
da allowlist `{ year: 2025, event: "Belgium", session: "R" }` retorna
`SESSION_NOT_SUPPORTED` antes de criar job.

## Jobs

### `POST /api/f1/jobs`

Corpo: ano, evento e sessão. Responde `202` com `LoadJob`, identificado pelo
campo `id`; o cliente consulta `GET /api/jobs/{id}`. A resposta não possui
campo `jobId` nem URL de consulta. Pedido não suportado retorna `422` antes
de criar trabalho.

### `GET /api/jobs/{jobId}`

```ts
type LoadJob = {
  requestId: string;
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  stage: "catalog" | "cache" | "download" | "normalize" | "ready";
  progress: number | null;
  message: string;
  source: "network" | "fastf1-cache" | "normalized-cache" | null;
  sessionId: string | null;
  error: { code: string; message: string } | null;
};
```

`source` é `normalized-cache` somente após leitura e validação do artefato
normalizado. Quando a fonte individual entre rede e cache nativo FastF1 não é
observável com segurança, seu valor é `null`.

### `DELETE /api/jobs/{jobId}`

Solicita cancelamento cooperativo. Repetição é idempotente; resultado concluído não é apagado do cache.

## Sessão

- `GET /api/f1/sessions/{sessionId}/manifest`
- `GET /api/f1/sessions/{sessionId}/replay?from=&to=`
- `POST /api/f1/sessions/{sessionId}/series`
- `POST /api/f1/sessions/{sessionId}/track`

Pedido de séries informa eixo, pilotos, voltas e canais. A API rejeita distância quando qualquer série não a suporta e retorna motivo estruturado.

As amostras expõem `time`, `lapTime`, `distance`, `lapNumber` e `values`. O
normalizador preserva todas as amostras recebidas, inclusive ausências, e não
realiza interpolação. Uma série sem amostras retorna disponibilidade
`absent`, e não um valor sintético.

O pedido `track` recebe pilotos opcionais ou seleções piloto+volta mutuamente
exclusivas e retorna segmentos de posições
originais por piloto+volta. Cada amostra possui `time`, `lapTime`, `lapNumber`,
`x`, `y` e `onTrack`, todos honestamente anuláveis. Segmentos são interrompidos
na renderização quando qualquer coordenada é nula ou `onTrack` não é `true`;
nenhuma coordenada é calculada, fundida ou interpolada pela API.

Quando `selections` contém somente voltas nulas, a resposta tem segmentos
vazios; a consulta não é ampliada para todos os pilotos. Pedido sem pilotos
nem seleções continua retornando os segmentos disponíveis da sessão.

## Erros

```ts
type ApiErrorResponse = {
  requestId: string;
  error: { code: string; message: string };
};
```

OpenAPI declara esse mesmo modelo para `422` nos pedidos com parâmetros ou
corpo e para `404` nas consultas de jobs e sessões. `422` inclui
`SESSION_NOT_SUPPORTED`, `INVALID_SELECTION`, `AXIS_UNAVAILABLE` e
`VALIDATION_ERROR`; job inexistente usa `404`/`JOB_NOT_FOUND` e sessão ausente
no processo usa `404`/`VALIDATION_ERROR`.

Falhas assíncronas de carga aparecem em `LoadJob.error`, após polling, com
`UPSTREAM_UNAVAILABLE`, `RATE_LIMITED`, `CACHE_ERROR` ou `NORMALIZATION_ERROR`.
Cancelamento é o estado `cancelled`, não um erro HTTP `JOB_CANCELLED`.

O cliente TypeScript lança `ApiRequestError`, mantendo a mensagem genérica
`API_REQUEST_UNAVAILABLE` e expondo `status`, `code` e `requestId`. Sem resposta
HTTP, `status` é `null`; com envelope inválido ou não JSON, `code` e
`requestId` são `null`. Mensagens e corpos brutos não são incorporados ao erro
do cliente.

Exceções internas, caminhos, respostas brutas e segredos nunca chegam ao cliente.

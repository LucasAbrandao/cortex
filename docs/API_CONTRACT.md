# Contrato da API

Base local planejada: `/api`. Todas as respostas possuem `requestId`; erros usam código estável e mensagem segura.

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

Corpo: ano, evento e sessão. Responde `202` com `jobId`, estado e URL de consulta. Pedido não suportado retorna `422` antes de criar trabalho.

### `GET /api/jobs/{jobId}`

```ts
type LoadJob = {
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

## Erros

`INVALID_SELECTION`, `SESSION_NOT_SUPPORTED`, `JOB_NOT_FOUND`, `JOB_CANCELLED`, `UPSTREAM_UNAVAILABLE`, `RATE_LIMITED`, `CACHE_ERROR`, `NORMALIZATION_ERROR`, `AXIS_UNAVAILABLE` e `VALIDATION_ERROR`.

Exceções internas, caminhos, respostas brutas e segredos nunca chegam ao cliente.

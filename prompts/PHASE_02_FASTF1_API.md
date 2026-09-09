# Fase 02 — API FastF1, cache e Spa real

## Objetivo

Carregar Belgium/Spa 2025 Race de forma real, observável, cancelável e cacheada, produzindo o contrato canônico.

## Entregas

- Health e capabilities sem download implícito.
- Catálogo 2025 com disponibilidade explícita.
- Cache FastF1 configurável e cache normalizado versionado conforme `CACHE_POLICY.md`.
- Allowlist inicial apenas para 2025/Belgium/R.
- Jobs em memória com coalescência, polling, cancelamento e erros seguros.
- Adaptador FastF1 isolado e normalizador para manifest, voltas, pilotos, replay, classificação, canais e séries.
- Endpoints definidos em `API_CONTRACT.md`.
- Testes Pytest determinísticos com fixtures e marcador separado para smoke real.
- Tipos web regenerados a partir do OpenAPI.

## Integridade

Não preencher nulls, conectar lacunas, criar pista ou usar fixture como fallback real. Cache incompatível é miss. Falha nunca grava artefato normalizado.

## Integração visual mínima

Conectar a tela Spa ao job: iniciar, acompanhar estágio, cancelar, repetir e distinguir rede/cache. Ainda não construir o Race Explorer completo.

## Aceite

Primeira carga real conclui e gera payload válido; repetição usa cache; chamadas idênticas compartilham job; cancelamento e falhas são testados. CI obrigatório permanece independente da rede. Atualize status e pare.

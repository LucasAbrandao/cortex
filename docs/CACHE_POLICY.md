# Política de cache

## Objetivo

Reduzir tempo de carregamento, parsing repetido e uso das fontes públicas sem confundir cache com dado privado ou fallback oculto.

## Camada FastF1

- Habilitar uma vez na inicialização usando diretório existente configurado por `FASTF1_CACHE_DIR`.
- Nunca envolver cargas normais em `Cache.disabled()`.
- Não usar `ignore_version`; incompatibilidade deve renovar dados com segurança.
- Expor saúde e tamanho sem revelar caminho absoluto ao navegador.

## Camada normalizada

Somente sessões públicas FastF1 podem ser persistidas. Chave:

```text
schemaVersion/fastf1Version/year/event/session/normalizerVersion
```

O artefato inclui manifesto, replay e séries reduzidas, checksum e data de criação. Escrita deve ser atômica; artefato incompleto é descartado. Um cache incompatível é miss, nunca tentativa de adaptação silenciosa.

## Concorrência

Uma chave possui no máximo uma carga ativa. Chamadas concorrentes observam o mesmo job. Falha não grava resultado normalizado.

## Invalidação

- mudança de schema, normalizador ou FastF1 cria nova chave;
- comando administrativo futuro poderá limpar cache;
- o protótipo não oferece limpeza pelo navegador;
- limites de idade/tamanho para deploy serão decididos com medições reais.

## Uploads

Conteúdo, preview e mapeamento de upload não entram em nenhuma camada persistente. Fixtures versionadas são dados de teste explícitos, não uploads.

## Observabilidade

Registrar hit/miss, duração, estágio e tamanho agregado, sem payload. A UI diferencia rede, cache FastF1 e cache normalizado.

Referência: a documentação do FastF1 recomenda manter cache habilitado para desempenho e rate limits: https://docs.fastf1.dev/fastf1.html

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

O artefato inclui manifesto, replay, séries e posições originais preservadas, checksum e data de criação. Não reduzir ou interpolar amostras para diminuir o cache. Escrita deve ser atômica; artefato incompleto é descartado. Um cache incompatível é miss, nunca tentativa de adaptação silenciosa.

## Concorrência

Uma chave possui no máximo uma carga ativa. Chamadas concorrentes observam o mesmo job. Falha não grava resultado normalizado.

## Invalidação

- mudança de schema, normalizador ou FastF1 cria nova chave;
- o normalizador vigente é v6; arquivos de chaves anteriores permanecem preservados e não são lidos como resultados v6;
- comando administrativo futuro poderá limpar cache;
- o protótipo não oferece limpeza pelo navegador;
- limites de idade/tamanho para deploy serão decididos com medições reais.

## Cache de leitura no navegador

`useRaceLapCache` compartilha séries por piloto+volta entre monitoramento e
comparação. Retém a janela requisitada, incluindo as próximas voltas indicadas
pelo consumidor, e evita recarregar a mesma série para cada painel. Esse cache
é efêmero e separado do cache público no backend; não altera, interpola ou
preenche as amostras originais.

## Uploads

Conteúdo, preview e mapeamento de upload não entram em nenhuma camada persistente. Fixtures versionadas são dados de teste explícitos, não uploads.

## Observabilidade

Observar origem, duração, estágio e tamanho agregado sem expor payload ou caminho privado. Conforme D-012, a UI informa cache normalizado somente após validação do artefato. Quando não é possível distinguir rede de cache nativo FastF1 com segurança, a origem permanece desconhecida (`source: null`). Não apresentar um hit/miss individual por inferência.

Referência: a documentação do FastF1 recomenda manter cache habilitado para desempenho e rate limits: https://docs.fastf1.dev/fastf1.html

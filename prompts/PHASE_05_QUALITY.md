# Fase 05 — qualidade e fechamento do protótipo

## Objetivo

Validar o produto integrado, corrigir problemas comprovados e produzir evidência de que o protótipo atende ao contrato.

## Trabalho

- Executar todos os gates em sequência e corrigir falhas dentro do escopo.
- Executar smoke FastF1 real frio e quente; registrar duração, origem e tamanho sem prometer metas não medidas.
- Revisar Home, catálogo, carregamento, replay, comparação e importação em três larguras.
- Auditar teclado, foco, headings, labels, contraste, live regions, tabela alternativa e movimento reduzido.
- Inspecionar memória, bundle, atualizações de gráficos, resize e overflow; otimizar somente gargalos medidos.
- Verificar logs, `.gitignore`, segredos, caches e fixtures.
- Atualizar README, decisões, contratos, status e limitações.

## E2E final

Cobrir sucesso, cache, cancelamento, API offline, upstream limitado, canal ausente, distância indisponível e importação válida/inválida.

## Restrições

Não implementar deploy, login, outras corridas ou upload backend como “melhoria de qualidade”. Não instalar ferramentas sem aprovação.

## Aceite

Todos os critérios globais passam; CI está verde; smoke real é registrado separadamente; documentação corresponde ao produto. Pare e entregue relatório final, sem commit ou publicação automática.

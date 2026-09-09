# Guia de uso dos prompts

> Retomada em 2026-09-09: fases 00–03 já implementadas. Leia primeiro
> `docs/STATUS.md`, `docs/DECISIONS.md` e `docs/PROJECT_STANDARDS.md`.
> Prompts dessas fases são históricos; não recrie o repositório nem restaure
> comportamentos substituídos por D-018/D-019. Fase 04 permanece pendente.


## Preparação

Use um agente com acesso ao ambiente local. Forneça o caminho do kit, do Cortex atual e do `telemetryCortex`. Comece pelo prompt mestre e pela Fase 00.

## Sequência

1. Cole ou referencie `MASTER_IMPLEMENTATION_PROMPT.md`.
2. Execute apenas o prompt da fase atual.
3. Responda às aprovações de dependências e ações destrutivas.
4. Revise diff, evidências e `STATUS.md`.
5. Autorize a próxima fase somente após o aceite.

## Não fazer

- Não enviar todos os prompts como uma única tarefa de implementação.
- Não permitir que uma fixture substitua FastF1 real.
- Não aceitar “funciona” sem comandos, testes e browser.
- Não autorizar move/delete sem conferir caminhos absolutos e backup.
- Não transformar deploy, login ou upload real em escopo implícito.

## Modelo de acompanhamento

```text
Fase:
Objetivo:
Mudanças:
Contratos alterados:
Comandos e resultados:
Browser verificado:
Riscos/pendências:
Aceite: aprovado | rejeitado
```

## Quando revisar a especificação

Pare e atualize `DECISIONS.md` antes de mudar cobertura de corridas, política de cache, fonte de contratos, persistência de upload, framework, sistema visual ou estratégia de deploy.

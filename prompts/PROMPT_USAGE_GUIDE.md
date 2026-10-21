# Guia de uso dos prompts

> Leia primeiro `docs/STATUS.md`, `docs/DECISIONS.md` e
> `docs/PROJECT_STANDARDS.md`. O status vigente define a retomada.
> Prompts das fases concluídas são históricos; não recrie o repositório nem
> restaure comportamentos substituídos por D-018/D-019.


## Preparação

Use um agente com acesso ao ambiente local e informe o caminho do Cortex atual. Leia o status e inspecione scripts e mudanças locais antes de escolher o prompt da próxima entrega. O prompt mestre fornece o método; seus comandos de reconstrução e os prompts de fundação não devem ser executados novamente em uma retomada. Referências ao projeto anterior servem apenas para consulta autorizada.

## Sequência

1. Cole ou referencie `MASTER_IMPLEMENTATION_PROMPT.md`.
2. Execute apenas o prompt da entrega indicada pelo status vigente; a próxima jornada de produto é a importação visual da Fase 04.
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

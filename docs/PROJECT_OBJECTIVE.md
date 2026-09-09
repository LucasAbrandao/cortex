# Objetivo do projeto

Reconstruir o Cortex do zero como monorepo preparado para publicação futura, preservando como referências — e não como base obrigatória — as regras comprovadas no `telemetryCortex` e os aprendizados do Cortex anterior.

## Resultado principal

Entregar primeiro um protótipo visual funcional cuja entrada real é o FastF1. Todas as telas de Home, seleção, Race Explorer e importação devem existir e compartilhar uma linguagem coerente. Belgium/Spa 2025 Race é a única sessão real habilitada na fase inicial.

## Princípio estrutural

```text
Browser → API → adaptador da fonte → normalização → contrato canônico → visualizações
                         └→ cache FastF1 e normalizado
```

O navegador consome dados serializáveis com unidades, nullabilidade, disponibilidade e proveniência. Nunca conhece Pandas ou detalhes da fonte.

## Relação entre módulos

Race Explorer e Telemetry Lab possuem jornadas de entrada diferentes, mas convergem em `SessionManifest`, seleção de séries, catálogo de canais, gráficos, tabela, pista e exportação futura. Recursos compartilhados não devem ser implementados duas vezes.

## Compromissos

- fidelidade antes de aparência;
- interação fluida sem animação excessiva;
- cache público explícito e observável;
- uploads privados sem persistência;
- estados incompletos claramente rotulados;
- expansão futura sem sugerir cobertura atual inexistente.

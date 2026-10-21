# Medições locais — 2026-10-20

Uma execução Chromium desktop com build de produção. Estes números são evidência
local, não promessa de desempenho, FPS ou comparação com uma versão anterior.

## Telemetry Lab

Entrada controlada: **50.000 registros, 10 colunas, 500.000 células e 1.973.718
bytes**, sem redução do conjunto; quatro gráficos inicialmente visíveis.

| Medida | Resultado |
| --- | ---: |
| Seleção → inspeção | 748 ms |
| Confirmação → sessão/gráficos | 1.182 ms |
| Cursor: mediana de 10 ações | 50 ms |
| Cursor: maior duração observada | 130 ms |
| Heap JS da página antes/depois | 2,58 / 44,94 MB |
| JS transferido observado na jornada | 168.784 bytes |
| Corpo JS codificado observado | 165.784 bytes |
| JS bruto de todos os chunks do build (17 arquivos) | 1.657.171 bytes |

Cursor inclui a ida/volta da automação e dois frames. Heap não inclui o worker,
memória GPU nem um teste de vazamento; coleta de lixo e máquina alteram o valor.
Bytes observados da jornada não representam todos os módulos do aplicativo.
Artefato local ignorado: `.cache-uv-cortex/delivery-evidence/`.

Repetição: build atualizado e API/porta web conforme README. No PowerShell,
defina `$env:CI="true"` e `$env:CORTEX_PERF_SMOKE="1"`; execute
`npm run e2e -- --workers=1 performance.spec.ts`. `CI=true` usa servidor de
produção. O teste opt-in registra `measurement.json`, sem conteúdo do arquivo.

## Spa real

Sessão `2025-belgium-r-2-6`, normalizador **v6**, **20 pilotos e 879 voltas**.
Origem comprovada: **normalized-cache**. Preparação pela API: **20,70 s**.
Na jornada de navegador separada, carga até manifesto: **44,09 s**; manifesto
com **70.324 bytes**. Smoke completo: **57,0 s**, incluindo quatro larguras,
avanço entre voltas e ausência de erros de página/console.

API e navegador são execuções diferentes; não representam carga fria nem
hit/miss do cache nativo. Não houve identificação inferida de rede/cache FastF1.

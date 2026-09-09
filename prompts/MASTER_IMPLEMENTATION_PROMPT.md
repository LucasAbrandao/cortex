# Prompt mestre — reconstrução do Cortex

Você é o agente principal responsável por reconstruir o Cortex em fases verificáveis. Não tente entregar todas as fases em uma única mudança.

## Contexto obrigatório

Leia integralmente `AGENTS.md`, `README.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_CONTRACT.md`, `docs/API_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/TESTING.md` e o prompt da fase atual.

O Cortex é uma aplicação de análise de automobilismo com Race Explorer FastF1 e Telemetry Lab. O primeiro protótipo usa Spa/Belgium 2025 Race como única sessão real. O calendário 2025 completo é visível. Importação CSV/JSON é uma experiência visual baseada em fixtures; deploy, autenticação e normalização real de upload não fazem parte desta entrega.

## Regras invioláveis

- Preserve `telemetryCortex`; use-o apenas como referência.
- Antes de recriar `cortex`, valide e preserve o projeto anterior no destino aprovado.
- Não invente dados, pista, disponibilidade ou fallback.
- Ausência é `null`; gráficos não conectam lacunas.
- FastF1 fica no backend e seu cache permanece habilitado.
- Pydantic/OpenAPI é fonte de verdade; TypeScript é gerado.
- Solicite aprovação antes de dependências, commit, remote, publicação, credenciais ou ação destrutiva.
- Não avance de fase com gate falhando.

## Método por fase

1. Descubra ambiente, instruções, runtime, scripts e estado Git.
2. Escreva uma especificação curta com objetivo, requisitos e aceite da fase.
3. Apresente plano, dependências propostas, riscos e áreas afetadas.
4. Aguarde aprovações exigidas.
5. Implemente a menor fatia vertical completa.
6. Execute testes focados, gates e inspeção de diff.
7. Verifique browser quando houver interface.
8. Atualize `docs/STATUS.md` e contratos/decisões afetados.
9. Relate resultado, comandos, evidências e riscos pendentes.

## Ordem

Execute `PHASE_00_REPOSITORY.md` até `PHASE_05_QUALITY.md`, uma por vez. Pare ao fim de cada fase para revisão. Não faça deploy nem publique automaticamente.

## Resultado final esperado

Protótipo local e testado em CI com navegação completa, Spa real cacheada, jobs canceláveis, Race Explorer sincronizado, comparação piloto+volta, importação demonstrável, acessibilidade e documentação honesta.

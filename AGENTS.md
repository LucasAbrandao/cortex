# Cortex — regras permanentes

## Missão

Construir uma aplicação bilíngue de análise de automobilismo com dois módulos sobre o mesmo contrato: Race Explorer para FastF1 e Telemetry Lab para arquivos. Priorizar fidelidade, clareza e investigação volta a volta.

## Ordem de trabalho

1. Leia este arquivo, `docs/STATUS.md`, `docs/DECISIONS.md` e os requisitos da fase.
2. Descubra scripts, dependências, contratos, testes e mudanças pendentes antes de editar.
3. Apresente um plano curto quando a mudança alterar contrato, dependência, dados ou experiência.
4. Implemente uma fatia vertical pequena e funcional.
5. Execute testes focados e depois os gates aplicáveis.
6. Atualize `docs/STATUS.md`; atualize decisões e contratos quando afetados.

## Arquitetura obrigatória

- `apps/web`: Next.js, React e TypeScript.
- `services/api`: FastAPI, Python e FastF1.
- `packages/contracts`: cliente e tipos TypeScript gerados do OpenAPI/Pydantic.
- O navegador nunca importa FastF1, Pandas ou arquivos RCZ diretamente.
- Adaptadores normalizam fontes diferentes para o mesmo modelo canônico.
- Cache FastF1 permanece habilitado. Uploads privados não são persistidos.

## Integridade dos dados

- Ausência é `null`, nunca `0`, `false` ou valor interpolado.
- Não conectar lacunas, inventar pista, corrigir GPS ou ocultar canal ausente.
- Diferenciar dado original, derivado, parcial, ausente, não mapeado e não calibrado.
- Comparação por distância só é habilitada quando todas as séries selecionadas possuem distância válida.
- Fixtures são permitidas em testes e protótipos identificados; nunca como fallback silencioso de uma sessão real.

## Produto e interface

- Português é o idioma inicial; inglês deve reutilizar os mesmos componentes.
- Direção visual: escura, técnica, fluida e expressiva, sem decoração excessiva.
- Cobrir loading, progresso, sucesso, vazio, erro, indisponibilidade e cancelamento.
- Garantir HTML semântico, foco visível, teclado, contraste, toque e `prefers-reduced-motion`.
- Piloto em foco, carros visíveis e pilotos comparados são estados independentes.
- Aplicar `docs/PROJECT_STANDARDS.md` às próximas entregas; cena 3D não é exigência global.
- Estimativa visual de carros segue D-018; nunca alimenta dados, gráficos ou classificação.

## Limites de autonomia

Solicite aprovação antes de instalar dependências, trocar framework, alterar o sistema visual, criar credenciais, mover/apagar o projeto anterior, fazer commit, criar remote ou publicar. Nunca registre segredos ou conteúdo bruto de uploads.

## Gates

Use somente comandos existentes. A fundação planejada deverá fornecer lint, typecheck, testes web, build, Pytest, geração/verificação de contratos e Playwright. Testes obrigatórios de CI não dependem da rede FastF1; o smoke real é separado.

## Definition of Done

Uma fase termina quando comportamento e estados funcionam, contratos estão sincronizados, testes relevantes passam, browser foi verificado nas larguras afetadas, documentação reflete a realidade e nenhuma ausência foi mascarada.

# Fase 00 — repositório, toolchains e contratos

## Objetivo

Criar a fundação limpa e reproduzível do novo Cortex sem perder ou modificar as referências existentes.

## Antes de agir

- Resolva caminhos absolutos de `cortex`, destino `cortex-legacy-2026-08-14` e `telemetryCortex`.
- Verifique que o destino do legado não existe e que a origem esperada é exata.
- Mostre o inventário do projeto anterior e peça aprovação final antes de mover qualquer pasta.
- Detecte Node/npm, Python e disponibilidade de `uv`; não presuma versões.

## Entregas

- Preservar o Cortex anterior no destino aprovado e criar nova pasta `cortex`.
- Criar monorepo com `apps/web`, `services/api`, `packages/contracts`, `fixtures`, `docs`, `prompts` e workflows.
- Copiar este kit documental para a raiz nova.
- Configurar npm workspaces, TypeScript estrito, Next.js, FastAPI, `uv`, lint e testes mínimos após aprovação das dependências.
- Definir modelos Pydantic iniciais, OpenAPI determinístico e geração TypeScript.
- Criar fixtures mínimas válidas/ inválidas sem dados restritos.
- Criar `.gitignore`, `.env.example` seguro e GitHub Actions determinístico.
- Inicializar Git somente se autorizado; não criar remote, commit ou push sem nova autorização.

## Restrições

Não importar o frontend anterior. Não copiar cache, dados locais, `.venv`, `node_modules`, builds ou segredos. Não implementar telas além do smoke mínimo necessário.

## Aceite

Workspaces instalam, API e web iniciam, health mínimo responde, OpenAPI gera TypeScript sem diff inesperado e todos os gates iniciais passam em ambiente limpo. Atualize status e pare.

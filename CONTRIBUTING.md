# Contribuição

## Fluxo Git

- `main` deve permanecer estável.
- Cada fase ou mudança usa branch curta: `feat/...`, `fix/...`, `docs/...` ou `chore/...`.
- Commits devem ser pequenos, intencionais e escritos no imperativo.
- Pull requests descrevem objetivo, contratos alterados, testes executados, capturas das telas afetadas e riscos.
- Não misturar refatoração ampla com funcionalidade nova.

## Antes de começar

- Confirme que está no novo repositório, não em `cortex-legacy-2026-08-14` nem em `telemetryCortex`.
- Leia instruções e status.
- Inspecione mudanças locais e preserve trabalho do usuário.
- Peça aprovação antes de adicionar dependências ou mudar decisões aprovadas.

## Revisão obrigatória

- Dados ausentes e lacunas continuam honestos.
- API e tipos gerados estão sincronizados.
- Interface funciona por teclado e em movimento reduzido.
- Loading, vazio, erro e indisponibilidade foram testados.
- Logs não contêm conteúdo bruto, caminho local ou segredo.

## CI configurado

Checks obrigatórios: lint, typecheck, testes de unidade/componentes, build, Pytest, contrato gerado sem diff e Playwright com fixtures. O smoke FastF1 real é manual/agendado e não bloqueia pull requests por instabilidade externa.

Nenhum remote, commit, push, PR ou publicação deve ser criado sem autorização explícita.

# Segurança e privacidade

## Protótipo local

- Sem autenticação e sem autorização multiusuário.
- Sem deploy público nesta fase.
- Segredos somente em variáveis locais ignoradas pelo Git.
- CORS limitado à lista local `CORTEX_ALLOWED_ORIGINS`; o valor de exemplo
  contém somente `http://127.0.0.1:3000` e `http://localhost:3000`.
  Não há curingas, credenciais ou origem remota no protótipo.

## FastF1

Dados públicos podem ser cacheados. Não expor caminhos, objetos pickle ou respostas brutas. Validar ano, evento e sessão por allowlist antes de iniciar trabalho.

## Upload visual

- Processar preview no navegador e limitar bytes/linhas lidas.
- Não transmitir, persistir ou registrar conteúdo.
- Escapar valores exibidos; nunca usar HTML vindo do arquivo.
- Nome do arquivo é metadado não confiável.
- Descartar estado ao sair/iniciar nova importação.

## Logs e erros

Registrar request ID, código, estágio, duração e hit/miss. Proibir conteúdo bruto, stack trace no cliente, caminhos absolutos, tokens e variáveis de ambiente.

## Git

Ignorar `.env*` exceto exemplo seguro, caches, `.venv`, `node_modules`, builds, resultados, uploads e dados locais. Fixtures precisam ser pequenas, revisadas e livres de segredo/licença restritiva.

## Antes de publicar

Bloqueadores futuros: autenticação ou rate limit apropriado, origem permitida, limites de concorrência, cache persistente controlado, storage/expiração, headers, observabilidade, política pública e revisão de dependências. Documentação de deploy não equivale à implementação desses controles.

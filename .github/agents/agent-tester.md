# Agente Tester

Objetivo
- Garantir qualidade com foco em casos de uso criticos e regressao.
- Priorizar testes E2E com Playwright e validacoes basicas de UI.

Escopo tecnico
- Tests Playwright em tests/.
- Configuracao Playwright em playwright.config.js.
- Resultados em test-results/.

Como atuar
- Identificar os fluxos principais (home, login, music, offline, roteiro, tom).
- Criar ou ajustar testes E2E para fluxos que sofreram alteracao.
- Validar que paginas carregam sem erro e elementos-chave existem.
- Documentar passos de reproducao quando encontrar falhas.

Checklist antes de entregar
- Testes focados e rapidos (evitar suites gigantes).
- Dados de teste estaveis e deterministas.
- Cobrir pelo menos: login, navegacao principal, uma acao central por pagina.
- Reportar falhas com contexto (pagina, seletor, erro esperado/real).

Dicas para este projeto
- Use seletores estaveis (ids ou data-testid se existirem).
- Evite depender de tempo fixo; prefira waits por estado.
- Se necessario, proponha ajustes pequenos de HTML para testabilidade.

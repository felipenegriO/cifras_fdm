# Agente Dev

Objetivo
- Implementar novas features e correcoes com foco em estabilidade.
- Respeitar a arquitetura atual (PHP + MVC em src/).
- Minimizar impacto em arquivos nao relacionados.
- Responsividade no frontend, garantindo boa experiencia em desktop e mobile.

Escopo tecnico
- Backend PHP: controllers em src/Controllers, views em src/Views, services em src/Services.
- Frontend: assets em src/css, src/js, src/images e views.
- Tests: Playwright em tests/.

Como atuar
- Sempre revisar a estrutura existente antes de alterar.
- Preferir mudancas pequenas e incrementais.
- Evitar refatoracoes amplas sem pedido explicito.
- Manter estilo e padrao dos arquivos ja existentes.
- Adicionar comentarios curtos apenas quando o codigo nao for obvio.
- aplicar sempre as alterações pensando em responsividade.

Checklist antes de entregar
- Codigo compila/carrega no fluxo afetado.
- Mudancas minimas e sem regressao aparente.
- Atualizar views e controllers de forma consistente.
- Se mudou fluxo principal, avisar sobre testes recomendados.
- se bate com layout responsivo em todos os dispositivos

Notas especificas do projeto
- Se tocar em rotas ou paginas, alinhar com as views em src/Views.
- Se tocar em autenticacao, revisar AuthController/AuthService.
- Evitar incluir dependencias novas sem necessidade.

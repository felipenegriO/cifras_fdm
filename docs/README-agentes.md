# Guia para agentes de IA

O ponto de entrada da documentação é [README.md](README.md). Antes de alterar código:

1. Localize a funcionalidade no [catálogo](funcionalidades.md).
2. Leia os contratos relacionados em [API](api.md), [dados](modelo-de-dados.md) e [segurança](seguranca-e-permissoes.md).
3. Consulte a cobertura atual em [testes](testes.md) e [rastreabilidade](rastreabilidade.md).
4. Preserve isolamento por `banda_id`, autenticação, perfil mínimo e CSRF.
5. Atualize documentação e testes na mesma mudança quando o comportamento mudar.

Não assuma que nomes legados representam o produto. `stagebox` ainda existe no nome técnico do IndexedDB e em domínios históricos. O nome exibido ao usuário é **Cifrô**.

## Formato obrigatório para novas funcionalidades

Cada funcionalidade deve ter:

- ID estável `F-XXX` no catálogo;
- atores e pré-condições;
- fluxo principal e erros;
- dados lidos e gravados;
- endpoints e arquivos de implementação;
- regras de autenticação, permissão e CSRF;
- testes associados;
- impactos offline, multi-banda e plano.

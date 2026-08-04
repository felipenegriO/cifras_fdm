# Guia de evolução

## Fluxo para mudanças

1. Identifique os IDs `F-XXX` afetados.
2. Escreva critérios observáveis: entrada, estado inicial, resultado, erros e permissões.
3. Mapeie impactos em sessão, banda, plano, offline, API e banco.
4. Altere o menor conjunto coerente de controller, service, repository, view e JavaScript.
5. Adicione testes proporcionais ao risco.
6. Atualize catálogo, domínio, API e rastreabilidade.

## Checklist funcional

- O fluxo funciona para o papel mínimo e falha para o papel inferior.
- Leituras e escritas respeitam a banda atual.
- POST autenticado valida CSRF.
- Payload inválido gera resposta previsível sem warning PHP.
- Limites de plano são aplicados apenas na criação, não na atualização existente.
- Conteúdo de usuário é escapado no HTML.
- Mudanças de schema possuem migração e leitura compatível.
- O comportamento offline está definido.
- A versão do cache PWA muda quando assets cacheados mudam.

## Checklist de IA

- Não inferir regras comerciais pelos nomes `basico`, `banda` ou `ativo` sem validar o código.
- Não renomear identificadores legados persistentes sem estratégia de migração.
- Não confiar apenas na visibilidade do menu; autorização deve estar no backend.
- Não criar endpoint novo se um contrato existente puder ser estendido com compatibilidade.
- Não declarar cobertura completa quando a matriz registrar lacuna.

## Template de especificação

```markdown
# F-XXX Nome

Estado: Proposto | Implementado | Legado
Atores: ...
Pré-condições: ...

## Fluxo principal
1. ...

## Regras
- R-XXX ...

## Contratos
- API, campos, códigos e efeitos colaterais.

## Dados e segurança
- Tabelas, banda, sessão, perfil e CSRF.

## Testes
- Arquivos e cenários.
```

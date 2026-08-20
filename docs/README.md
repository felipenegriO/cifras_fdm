# Documentação do Cifrô

Esta pasta é a fonte de contexto funcional e técnico para pessoas e agentes de IA. Ela descreve o comportamento observado no código em 2026-07-14. Em divergências, o código executável é a fonte atual e a documentação deve ser corrigida na mesma mudança.

## Ordem de leitura

1. [Visão do produto](visao-do-produto.md)
2. [Catálogo de funcionalidades](funcionalidades.md)
3. [Arquitetura](arquitetura.md)
4. [Modelo de dados](modelo-de-dados.md)
5. [Segurança e permissões](seguranca-e-permissoes.md)
6. [Referência de API](api.md)
7. [Testes](testes.md)
8. [Cobertura medida](cobertura.md)
9. [Matriz de rastreabilidade](rastreabilidade.md)
10. [Guia de evolução](guia-de-evolucao.md)
11. [Plano para atingir 80% de cobertura de branches](plano-cobertura-branches-80.md)
12. [Plano de confiabilidade para palco, offline e sincronização](plano-confiabilidade-palco-offline.md)
13. [Plano mestre de implementação](plano-mestre-implementacao.md)

## Documentação por domínio

- [Acesso e onboarding](dominios/acesso-e-onboarding.md)
- [Bandas e usuários](dominios/bandas-e-usuarios.md)
- [Músicas e cifras](dominios/musicas-e-cifras.md)
- [Setlists e roteiros](dominios/setlists-e-roteiros.md)
- [Modo Live](dominios/modo-live.md)
- [Modo Ensaio](dominios/modo-ensaio.md)
- [Offline, PWA e sincronização](dominios/offline-pwa-sync.md)
- [Planos e cobrança](dominios/planos-e-cobranca.md)
- [Ajuda e suporte](dominios/ajuda-e-suporte.md)

## Convenções

- `F-XXX`: funcionalidade.
- `R-XXX`: regra de negócio.
- `API-XXX`: contrato HTTP.
- `T-XXX`: grupo de testes.
- **Implementado**: comportamento encontrado no código.
- **Legado**: mantido por compatibilidade.
- **Lacuna**: comportamento sem cobertura ou contrato consistente.

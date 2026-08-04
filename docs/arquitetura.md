# Arquitetura

## Visão geral

```text
Browser
  -> páginas PHP em public/
  -> controllers em public/src/Controllers/
  -> views PHP + JavaScript vanilla
  -> endpoints JSON em public/api/ e public/src/backend/
  -> services e repositories
  -> MySQL via PDO
```

## Camadas

| Camada | Responsabilidade | Local |
|---|---|---|
| Entradas HTTP | Rotas por arquivo e composição inicial | `public/*.php` |
| Controllers | Autorização de página e renderização | `public/src/Controllers` |
| Views | HTML e parte da interação cliente | `public/src/Views` |
| APIs | Contratos JSON atuais | `public/api` |
| Backend legado | APIs JSON e páginas auxiliares | `public/src/backend` |
| Services | Sessão, autenticação, live, e-mail e banco | `public/src/Services` |
| Repositories | Persistência e isolamento de banda | `public/src/Repositories` |
| PWA | Cache do shell e fallback offline | `public/service-worker.js` |
| Cache de dados | IndexedDB por banda | `public/src/js/cifro-sync.js` |

## Bootstrap

`public/src/backend/bootstrap.php` é carregado por páginas e APIs. Ele inicializa ambiente, autoload, headers, cookie de sessão, timeout de 8 horas, CSRF, autorização, verificação de plano, papéis, limites e renderização de views.

## Estado

- Servidor: sessão PHP com `autenticado`, `usuario`, `banda_atual` e `csrf_token`.
- Banco: fonte persistente de usuários, bandas, conteúdos, estado Live e tokens.
- Browser: IndexedDB para conteúdo offline; `localStorage` para ID do host e preferências de ensaio; `sessionStorage` para modo Live da aba.
- Cache API: assets versionados, páginas autenticadas por usuário e metadata em caches separados.

## Compatibilidade legada

- A suíte Playwright principal usa o projeto e a pasta `cifro`.
- IndexedDB usa `cifro`, versão 4, com chaves `user_id:banda_id`. Não há migração de `stagebox` porque a aplicação ainda não foi lançada.
- `livePlayerLer.php` e `livePlayerSalvar.php` coexistem com `/api/live/*`.
- `require_admin()` usa mapeamento legado que trata gestor como administrador de conteúdo.

# Minha Banda — administração da banda num lugar só

## Objetivo

Reunir numa tela a administração da banda que hoje está espalhada por quatro endereços: dados da banda, plano, membros, categorias e repertórios. O músico que entra numa banda passa a ter um lugar para administrá-la, em vez de caçar itens diferentes no menu.

O menu encolhe de 8 para 7 itens e fica mais legível:

| Antes | Depois |
|---|---|
| Início, Categorias, Músicas, Repertórios, Usuários, Bandas, Ajuda, Config | Início, Músicas, Repertórios, **Minha Banda**, Bandas, Ajuda, Config |

Saem apenas **Categorias** e **Usuários**, que viram abas. **Início** permanece em primeiro.

## Diagnóstico do estado atual

| Tela | Arquivo | Tamanho | Permissão |
|---|---|---|---|
| Plano | `Views/plano.php` | 816 linhas | administrador |
| Dados da banda | `Views/bandas/editorbandas.php` | 385 linhas | master (`bandas.php`) |
| Membros | `Views/users/editoruser.php` | — | `require_band_role('administrador')` |
| Categorias | `Views/categorias.php` | 47 linhas | `can_edit_content()` (gestor) |
| Repertórios | editor de playlists | — | `can_edit_content()` (gestor) |

As páginas de entrada já são finas (`users.php` tem 4 linhas: bootstrap → controller → view), então consolidar não exige reescrever a camada de entrada.

O projeto já tem um padrão de abas acessível em `music.php` (`role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`). A tela nova segue esse padrão em vez de inventar outro.

## Decisões tomadas

1. **Página única com abas**, não hub de cartões nem página longa empilhada.
2. **Gestor vê a tela**, com apenas as abas que pode usar. Restringir a administrador seria regressão: hoje o gestor administra categorias.
3. **Os endereços antigos redirecionam** para a aba correspondente, preservando query string.
4. **Repertórios é a mesma tela** do menu, com dois pontos de entrada — um código só.
5. **Recortar sem redesenhar.** Melhorias visuais nas abas ficam para depois; misturar recorte e redesenho impede saber o que causou uma regressão.

## Arquitetura

### Entrada

`public/minha-banda.php` — fino, no padrão das demais:

```php
<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
$controller = new BandaAdminController();
$controller->show();
```

`BandaAdminController::show()` chama `require_auth()`, resolve a aba pedida, valida que o usuário pode vê-la e renderiza.

### Abas como parciais

```
public/src/Views/banda/
  minha-banda.php      casca: cabeçalho, navegação de abas, inclui o parcial ativo
  aba-dados.php        nome e logo da banda
  aba-plano.php        plano e cobrança
  aba-membros.php      usuários vinculados
  aba-categorias.php   categorias da banda
  aba-repertorios.php  repertórios
```

Cada parcial recebe a marcação da tela de origem **sem reescrita**. O ganho colateral é quebrar `plano.php` — 816 linhas, grande demais para ser compreendido de uma vez — em pedaços com propósito único.

### `BandaAdminTabs` — regra pura

Serviço sem HTTP e sem banco, no mesmo espírito de `BandaAcessoPolicy`: recebe as capacidades e devolve as abas visíveis. A casca desenha só o que ele retorna, e a regra fica testável sem browser.

```php
BandaAdminTabs::visiveis(bool $podeAdministrar, bool $podeGerenciarMembros, bool $podeEditarConteudo): array
BandaAdminTabs::existe(string $aba): bool
BandaAdminTabs::rotulo(string $aba): string
```

| Aba | Chave | Exige |
|---|---|---|
| Dados | `dados` | administrador |
| Plano | `plano` | administrador |
| Membros | `membros` | `can_manage_band_users()` |
| Categorias | `categorias` | `can_edit_content()` |
| Repertórios | `repertorios` | `can_edit_content()` |

Esconder a aba **não é autorização**: cada endpoint continua barrando por conta própria, conforme a convenção já registrada nas Convenções deste backlog.

Sem nenhuma aba visível (perfil básico ou externo), o controller responde como as demais telas negam acesso hoje, em vez de mostrar uma tela vazia.

## A aba é um endereço

`?aba=<chave>`, com `dados` como padrão. Não é detalhe de conforto — é requisito:

- o Stripe retorna do pagamento para um endereço fixo e precisa cair na aba de plano;
- os redirecionamentos dos endereços antigos precisam de um destino;
- o botão "voltar" do navegador passa a funcionar entre abas.

Aba desconhecida ou sem permissão cai na primeira aba visível ao usuário, sem erro.

## Redirecionamentos

```
/users.php       → /minha-banda.php?aba=membros
/categorias.php  → /minha-banda.php?aba=categorias
/plano.php       → /minha-banda.php?aba=plano
```

**O Stripe passa a apontar direto para o endereço novo**, em vez de depender do redirecionamento:

```php
// public/api/stripe/create-checkout-session.php
$successUrl = $appUrl . '/minha-banda.php?aba=plano&checkout=success&session_id={CHECKOUT_SESSION_ID}';
$cancelUrl  = $appUrl . '/minha-banda.php?aba=plano&checkout=cancel';
```

Isso é possível porque a URL de retorno é montada em código a cada pagamento — **não existem Payment Links estáticos** (verificado: nenhum `STRIPE_LINK` no código nem no `.env`), cuja URL ficaria no painel do Stripe e exigiria alteração manual.

O ganho é remover um acoplamento: o pagamento deixa de depender de uma tela que vai parar de existir. O redirecionamento do `plano.php` passa a servir apenas favoritos e e-mails antigos — repassar a query vira precaução, não requisito.

**A aba de plano continua sendo o destino após pagar**, e não uma tela neutra: quem acabou de pagar quer confirmação de que funcionou. Como a ativação real chega pelo webhook segundos depois, é ali que a informação correta aparece.

Continuam apontando para os endereços antigos e seguem funcionando: e-mails de cobrança já enviados, `definir-senha.php`, `plano-expirado.php` e as listas do `bootstrap`.

## A trava que não pode passar

`plano.php` está hoje em **três listas** do `bootstrap` que permitem páginas sem banda válida:

- `cifro_exigir_banda_selecionada()`;
- `cifro_encerrar_acesso_a_banda()`;
- `cifro_check_plano()`, que manda planos bloqueados para `plano-expirado.php`.

`minha-banda.php` **precisa entrar nas três**. Sem isso, uma banda com plano `bloqueado` é redirecionada para `plano-expirado.php` e **nunca alcança a aba para pagar** — o cliente fica trancado do lado de fora do próprio pagamento, que é o pior desfecho possível desta mudança.

### O que o teste encontrou além disso

Entrar nas três listas não bastava: o e2e da banda bloqueada reprovou mesmo com
`minha-banda.php` liberado. A causa é anterior e não era da tela nova — a
revalidação por requisição (`cifro_revalidar_acesso`, do login persistente)
tratava plano bloqueado como **perda de acesso** e desselecionava a banda. Com
`banda_atual` vazio, `cifro_check_plano()` não via banda nenhuma e a aba de
plano ficava sem o que cobrar.

Três correções, todas na mesma ideia — **plano bloqueado é cobrança, não perda
de acesso**:

1. `cifro_revalidar_acesso()` não desseleciona mais a banda por plano bloqueado;
   quem barra o palco continua sendo `cifro_check_plano()`.
2. `cifro_check_plano()` também libera `select-banda.php` e `logout.php`: quem
   tem outra banda não pode ficar preso na que deve, e sair da conta nunca pode
   ser um beco sem saída.
3. `BandaAcessoPolicy::impedeAbrir()` — no seletor, banda com plano vencido
   continua clicável (removida/desativada, não). Antes virava card morto, e um
   administrador com duas bandas não tinha caminho até o próprio pagamento.

## Service worker

`users.php`, `categorias.php` e `plano.php` não estão entre as páginas de palco cacheadas (`index`, `music`, `roteiro`, `select-banda`, `ajuda`), então não há cache a invalidar. `minha-banda.php` também **não** entra nessa lista: administrar banda exige servidor.

## Testes

### Unitários (`tests/php/BandaAdminTabsTest.php`)

- administrador enxerga as cinco abas;
- gestor enxerga apenas categorias e repertórios;
- básico e externo não enxergam nenhuma;
- aba inexistente é rejeitada;
- todo rótulo é não vazio.

### E2E (`tests/cifro/73-minha-banda.spec.js`)

- cada perfil vê exatamente as abas que pode;
- `?aba=X` abre a aba correta; aba sem permissão cai na primeira permitida;
- os três endereços antigos redirecionam preservando a query;
- o retorno do Stripe (`?checkout=success`) cai na aba de plano e exibe o aviso de pagamento recebido;
- **banda com plano bloqueado alcança a aba de plano** — guarda contra a trava descrita acima;
- o menu não mostra mais Categorias nem Usuários, mostra Minha Banda, e mantém Início.

### Regressão obrigatória

O recorte só avança de aba em aba com a suíte correspondente verde. O que estava passando antes precisa passar depois; diferença é regressão, não melhoria.

| Aba | Suítes |
|---|---|
| Plano | `20-planos`, `57-cancelamento-assinatura` |
| Membros | `06-usuarios`, `23-perfis-permissoes` |
| Categorias | `25-categorias`, `16-config-api` |
| Dados | `07-bandas` |
| Repertórios | `22-multiband-flow`, `62-playlist-persistence` (projeto `pwa`) |
| Menu | `11-topnav` |

## Rollback

As páginas antigas viram redirecionamentos de uma linha. Voltar atrás é reverter esses redirects e o item de menu; os parciais permanecem no lugar sem afetar ninguém.

## Fora do escopo

- redesenhar as telas enquanto são movidas;
- alterar regras de permissão existentes;
- levar `minha-banda.php` para o pacote offline;
- unificar os contratos de API das telas movidas.

## Consequência aceita

Quem tiver `/users.php` ou `/categorias.php` nos favoritos chega à aba correta, mas o endereço muda na barra. É o comportamento esperado de uma consolidação.

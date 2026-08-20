# Login persistente no PWA (token "lembrar-me") — Design

## Objetivo
Fazer o músico continuar logado indefinidamente no PWA — até clicar em "Sair" — sem abrir mão de poder cortar o acesso de um aparelho perdido. Hoje o cookie de sessão morre ao fechar o navegador, e quem reabre o app na semana seguinte cai num estado ambíguo: a tela mostra as cifras cacheadas, mas nada que fale com o servidor funciona.

## Diagnóstico do estado atual

**O acesso offline não depende do cookie e continua funcionando.** O service worker só guarda páginas aprovadas por `validStagePage()` (`service-worker.js:45`) — HTML que contém `window.CIFRO_USER_ID` e não contém `id="loginForm"`. A identidade fica num registro no Cache Storage (`setContext`) e os dados no IndexedDB. O teste `tests/cifro/66-offline-persistent-login.spec.js` prova isso literalmente: apaga todos os cookies, corta a rede, e o app segue abrindo com as músicas.

**O problema é a volta para online.** Em `stagePage()` (`service-worker.js:325`):

```js
if (await validStagePage(response)) await cache.put(...)
else if (await getContext()) return cached;   // servidor deslogado, mas há contexto → serve o cache
```

Com `session.cookie_lifetime = 0`, o cookie morre ao fechar o navegador. Ao reabrir com internet, o servidor responde a landing (não autenticado), o SW vê contexto offline e serve a página cacheada. O usuário **parece** logado, mas toda chamada a `/api/` e `/src/backend/` é explicitamente excluída do service worker (`service-worker.js:286`), vai ao servidor e volta 401/302. Sincronizar, salvar cifra e modo ao vivo falham em silêncio, e nada força um novo login.

**Não existe hoje nenhum mecanismo de persistência.** `AuthController::finalizeLogin` (`AuthController.php:111`) apenas popula `$_SESSION`; o único cookie é o `PHPSESSID`. Não há tabela de tokens de autenticação (só `password_reset_tokens`).

**Três relógios independentes, hoje desalinhados:**

| Relógio | Valor | Efeito |
|---|---|---|
| `session.cookie_lifetime` | `0` | Cookie morre ao fechar o navegador |
| `session.gc_maxlifetime` | `28800` (corrigido de `1440`) | Quando o arquivo de sessão vira elegível para coleta |
| `SESSION_IDLE_SECONDS` (`bootstrap.php:200`) | 8h | Checagem explícita de inatividade do app |

## Decisões tomadas

1. **Duração:** indefinida até logout explícito. O token é renovado a cada uso.
2. **Revogação:** botão "sair de todos os aparelhos" (revoga tudo de uma vez). Sem tela de gestão de dispositivos individuais — fora de escopo.
3. **Login inválido com cache presente:** manter as cifras em leitura + banner visível pedindo login. Nunca jogar o músico para a tela de login no meio de um culto, e nunca apagar o pacote offline.

## Abordagem escolhida

Token "lembrar-me" **separado da sessão**, no padrão selector+validator. Alternativas descartadas:

- **Só esticar `cookie_lifetime`/`gc_maxlifetime` para 1 ano:** trivial, mas não permite revogação (não há como saber quais arquivos de sessão são de qual usuário), acumula arquivos de sessão indefinidamente em `C:\xampp\tmp`, e mantém dados de sessão sensíveis em disco por um ano.
- **Handler de sessão customizado no MySQL:** resolveria revogação e o `/tmp` compartilhado, mas reescreve o armazenamento de sessão do app inteiro e transforma toda requisição em I/O de banco — risco desproporcional ao ganho.

A sessão PHP continua curta e descartável; o token só entra em cena quando a sessão não existe.

## Modelo de dados

Segue o padrão de `password_reset_tokens` em `scripts/setup/setup_db.php`:

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  seletor        CHAR(32)  NOT NULL,
  validador_hash CHAR(64)  NOT NULL,
  usuario_id     CHAR(36)  NOT NULL,
  criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usado_em       TIMESTAMP NULL,
  PRIMARY KEY (seletor),
  KEY idx_usuario (usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

O **seletor** identifica a linha e viaja em claro no cookie. O **validador** viaja no cookie mas só o seu SHA-256 é gravado — um vazamento do banco não vira acesso. A comparação usa `hash_equals` para não vazar tempo.

**Cookie** `cifro_lembrar` = `seletor:validador`, independente do `PHPSESSID`:
`httponly`, `samesite=Lax`, `secure` quando HTTPS, validade 1 ano renovada a cada uso.

## Componentes

### `AuthTokenRepository` (novo)
Isola todo o SQL da tabela. Interface: `emitir(usuarioId)` → par para o cookie; `encontrarPorSeletor(seletor)`; `rotacionar(seletor)` → novo validador; `revogar(seletor)`; `revogarTodosDoUsuario(usuarioId)`.

### `AuthTokenService` (novo)
Contém a decisão, sem tocar em HTTP nem em `$_SESSION`. Recebe o valor do cookie e devolve um resultado explícito: `valido(usuarioId)`, `invalido`, ou `reuso_detectado(usuarioId)`. Ser puro assim é o que permite os testes unitários em PHP sem browser.

### Integração (4 pontos)

| Onde | O que muda |
|---|---|
| `AuthController::finalizeLogin` | emite o token e grava o cookie |
| `bootstrap.php`, antes de `require_auth` | sem sessão + cookie válido → recria a sessão e rotaciona o validador |
| `logout.php` | revoga a linha daquele aparelho e apaga o cookie |
| `/api/account/logout-all.php` (novo) + botão em `config.php` | `revogarTodosDoUsuario` |

A recriação da sessão acontece no `bootstrap`, **antes** de qualquer `require_auth`. A página já sai do servidor autenticada, `validStagePage` aprova, e o cache offline segue sendo alimentado — sem alterar o service worker.

Troca de senha (`PasswordResetFlow`, `UserRepository`) também chama `revogarTodosDoUsuario`.

### Detecção de roubo
O validador é rotacionado a cada uso. Se um cookie clonado for usado depois do original, o validador antigo não bate mais: isso é `reuso_detectado` → revoga **todos** os tokens do usuário e exige senha.

## Comportamento no cliente

### `/api/auth/status.php` (novo)
Devolve `{ok:true, autenticado:bool}` e **nunca redireciona**. Fica sob `/api/`, que o service worker já ignora, então sempre reflete o servidor real. Consultado em dois momentos, sem polling: quando a página veio do cache, e no evento `cifro:connectivity` ao reconectar.

### Banner de sessão expirada
Segue o padrão já existente de `checkOfflinePlanBanner` (`cifro-sync.js:717`): banner fixo no topo, criado uma única vez (guardado por `id`), clicável levando ao login. Texto: *"Sessão expirada — suas cifras continuam disponíveis. Toque para entrar."*

Reaproveitar esse padrão evita introduzir um segundo mecanismo de banner na base.

### Bloqueio de escrita
`cifroSync.sync()` desiste cedo quando o estado conhecido é "não autenticado", em vez de disparar requisições que voltam 401 — hoje isso polui o console. Leitura do cache segue normal.

## Tratamento de erros

- **Cookie malformado** (sem `:`, tamanho errado): tratado como ausente, sem erro ao usuário.
- **Seletor inexistente**: tratado como inválido; não revela se o seletor existia.
- **Banco indisponível na revalidação**: não recria a sessão e não apaga o cookie — o usuário cai no fluxo normal de não autenticado e o token volta a funcionar quando o banco voltar.
- **`headers_sent`**: a emissão do cookie é ignorada silenciosamente, como já faz o código de sessão existente.

## Decisão sobre `SESSION_IDLE_SECONDS`

**Manter os 8h como estão.** Quando a sessão expira por inatividade, o token a recria na requisição seguinte, sem o usuário perceber. A sessão em disco continua curta (bom para segurança) e a continuidade fica a cargo do token, que é revogável. Alterar os dois seria redundante.

## Testes

Nomes em português de negócio, seguindo o padrão da suíte.

**PHP unitário** (`tests/php/`) — a lógica de token, sem browser:
- token válido recria a sessão; validador errado não recria
- o validador é rotacionado a cada uso (o anterior para de funcionar)
- reuso de validador antigo revoga todos os tokens do usuário
- "sair de todos os aparelhos" e troca de senha invalidam tudo
- cookie malformado é tratado como ausente

**E2E** (`tests/cifro/`):
- *"fecha o navegador e volta uma semana depois: entra direto, sem digitar senha"* — apaga só o cookie de sessão (preservando `cifro_lembrar`), recarrega, espera o app autenticado
- *"acesso revogado em outro aparelho mantém as cifras e pede login"* — revoga no banco, reconecta, espera o banner e as cifras ainda na tela
- *"sair de verdade não deixa rastro"* — após logout, apagar o cookie de sessão não ressuscita o login

## Fora de escopo

- Tela de gestão de dispositivos com revogação individual (exigiria guardar user-agent/IP).
- Alterar `session.save_path` para um diretório próprio do app. É uma melhoria real para hospedagem compartilhada (o GC de um vizinho pode apagar sessões alheias), mas independente deste trabalho.
- Investigar o loop de recálculo de `renderColumnsFromRaw` em `music.php`.

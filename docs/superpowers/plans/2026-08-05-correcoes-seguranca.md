# Plano de Correção de Segurança — Auditoria 2026-08-05

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Cada passo usa checkbox (`- [ ]`).
> **Regra inegociável deste plano:** todo passo de correção é precedido por um teste que **falha** antes da correção e **passa** depois. Nenhum item é marcado como concluído sem a saída do teste colada na evidência.

**Objetivo:** eliminar as vulnerabilidades confirmadas e os riscos prováveis levantados na auditoria de código de 2026-08-05, sem regredir comportamento existente, e reauditar o repositório com a mesma mecânica ao final para provar que foram sanadas.

**Escopo — o que entra:**

| ID | Achado | Severidade | Fase |
|---|---|---|---|
| V2 | Login com Google não verifica `usuarios.ativo` | Alto | 1 |
| V3 | Leitura de conteúdo da banda sobrevive à remoção do membro | Alto | 1 |
| V5 | Admin de banda altera conta global (inclusive senha) de usuário compartilhado | Alto | 2 |
| V4 | XSS armazenado em roteiros (`javascript:` case-sensitive, sem sanitização no servidor) | Alto | 3 |
| V6 | `livePlayerLer.php` / `livePlayerSalvar.php` compartilham sala `default` entre todas as bandas | Médio | 4 |
| R3 | `public/create_tables.sql` servido pela raiz web | Baixo | 4 |
| R4 | `public/tom.php` sem autenticação | Baixo | 4 |
| R6 | `logout.php` aceita GET sem CSRF | Baixo | 4 |
| R1 | Service worker / IndexedDB não são limpos no logout | Baixo | 5 |
| R2 | `google-auth-debug.log` gravado por requisição não autenticada, sem limite | Baixo | 5 |

**Escopo — o que sai:**

- **V1 (`public/api/waitlist.php` grava PII em `public/storage/`)** — dispensado por decisão do responsável: a lista de espera será removida quando a aplicação subir para produção. Registrado aqui apenas para rastreabilidade. **A Fase 6 vai reverificar se o endpoint ainda existe**; se continuar no repositório no momento da reauditoria, o achado volta a valer.
- Scripts em `scripts/**` — fora da raiz web, não expostos por HTTP.

**Stack de verificação (já existente no projeto):**

- PHPUnit 9 — `npm run test:unit:php` (`phpunit.xml` força `APP_ENV=test`, banco real via `E2E_DB_NAME`)
- Testes de nível de endpoint com sessão real: padrão de `tests/php/PlanLimitEnforcementTest.php` (`$GLOBALS['__cifro_test_terminate'] = true` + `CifroTestTerminate`)
- Testes JS — `node --test`, registrados em `package.json` → `test:unit:js`
- E2E — `npx playwright test --project=cifro`
- Cobertura — `npm run test:coverage:php` (limiar 80)

---

## Restrições globais

- Nenhuma dependência nova (Composer ou npm).
- Sem alteração no schema de `create_tables.sql`, exceto se um passo declarar explicitamente.
- Respostas de erro mantêm o formato duplo já usado no projeto (`ok`/`sucesso`, `error`/`mensagem`) — o front depende de ambos.
- Nenhuma correção pode quebrar `tests/php/TenantIsolationTest.php`, `PlanLimitEnforcementTest.php` nem a suíte E2E `--project=cifro`.
- Commits ficam a cargo do responsável pelo repositório — este plano não executa `git commit`.

---

## Fase 0 — Linha de base

- [ ] **0.1 Registrar o estado atual da suíte**

```bash
npm run test:unit:php
```

```bash
npx playwright test --project=cifro
```

Guardar a saída em `docs/evidencias-auditoria/baseline-2026-08-05.txt` (diretório já ignorado pelo git). Qualquer teste que **já** falhe antes das correções precisa ser anotado, para não ser confundido com regressão depois.

- [ ] **0.2 Criar a branch de trabalho**

```bash
git checkout -b seguranca/auditoria-2026-08-05
```

---

## Fase 1 — Autenticação e autorização de acesso (V2, V3)

Esta fase fecha os dois caminhos pelos quais um usuário que **já deveria ter perdido o acesso** continua entrando ou lendo dados.

### Task 1.1 — V2: login com Google deve rejeitar conta inativa

**Arquivos:**
- Modificar: `public/src/Services/GoogleAuthService.php`
- Modificar: `tests/php/GoogleAuthServiceTest.php`

**Causa raiz:** `public/api/auth/google/callback.php` chama `resolveOrCreateUser()` → `finalizeLogin()` sem passar por `AuthService::authenticate()`, que é onde vive a checagem `if (!$ativo) return ['error' => 'Usuário inativo.']` (`AuthService.php:21-26`). `GoogleAuthService` nunca lê `ativo`.

**Decisão de design:** a checagem entra em `resolveOrCreateUser()`, não no callback. Motivo: é lá que estão os dois caminhos de retorno de usuário existente (`findByGoogleSub` e `findByEmail`), e é código puro já coberto por teste unitário. O callback já trata `\Throwable` com `googleLoginFailed()`, então lançar `RuntimeException` produz o redirect correto para `/login.php?erro=google` sem mudança no callback.

- [ ] **Passo 1: teste que falha**

Adicionar a `tests/php/GoogleAuthServiceTest.php`:

```php
public function testUsuarioInativoEncontradoPorGoogleSubNaoFazLogin(): void
{
    // arrange: repositório fake devolvendo usuário com ativo = 0
    // act + assert:
    $this->expectException(RuntimeException::class);
    $this->expectExceptionMessage('Conta desativada.');
    $service->resolveOrCreateUser($payloadGoogleValido);
}

public function testUsuarioInativoEncontradoPorEmailNaoFazLoginENaoVinculaGoogleSub(): void
{
    // além da exceção, assertar que linkGoogleSub() NÃO foi chamado —
    // não se deve vincular uma identidade Google a uma conta desativada.
}

public function testUsuarioAtivoContinuaFazendoLoginNormalmente(): void
{
    // regressão: o caminho feliz não muda
}
```

Rodar e confirmar que os dois primeiros falham:

```bash
C:/xampp/php/php.exe vendor/bin/phpunit --filter GoogleAuthServiceTest
```

- [ ] **Passo 2: correção**

Em `GoogleAuthService::resolveOrCreateUser()`, antes de cada `return` de usuário existente:

```php
$byGoogleSub = $this->users->findByGoogleSub($sub);
if ($byGoogleSub) {
    $this->assertContaAtiva($byGoogleSub);
    return $byGoogleSub;
}

$byEmail = $this->users->findByEmail($email);
if ($byEmail) {
    $this->assertContaAtiva($byEmail);   // antes de linkGoogleSub
    $this->users->linkGoogleSub($byEmail['id'], $sub);
    return $byEmail;
}
```

```php
/** Espelha a regra de AuthService::authenticate() — conta desativada não entra por nenhum caminho. */
private function assertContaAtiva(array $user): void
{
    if (!(bool)($user['ativo'] ?? false)) {
        throw new \RuntimeException('Conta desativada.');
    }
}
```

- [ ] **Passo 3: verificar**

```bash
C:/xampp/php/php.exe vendor/bin/phpunit --filter "GoogleAuthService|GoogleLoginIntegration"
```

Todos verdes, incluindo `GoogleLoginIntegrationTest` sem alteração.

---

### Task 1.2 — V3: revalidar a associação usuário↔banda em toda leitura

**Arquivos:**
- Modificar: `public/src/backend/bootstrap.php`
- Modificar: `public/api/sync/data.php`, `public/api/sync/version.php`, `public/api/stripe/create-checkout-session.php`
- Criar: `tests/php/BandMembershipRevalidationTest.php`

**Causa raiz:** existem dois portões com garantias diferentes. `require_auth()` / `require_auth_json()` (`bootstrap.php:160` e `:218`) confiam em `$_SESSION['banda_atual']['id']`; `require_current_band_json()` (`bootstrap.php:280`) consulta `usuario_banda`. Os endpoints de escrita usam o segundo; os de leitura usam o primeiro. Remover alguém da banda apaga só a linha de `usuario_banda` (`UserRepository::removeFromBanda`), sem tocar na sessão dele.

**Decisão de design:** **não** replicar `require_current_band_json()` nos três endpoints — isso corrigiria as três ocorrências e deixaria a próxima rota nova com o mesmo defeito. Em vez disso, centralizar: extrair a consulta de associação para um helper e chamá-lo de dentro de `require_auth()` e `require_auth_json()` sempre que houver banda selecionada. Assim toda rota autenticada, presente e futura, herda a revalidação.

**Custo:** uma consulta indexada extra por requisição autenticada. A tabela `usuario_banda` tem PK composta `(usuario_id, banda_id)`, então é lookup por chave primária. `sync/data.php` já faz 5 consultas; o acréscimo é marginal.

- [ ] **Passo 1: teste que falha**

Criar `tests/php/BandMembershipRevalidationTest.php`, no padrão de `PlanLimitEnforcementTest` (banco real, sessão real, `CifroTestTerminate`):

```php
public function testSessaoComBandaDaQualUsuarioFoiRemovidoPerdeAcessoNaLeitura(): void
{
    // 1. cria banda + usuário + vínculo; monta $_SESSION['banda_atual']
    // 2. assert: require_auth_json() passa (usuário é membro)
    // 3. DELETE FROM usuario_banda  (simula UserRepository::removeFromBanda)
    // 4. assert: require_auth_json() agora aborta com 403 e limpa banda_atual
}

public function testMasterContinuaAcessandoQualquerBandaExistente(): void
{
    // regressão do ramo is_master() de require_current_band_json()
}

public function testSessaoSemBandaSelecionadaNaoEBloqueada(): void
{
    // select-banda.php e o primeiro login dependem disso
}

public function testMembroLegitimoNaoEAfetado(): void
{
    // regressão do caminho feliz
}
```

- [ ] **Passo 2: correção — helper central no bootstrap**

Extrair de `require_current_band_json()` a parte que consulta a associação (preservando o seam de teste `$GLOBALS['__cifro_band_membership_resolver']` usado quando `APP_ENV=test`):

```php
/**
 * Consulta a associação real usuário↔banda. Retorna o perfil na banda,
 * 'administrador' para master, ou null se não houver vínculo.
 * Fonte única de verdade — require_auth(), require_auth_json() e
 * require_current_band_json() passam todos por aqui.
 */
function cifro_band_membership(string $bandId): ?string { /* corpo movido de require_current_band_json */ }
```

Em `require_auth_json()`, após a checagem de sessão expirada e **antes** de `require_closed_beta_json()`:

```php
$bandId = current_band_id();
if ($bandId !== '') {
    $perfil = cifro_band_membership($bandId);
    if ($perfil === null) {
        unset($_SESSION['banda_atual']);   // força nova seleção
        http_response_code(403);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Acesso à banda revogado.', 'mensagem' => 'Acesso à banda revogado.']);
        cifro_terminate();
    }
    if (!is_master()) $_SESSION['banda_atual']['perfil'] = $perfil;
}
```

Em `require_auth()`, equivalente, mas redirecionando para `/select-banda.php` em vez de responder JSON.

Reescrever `require_current_band_json()` para delegar a `cifro_band_membership()` — mantendo o 404 atual, que a suíte E2E já espera.

**Atenção:** `bandas/selecionar.php` é chamado justamente para trocar de banda e já tem sua própria verificação (`selecionar.php:40-51`). `require_closed_beta_json()` já o isenta pelo `SCRIPT_NAME`. O novo bloco precisa da mesma isenção, senão a troca de banda quebra quando a sessão aponta para uma banda revogada.

- [ ] **Passo 3: verificar**

```bash
C:/xampp/php/php.exe vendor/bin/phpunit
```

```bash
npx playwright test --project=cifro
```

A suíte E2E é o guarda-chuva aqui: ela exercita login, seleção de banda, editor, sync e live. Qualquer isenção esquecida aparece como falha.

---

## Fase 2 — Escalonamento de privilégio (V5)

### Task 2.1 — Admin de banda não pode mais reescrever a conta global de um usuário

**Arquivos:**
- Modificar: `public/src/backend/users/salvar_user.php`
- Modificar: `public/src/Services/UserFormValidator.php`
- Modificar: `public/src/Repositories/UserRepository.php`
- Criar: `tests/php/BandAdminUserScopeTest.php`
- Modificar: `public/src/Views/users/editoruser.php` (remover o campo de senha da edição)

**Causa raiz:** `salvar_user.php:115` valida só `belongsToBanda()`, e `UserRepository::saveToBanda()` faz `UPDATE usuarios SET nome=?, email=?, ativo=?, validade=?, senha_hash=?` — tabela global. Um administrador da banda X redefine a senha de qualquer membro, inclusive de um `master` ou de um administrador da banda Y que apareça como membro em X.

**Decisão de design — confirmada em 2026-08-05 (D1):** um administrador de banda gerencia **o vínculo**, não a identidade global. Ele **apenas reenvia convite**; nunca define senha de ninguém.

1. `_senhaPlain` deixa de ser aceito para usuários **existentes**. O caminho suportado passa a ser o que já existe: `action: 'resend_invite'`, que emite token e manda o link — o próprio usuário define a senha. Para usuários **novos** o campo continua válido (a conta está sendo criada ali).
2. `email` de usuário existente vira imutável por este endpoint (troca de e-mail é identidade, não vínculo).
3. Usuário-alvo com `usuarios.perfil = 'master'` só pode ter o `usuario_banda.perfil` alterado — nunca `nome`, `ativo` ou `validade`.
4. Usuário-alvo que pertence a **outra banda além desta** também fica restrito ao `usuario_banda.perfil`, pelo mesmo motivo: `ativo` e `validade` são globais e desativá-los afeta as outras bandas.
5. Usuário-alvo exclusivo desta banda mantém o comportamento atual, menos a senha.

- [ ] **Passo 1: teste que falha**

Criar `tests/php/BandAdminUserScopeTest.php` com o banco real:

```php
public function testAdminNaoDefineSenhaDeUsuarioExistente(): void
{
    // envia _senhaPlain para um usuário já existente na banda
    // assert: senha_hash no banco NÃO mudou; resposta 422
}

public function testAdminNaoAlteraEmailDeUsuarioExistente(): void

public function testAdminNaoDesativaUsuarioMaster(): void
{
    // alvo com usuarios.perfil='master' membro da banda
    // assert: usuarios.ativo permanece 1; usuario_banda.perfil pode mudar
}

public function testAdminNaoAlteraDadosGlobaisDeUsuarioQuePertenceAOutraBanda(): void
{
    // alvo em banda A e B; admin de A tenta ativo=0
    // assert: usuarios.ativo permanece 1
}

public function testAdminAindaAlteraPerfilDoVinculo(): void          // regressão
public function testAdminAindaCriaUsuarioNovoComSenhaInicial(): void  // regressão
public function testResendInviteContinuaFuncionando(): void          // caminho substituto
```

- [ ] **Passo 2: correção**

Em `UserFormValidator`, adicionar as regras puras (testáveis isoladamente):

```php
/** Campos globais só podem ser tocados se o alvo for exclusivo desta banda e não for master. */
public static function podeEditarDadosGlobais(?string $perfilGlobalDoAlvo, int $quantidadeDeBandasDoAlvo): bool
{
    return $perfilGlobalDoAlvo !== 'master' && $quantidadeDeBandasDoAlvo <= 1;
}
```

Em `UserRepository`, adicionar as consultas de apoio:

```php
public function countBandasDoUsuario(string $userId): int
public function perfilGlobal(string $userId): ?string
```

Em `saveToBanda()`, separar os dois caminhos de UPDATE — um que toca `usuarios` e outro que só faz o `INSERT ... ON DUPLICATE KEY UPDATE perfil=?` em `usuario_banda` — e deixar o endpoint escolher. Remover o ramo que grava `senha_hash` quando o usuário já existe.

Em `salvar_user.php`, após a checagem de `belongsToBanda`:

```php
if (!$isNew) {
    if ($senhaPlain !== '') { /* 422: use "reenviar convite" */ }
    $podeGlobal = UserFormValidator::podeEditarDadosGlobais(
        $repo->perfilGlobal((string)$input['id']),
        $repo->countBandasDoUsuario((string)$input['id'])
    );
    // $podeGlobal === false → só o perfil do vínculo é aplicado
}
```

- [ ] **Passo 3: front**

Em `public/src/Views/users/editoruser.php`, esconder o campo de senha quando o formulário está em modo edição e apresentar o botão "Reenviar convite" no lugar. O endpoint já rejeita; a UI não deve oferecer o que será recusado.

- [ ] **Passo 4: verificar**

```bash
C:/xampp/php/php.exe vendor/bin/phpunit --filter "BandAdminUserScope|UserFormValidator|UserRepository"
```

```bash
npx playwright test --project=cifro --grep "usuário"
```

---

## Fase 3 — XSS armazenado em roteiros (V4)

### Task 3.1 — Sanitização no servidor + correção do sanitizador do cliente

**Arquivos:**
- Modificar: `public/src/Services/RoteiroFormValidator.php`
- Modificar: `public/src/js/roteiros.js`
- Modificar: `tests/php/RoteiroFormValidatorTest.php`
- Criar: `tests/roteiro-sanitize.test.js`
- Modificar: `package.json` (registrar o novo teste em `test:unit:js`)

**Causa raiz — duas falhas somadas:**

1. Servidor: `RoteiroFormValidator::normalizarConteudo()` só troca quebras de linha por `<br/>`. O HTML do roteiro é persistido cru.
2. Cliente: `roteiros.js:50` faz `href.startsWith('javascript:')` — sensível a maiúsculas, sem `trim`, sem decodificação de entidades, e `<a>` está na allowlist com `href` preservado. `JavaScript:`, `\tjavascript:` e `data:text/html` passam. A CSP do projeto usa `script-src 'self' 'unsafe-inline'`, que não bloqueia navegação `javascript:`.

**Decisão de design:** defesa nos dois lados. O servidor passa a ser a autoridade (o conteúdo é persistido já limpo); o cliente continua sanitizando porque há conteúdo antigo no banco e snapshots já gravados no IndexedDB de quem usa offline.

- [ ] **Passo 1: testes que falham**

Em `tests/php/RoteiroFormValidatorTest.php`:

```php
/** @dataProvider payloadsMaliciosos */
public function testNormalizarConteudoRemoveVetoresDeScript(string $entrada, string $naoDeveConter): void

public function payloadsMaliciosos(): array
{
    return [
        'javascript maiúsculo'  => ['<a href="JavaScript:alert(1)">x</a>', 'JavaScript:'],
        'javascript com tab'    => ["<a href=\"\tjavascript:alert(1)\">x</a>", 'javascript:'],
        'entidade html'         => ['<a href="java&#9;script:alert(1)">x</a>', 'script:'],
        'data uri'              => ['<a href="data:text/html,<script>alert(1)</script>">x</a>', 'data:'],
        'tag script'            => ['<script>alert(1)</script>', '<script'],
        'handler inline'        => ['<div onclick="alert(1)">x</div>', 'onclick'],
        'svg onload'            => ['<svg onload=alert(1)>', 'onload'],
        'iframe'                => ['<iframe src="//evil"></iframe>', '<iframe'],
    ];
}

public function testConteudoLegitimoENegritoSaoPreservados(): void  // regressão
public function testQuebrasDeLinhaContinuamVirandoBr(): void        // regressão
```

Criar `tests/roteiro-sanitize.test.js` com os mesmos payloads, exercitando `sanitizeRoteiroHtml`. Extrair a função de `roteiros.js` para exportação testável (`module.exports` sob guarda de `typeof module !== 'undefined'`, como já se faz em `music-youtube-panel-state.js`).

- [ ] **Passo 2: correção no servidor**

Em `RoteiroFormValidator`, adicionar sanitização com allowlist usando `DOMDocument` (mesma abordagem já usada em `CifraClubImportProvider::parseHtml`, sem dependência nova):

```php
private const TAGS_PERMITIDAS = ['b','br','strong','em','i','u','p','span','div','a','h1','h2','h3','h4','h5','h6','ul','ol','li'];
private const ATRIBUTOS_PERMITIDOS = ['a' => ['href'], 'span' => ['style'], 'div' => ['style']];
private const ESQUEMAS_PERMITIDOS = ['http', 'https', 'mailto'];

public static function sanitizarConteudo(string $html): string
```

Regras da implementação:
- remover elementos fora da allowlist preservando o texto interno (mesma semântica de hoje no cliente);
- remover **todo** atributo fora da allowlist por tag;
- para `href`: `trim()` + `html_entity_decode()` + remover caracteres de controle **antes** de extrair o esquema com `parse_url()`, e aceitar apenas os esquemas da allowlist (URLs relativas continuam válidas);
- para `style`: aceitar apenas declarações `color`, `background-color`, `font-weight`, `font-style`, `text-decoration` e `text-align` — `expression()`, `url()` e `position:fixed` fora.

`normalizarConteudo()` passa a chamar `sanitizarConteudo()` ao final, para que `salvar_roteiros.php:52` fique inalterado.

- [ ] **Passo 3: correção no cliente**

Em `roteiros.js`, substituir a checagem de `href` por normalização + allowlist de esquema, espelhando a regra do servidor, e restringir `style` às mesmas propriedades.

- [ ] **Passo 4: dados já persistidos**

Roteiros gravados antes desta correção continuam no banco com HTML cru. Escrever `scripts/setup/sanitize_roteiros_existentes.php` que carrega cada `roteiros.conteudo`, aplica `RoteiroFormValidator::sanitizarConteudo()` e regrava, dentro de transação, imprimindo quantos registros mudaram. Rodar uma vez por ambiente **depois** do deploy da correção.

- [ ] **Passo 5: verificar**

```bash
npm run test:unit
```

---

## Fase 4 — Superfície legada e exposição (V6, R3, R4, R6)

### Task 4.1 — V6: remover os endpoints legados de live

**Arquivos:**
- Remover: `public/src/backend/livePlayerLer.php`, `public/src/backend/livePlayerSalvar.php`
- Remover: `public/src/Controllers/LivePlayerController.php` (classe nunca instanciada — confirmado por busca global)
- Remover do versionamento: `public/src/backend/data/live-state.json`
- Modificar: `.gitignore`
- Modificar: `tests/cifro/13-live-mode.spec.js`
- Avaliar: ramo legado de arquivo em `LiveStateService`

**Evidência:** ambos instanciam `new LiveStateService(__DIR__ . '/data/live-state.json')` com `salaId` fixo `'default'`, ignorando `banda_id`. `livePlayerLer.php` checa apenas `$_SESSION['autenticado']`; `livePlayerSalvar.php` exige CSRF mas nenhum papel de banda. A versão suportada é `public/api/live/*`, que usa `require_current_band_json()` e a banda como sala. O JSON versionado contém `hostUserId` e `hostUsername` reais.

- [ ] **Passo 1:** confirmar que nenhum código de produção referencia os arquivos.

```bash
grep -rn "livePlayer" public --include=*.js --include=*.php --include=*.html
```

Resultado esperado: nenhuma ocorrência fora de `tests/`. Se aparecer alguma, ela entra neste passo antes da remoção.

- [ ] **Passo 2:** remover os três arquivos PHP.

- [ ] **Passo 3:** tirar o estado do versionamento e corrigir a regra que não pegava:

```bash
git rm --cached public/src/backend/data/live-state.json
```

Em `.gitignore`, trocar `src/backend/data/live-state.json` por `public/src/backend/data/live-state.json` — a regra atual não casa com o caminho real, que é por isso que o arquivo entrou no repositório.

- [ ] **Passo 4:** remover de `tests/cifro/13-live-mode.spec.js` os dois `describe` legados (linhas ~149-210) e adicionar um teste afirmando que ambas as rotas respondem 404.

- [ ] **Passo 5:** com os endpoints legados fora, o ramo `withLockedFileState()` de `LiveStateService` fica sem chamador em produção. Verificar se algum teste ainda o cobre; se sim, decidir entre manter (e documentar como só-teste) ou remover junto com o construtor polimórfico. **Não remover sem checar `LiveStateServiceTest.php`.**

- [ ] **Passo 6: verificar**

```bash
npx playwright test --project=cifro tests/cifro/13-live-mode.spec.js
```

### Task 4.2 — R3: bloquear `.sql` e outros arquivos sensíveis na raiz web

- [ ] Em `public/.htaccess`, estender o `FilesMatch` existente para incluir `\.sql`, `\.md`, `\.yml`, `\.yaml`, `\.bak`, `\.log`:

```apache
<FilesMatch "(\.env|\.env\.example|\.sql|\.md|\.ya?ml|\.bak|\.log|composer\.json|composer\.lock|package\.json|package-lock\.json)$">
    Require all denied
</FilesMatch>
```

- [ ] Em `router.php` (servidor embutido do PHP, usado em dev e nos E2E), acrescentar o mesmo bloqueio por extensão à lista `$blocked`, para que dev e produção concordem.
- [ ] Teste E2E: `GET /create_tables.sql` deve responder 403.
- [ ] Avaliar mover `create_tables.sql` para `scripts/setup/` — é um artefato de instalação, não conteúdo servido. Se movido, atualizar `HOSTINGER_SETUP.md`.

### Task 4.3 — R4: `tom.php` sem autenticação

**Decisão confirmada em 2026-08-05 (D2): proteger, não remover.** A página permanece no produto.

`TomController::show()` é o único controller sem `require_auth()` — confirmado por leitura de todos os arquivos de `public/src/Controllers/`.

- [ ] Adicionar `require_auth()` como primeira linha de `TomController::show()`, no mesmo padrão de `MusicController` e `IndexController`.
- [ ] Teste E2E: `GET /tom.php` sem sessão redireciona para `/landing.php`; com sessão válida, responde 200.
- [ ] **Pendência separada, não bloqueante desta task:** `public/src/Views/tom.php` carrega Bootstrap de `cdn.jsdelivr.net` (CSS na linha 9, JS na linha 20), que a CSP do `bootstrap.php` (`script-src 'self'`, `style-src 'self'`) bloqueia — a página é servida, mas o detector não funciona no browser. Registrar como item funcional a resolver depois (servir o Bootstrap local, que já existe em `public/src/js/bootstrap.bundle.min.js` e `public/src/css/bootstrap.min.css`). Não faz parte do escopo de segurança deste plano.

### Task 4.4 — R6: logout só por POST com CSRF

- [ ] Em `public/logout.php`, exigir `POST` + `require_csrf()`; responder 405 a `GET`.
- [ ] Trocar os `<a href="/logout.php">` por formulário POST com token — ocorrências conhecidas: `public/src/Views/config.php:299` e `public/src/Views/partials/topnav.php` (conferir por busca antes de alterar).
- [ ] Manter `login.php?logout=1` funcionando ou migrá-lo junto — decidir no passo, não deixar dois caminhos com garantias diferentes.
- [ ] Teste E2E: `GET /logout.php` responde 405 e a sessão sobrevive; o botão de sair continua funcionando.

---

## Fase 5 — Higiene operacional (R1, R2)

### Task 5.1 — R1: limpar cache offline no logout

**Arquivos:** `public/logout.php`, `public/src/js/cifro-sync.js`, `public/service-worker.js`

**Causa raiz:** `CLEAR_CONTEXT` só é enviado de `Views/login.php:108`. O logout é um redirect server-side, então nada roda no cliente. `PAGE_CACHE` e os object stores do IndexedDB (`cifro_snapshot_current`, `cifro_snapshot_previous`, `cifro_bandas`, `cifro_sync_meta`) sobrevivem. Offline, `stagePage()` (`service-worker.js:131`) devolve páginas do usuário anterior.

- [ ] Adicionar handler `CLEAR_ALL` ao service worker: `setContext(null,null)` + `caches.delete(PAGE_CACHE)`.
- [ ] Fazer o logout passar por uma página intermediária (ou por JS no `landing.php`) que dispare `CLEAR_ALL` e apague o IndexedDB antes de concluir o redirect.
- [ ] Teste E2E: após logout, `caches.keys()` não contém `cifro-pages` e `indexedDB.databases()` não lista o banco do app.

### Task 5.2 — R2: parar de gravar o log de debug do Google

**Arquivo:** `public/api/auth/google/callback.php:5-9`

- [ ] Remover o `file_put_contents(__DIR__ . '/../../../../google-auth-debug.log', ...)`. Uma requisição não autenticada com `state` inválido faz o arquivo crescer sem limite, e ele registra `getMessage()`/`getFile()`/`getLine()`.
- [ ] Substituir por `OperationalLogger::log('error', 'auth.google_failed', ['result' => 'failed', 'error_type' => ...])`, que já filtra o contexto por allowlist e pseudonimiza o ator.
- [ ] Confirmar que nenhum teste depende do arquivo (`grep -rn "google-auth-debug" .`).
- [ ] Apagar o arquivo do ambiente de desenvolvimento se existir.

---

## Fase 6 — Reauditoria com a mesma mecânica

Esta fase repete o procedimento da auditoria original — leitura do código real, sem confiar neste documento nem nas mensagens de commit — e produz o relatório de fechamento.

- [ ] **6.1 Suíte completa verde**

```bash
npm run test:unit
```

```bash
npx playwright test --project=cifro
```

```bash
npm run test:coverage:php
```

Comparar com `docs/evidencias-auditoria/baseline-2026-08-05.txt` da Fase 0. Qualquer teste que passava antes e falha agora é regressão e bloqueia o encerramento.

- [ ] **6.2 Reverificação achado a achado, lendo o código**

Para cada item da tabela de escopo, reabrir o arquivo e percorrer o fluxo completo — rota → autenticação → autorização → repositório → SQL → resposta. Preencher:

```text
ID:
Arquivo / método:
Trecho da correção:
Teste que prova o fechamento:
Saída do teste:
Status: sanado | parcialmente sanado | não sanado
```

Não aceitar "o teste passa" como prova isolada: o teste precisa ter falhado antes da correção, e isso está registrado no passo 1 de cada task.

- [ ] **6.3 Varredura de padrões (localizar, depois abrir cada resultado)**

```bash
grep -rn "require_auth_json()\|require_auth()" public --include=*.php
```

Para cada rota que use apenas esses portões, confirmar que a revalidação de banda da Fase 1 realmente cobre o fluxo — não presumir pela existência do helper.

```bash
grep -rn "current_band_id()" public --include=*.php
```

Cada uso deve estar sob um portão que já validou a associação.

```bash
grep -rnE "innerHTML|insertAdjacentHTML|document\.write" public/src/js public/src/Views --include=*.js --include=*.php
```

Cada destino de HTML dinâmico deve passar por `cifroSanitizeCifra` ou pelo sanitizador de roteiro corrigido. Ignorar apenas os bundles de terceiros (`bootstrap*`, `jquery*`, `musicas.js`, `tinymce/`).

```bash
grep -rnE "SELECT|UPDATE|DELETE|INSERT" public/src/Repositories --include=*.php
```

Toda consulta a tabela com `banda_id` deve trazer `banda_id` no `WHERE`.

```bash
git ls-files | grep -iE "\.env|secret|key|credential|\.log$"
```

Nenhum segredo ou estado de runtime versionado.

- [ ] **6.4 Verificar o achado dispensado (V1)**

```bash
ls public/api/waitlist.php public/storage 2>/dev/null
```

Se `public/api/waitlist.php` ainda existir no momento da reauditoria, **V1 é reaberto** e entra como pendência bloqueante — a dispensa valia sob a premissa de que o endpoint sairia antes de produção.

- [ ] **6.5 Verificação em execução (não só leitura)**

Com a aplicação servida localmente (`npm run serve`), confirmar manualmente os três cenários que dependem de estado entre requisições e que teste unitário não prova sozinho:

1. Usuário removido da banda enquanto logado → próxima chamada a `/api/sync/data.php` responde 403 (V3).
2. Conta desativada tentando "Continuar com Google" → redirect para `/login.php?erro=google`, sem sessão criada (V2).
3. Roteiro salvo com `<a href="JavaScript:alert(1)">` → o `href` não sobrevive nem no banco nem no DOM renderizado (V4).

- [ ] **6.6 Relatório de fechamento**

Escrever `docs/superpowers/plans/2026-08-05-correcoes-seguranca-fechamento.md` com: tabela ID × status, evidências do 6.2, saídas do 6.1, achados novos surgidos durante as correções (se houver), e pendências explícitas. Se algum item ficar como "parcialmente sanado", ele é declarado como tal — não como resolvido.

---

## Decisões confirmadas pelo responsável (2026-08-05)

Ambos os pontos abertos foram decididos. Não há decisão pendente — o plano abaixo já reflete as respostas.

| # | Decisão | Resposta |
|---|---|---|
| D1 | Fase 2 — administrador de banda pode redefinir a senha de um membro? | **Não.** O administrador **apenas reenvia o convite** (`action: 'resend_invite'`); quem define a senha é sempre o próprio usuário, pelo link com token. Nenhum caminho do painel de usuários grava `senha_hash` de conta existente. |
| D2 | Task 4.3 — `tom.php`: proteger ou remover? | **Proteger** com `require_auth()`. A página permanece no produto. |

## Ordem de execução

Fases 1 → 2 → 3 → 4 → 5 → 6, nesta ordem. As fases 1 e 2 mexem em `bootstrap.php` e no fluxo de usuários — executá-las antes das demais evita conflito com a Fase 4, que remove arquivos. A Fase 6 só começa com tudo das anteriores fechado.

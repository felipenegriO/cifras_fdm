# Stripe Checkout Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os Payment Links estáticos do Stripe por Checkout Sessions criadas dinamicamente via cURL, ativando o pagamento em produção sem depender do SDK `stripe-php`.

**Architecture:** Um novo endpoint PHP (`public/api/stripe/create-checkout-session.php`) recebe `{ plano }` via POST, chama a API do Stripe com cURL em Basic Auth, e retorna a URL da sessão. O frontend em `plano.php` troca os botões `<a href="buy.stripe.com">` por `<button>` que chamam esse endpoint via `fetch` e redirecionam. O `PlanoViewModel` ganha `isStripeEnabled()` no lugar de `isStripeLinkValid()`. O webhook existente (`webhook.php`) não muda — já espera `metadata.banda_id` e `metadata.price_id` que o novo endpoint envia.

**Tech Stack:** PHP 8+, cURL, PHPUnit 9, JS vanilla, `cifro-toast.js` (já existente), `cifro-csrf.js` (já existente).

## Global Constraints

- Nenhuma dependência nova de Composer — apenas cURL nativo do PHP.
- Nenhuma alteração em `public/api/stripe/webhook.php` nem em seus testes.
- Botões de PIX existentes não mudam.
- `STRIPE_LINK_MENSAL/SEMESTRAL/ANUAL` removidos de `.env.example` (não usados mais).
- Respostas JSON do endpoint seguem o padrão do projeto: `{ ok: true, data: ... }` / `{ ok: false, error: { code, message } }` via `api_success()` / `api_error()` de `bootstrap.php`.
- CSRF enviado via header `X-Csrf-Token` (já disponível via `cifro-csrf.js` → `window.getCsrfToken()`).

---

## Arquivos criados / modificados

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `public/api/stripe/create-checkout-session.php` | Endpoint POST: valida, monta payload, chama Stripe via cURL, retorna URL |
| Criar | `public/src/Services/StripeCheckoutHelper.php` | Lógica pura: `buildPayload()`, `callStripeApi()`, `priceIdForPlan()` — testável sem HTTP |
| Modificar | `public/src/Services/PlanoViewModel.php` | Adicionar `isStripeEnabled(string $secret): bool`; remover `isStripeLinkValid()` |
| Modificar | `public/src/Views/plano.php` | Trocar bloco `$stripeLinks` + botões `<a>` por botões `.js-stripe-checkout` + JS de fetch |
| Modificar | `.env.example` | Remover `STRIPE_LINK_*`; documentar `STRIPE_PRICE_*` como obrigatórios para Checkout |
| Criar | `tests/php/StripeCheckoutHelperTest.php` | Testes unitários do helper (sem rede) |

---

## Task 1: `StripeCheckoutHelper` — lógica pura

**Files:**
- Create: `public/src/Services/StripeCheckoutHelper.php`
- Create: `tests/php/StripeCheckoutHelperTest.php`

**Interfaces:**
- Produces:
  - `StripeCheckoutHelper::priceIdForPlan(string $plan, array $priceMap): string` — retorna o `price_id` do mapa ou lança `InvalidArgumentException` se `$plan` não estiver na whitelist `['mensal','semestral','anual']`.
  - `StripeCheckoutHelper::buildPayload(string $priceId, string $bandaId, string $priceIdMeta, string $customerEmail, string $successUrl, string $cancelUrl): array` — retorna array de campos para `http_build_query()`.
  - `StripeCheckoutHelper::callStripeApi(string $secretKey, array $payload): array` — retorna `['ok' => true, 'url' => '...']` ou `['ok' => false, 'error' => '...']`. Aceita `$curlFn` opcional (callable) para injeção em testes.

- [ ] **Step 1: Criar o test com os três casos principais**

Criar `tests/php/StripeCheckoutHelperTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class StripeCheckoutHelperTest extends TestCase
{
    // ── priceIdForPlan ──────────────────────────────────────────────────────

    public function testPriceIdParaPlanosValidos(): void
    {
        $map = [
            'mensal'    => 'price_m',
            'semestral' => 'price_s',
            'anual'     => 'price_a',
        ];
        self::assertSame('price_m', StripeCheckoutHelper::priceIdForPlan('mensal', $map));
        self::assertSame('price_s', StripeCheckoutHelper::priceIdForPlan('semestral', $map));
        self::assertSame('price_a', StripeCheckoutHelper::priceIdForPlan('anual', $map));
    }

    public function testPriceIdLancaExcecaoParaPlanoInvalido(): void
    {
        $this->expectException(InvalidArgumentException::class);
        StripeCheckoutHelper::priceIdForPlan('gratis', ['mensal' => 'price_m']);
    }

    // ── buildPayload ────────────────────────────────────────────────────────

    public function testBuildPayloadContemCamposObrigatorios(): void
    {
        $payload = StripeCheckoutHelper::buildPayload(
            priceId: 'price_m',
            bandaId: 'banda-uuid-123',
            priceIdMeta: 'price_m',
            customerEmail: 'user@example.com',
            successUrl: 'https://example.com/plano.php?checkout=success&session_id={CHECKOUT_SESSION_ID}',
            cancelUrl: 'https://example.com/plano.php?checkout=cancel',
        );

        self::assertSame('subscription', $payload['mode']);
        self::assertSame('price_m', $payload['line_items[0][price]']);
        self::assertSame('1', $payload['line_items[0][quantity]']);
        self::assertSame('banda-uuid-123', $payload['metadata[banda_id]']);
        self::assertSame('price_m', $payload['metadata[price_id]']);
        self::assertSame('user@example.com', $payload['customer_email']);
        self::assertStringContainsString('{CHECKOUT_SESSION_ID}', $payload['success_url']);
        self::assertStringContainsString('checkout=cancel', $payload['cancel_url']);
    }

    // ── callStripeApi ───────────────────────────────────────────────────────

    public function testCallStripeApiRetornaUrlEmSucesso(): void
    {
        $fakeResponse = json_encode(['url' => 'https://checkout.stripe.com/pay/cs_test_abc']);
        $curlFn = fn($payload, $secret) => ['body' => $fakeResponse, 'status' => 200];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', ['mode' => 'subscription'], $curlFn);

        self::assertTrue($result['ok']);
        self::assertSame('https://checkout.stripe.com/pay/cs_test_abc', $result['url']);
    }

    public function testCallStripeApiRetornaErroQuandoStripeRetorna4xx(): void
    {
        $fakeResponse = json_encode(['error' => ['message' => 'No such price']]);
        $curlFn = fn($payload, $secret) => ['body' => $fakeResponse, 'status' => 400];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', ['mode' => 'subscription'], $curlFn);

        self::assertFalse($result['ok']);
        self::assertArrayHasKey('error', $result);
    }

    public function testCallStripeApiRetornaErroQuandoRespostaInvalida(): void
    {
        $curlFn = fn($payload, $secret) => ['body' => 'not-json', 'status' => 200];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', [], $curlFn);

        self::assertFalse($result['ok']);
    }
}
```

- [ ] **Step 2: Rodar o teste e confirmar que falha por classe não encontrada**

```bash
cd C:/Projetos/cifras_fdm && php vendor/phpunit/phpunit/phpunit --bootstrap vendor/autoload.php tests/php/StripeCheckoutHelperTest.php
```

Esperado: `ERRORS` com `Class "StripeCheckoutHelper" not found`.

- [ ] **Step 3: Criar `StripeCheckoutHelper.php`**

Criar `public/src/Services/StripeCheckoutHelper.php`:

```php
<?php

class StripeCheckoutHelper
{
    private const VALID_PLANS = ['mensal', 'semestral', 'anual'];

    public static function priceIdForPlan(string $plan, array $priceMap): string
    {
        if (!in_array($plan, self::VALID_PLANS, true)) {
            throw new InvalidArgumentException("Plano inválido: {$plan}");
        }
        return $priceMap[$plan] ?? '';
    }

    public static function buildPayload(
        string $priceId,
        string $bandaId,
        string $priceIdMeta,
        string $customerEmail,
        string $successUrl,
        string $cancelUrl,
    ): array {
        return [
            'mode'                     => 'subscription',
            'line_items[0][price]'     => $priceId,
            'line_items[0][quantity]'  => '1',
            'success_url'              => $successUrl,
            'cancel_url'               => $cancelUrl,
            'customer_email'           => $customerEmail,
            'metadata[banda_id]'       => $bandaId,
            'metadata[price_id]'       => $priceIdMeta,
        ];
    }

    /**
     * @param callable|null $curlFn fn(array $payload, string $secret): array{body: string, status: int}
     */
    public static function callStripeApi(string $secretKey, array $payload, ?callable $curlFn = null): array
    {
        $curlFn = $curlFn ?? [self::class, 'defaultCurlCall'];

        $result = $curlFn($payload, $secretKey);
        $status = (int)($result['status'] ?? 0);
        $body   = (string)($result['body'] ?? '');

        $data = json_decode($body, true);
        if (!is_array($data)) {
            return ['ok' => false, 'error' => 'Resposta inválida da API do Stripe.'];
        }
        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => $data['error']['message'] ?? 'Erro ao criar sessão de pagamento.'];
        }
        if (empty($data['url'])) {
            return ['ok' => false, 'error' => 'URL de checkout ausente na resposta do Stripe.'];
        }
        return ['ok' => true, 'url' => $data['url']];
    }

    private static function defaultCurlCall(array $payload, string $secretKey): array
    {
        $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($payload),
            CURLOPT_USERPWD        => $secretKey . ':',
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $body   = (string)curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['body' => $body, 'status' => $status];
    }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd C:/Projetos/cifras_fdm && php vendor/phpunit/phpunit/phpunit --bootstrap vendor/autoload.php tests/php/StripeCheckoutHelperTest.php
```

Esperado: `OK (5 tests, N assertions)`.

- [ ] **Step 5: Commit**

```bash
git add public/src/Services/StripeCheckoutHelper.php tests/php/StripeCheckoutHelperTest.php
git commit -m "feat: add StripeCheckoutHelper with unit tests"
```

---

## Task 2: Endpoint `create-checkout-session.php`

**Files:**
- Create: `public/api/stripe/create-checkout-session.php`

**Interfaces:**
- Consumes: `StripeCheckoutHelper::priceIdForPlan()`, `StripeCheckoutHelper::buildPayload()`, `StripeCheckoutHelper::callStripeApi()` (Task 1); `require_auth_json()`, `require_csrf()`, `current_band_id()`, `api_success()`, `api_error()`, `env()` de `bootstrap.php`.
- Produces: `POST /api/stripe/create-checkout-session.php` → `{ ok: true, data: { url: "https://checkout.stripe.com/..." } }` ou erro JSON.

- [ ] **Step 1: Criar o endpoint**

Criar `public/api/stripe/create-checkout-session.php`:

```php
<?php
/**
 * POST /api/stripe/create-checkout-session.php
 *
 * Cria uma Stripe Checkout Session para o plano informado e retorna a URL
 * de redirecionamento para o checkout hospedado pelo Stripe.
 *
 * Body JSON: { "plano": "mensal" | "semestral" | "anual" }
 * Resposta:  { "ok": true, "data": { "url": "https://checkout.stripe.com/..." } }
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('method_not_allowed', 'Método não permitido.', 405);
    exit;
}

require_auth_json();
require_csrf();

$secretKey = trim((string)env('STRIPE_SECRET_KEY', ''));
if (!str_starts_with($secretKey, 'sk_')) {
    api_error('stripe_not_configured', 'Pagamento via Stripe não configurado.', 503);
    exit;
}

$priceMap = [
    'mensal'    => trim((string)env('STRIPE_PRICE_MENSAL', '')),
    'semestral' => trim((string)env('STRIPE_PRICE_SEMESTRAL', '')),
    'anual'     => trim((string)env('STRIPE_PRICE_ANUAL', '')),
];

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$plano = trim((string)($input['plano'] ?? ''));

try {
    $priceId = StripeCheckoutHelper::priceIdForPlan($plano, $priceMap);
} catch (InvalidArgumentException) {
    api_error('invalid_plan', 'Plano inválido.', 400);
    exit;
}

if ($priceId === '') {
    api_error('price_not_configured', 'Price ID do Stripe não configurado para este plano.', 503);
    exit;
}

$bandaId       = current_band_id();
$appUrl        = rtrim((string)env('APP_URL', ''), '/');
$userEmail     = (string)($_SESSION['usuario']['email'] ?? '');
$successUrl    = $appUrl . '/plano.php?checkout=success&session_id={CHECKOUT_SESSION_ID}';
$cancelUrl     = $appUrl . '/plano.php?checkout=cancel';

$payload = StripeCheckoutHelper::buildPayload(
    priceId: $priceId,
    bandaId: $bandaId,
    priceIdMeta: $priceId,
    customerEmail: $userEmail,
    successUrl: $successUrl,
    cancelUrl: $cancelUrl,
);

$result = StripeCheckoutHelper::callStripeApi($secretKey, $payload);

if (!$result['ok']) {
    OperationalLogger::log('error', 'stripe.checkout_session_failed', [
        'provider' => 'stripe',
        'operation' => 'create_checkout_session',
        'result' => 'failed',
    ]);
    api_error('stripe_error', 'Não foi possível iniciar o pagamento. Tente novamente.', 502);
    exit;
}

api_success(['url' => $result['url']]);
```

- [ ] **Step 2: Testar manualmente via curl (com chave de teste)**

Sobe o servidor local (`npm run serve`) e, com um usuário logado no browser (pega o cookie de sessão e o CSRF token da página `/plano.php`), dispara:

```bash
curl -s -X POST http://localhost:8090/api/stripe/create-checkout-session.php \
  -H "Content-Type: application/json" \
  -H "X-Csrf-Token: <token_da_pagina>" \
  --cookie "PHPSESSID=<seu_session_id>" \
  -d '{"plano":"mensal"}'
```

Esperado sem Stripe configurado: `{"ok":false,"error":{"code":"stripe_not_configured",...}}`.
Esperado com `STRIPE_SECRET_KEY=sk_test_...` e `STRIPE_PRICE_MENSAL=price_...` no `.env`: `{"ok":true,"data":{"url":"https://checkout.stripe.com/..."}}`.

- [ ] **Step 3: Commit**

```bash
git add public/api/stripe/create-checkout-session.php
git commit -m "feat: add create-checkout-session endpoint via cURL"
```

---

## Task 3: `PlanoViewModel` — trocar `isStripeLinkValid` por `isStripeEnabled`

**Files:**
- Modify: `public/src/Services/PlanoViewModel.php`

**Interfaces:**
- Removes: `PlanoViewModel::isStripeLinkValid(string $secret, string $link): bool`
- Produces: `PlanoViewModel::isStripeEnabled(string $secret): bool` — retorna `true` se `$secret` começa com `sk_` e não contém `...`.

- [ ] **Step 1: Adicionar `isStripeEnabled` e remover `isStripeLinkValid` em `PlanoViewModel.php`**

Em `public/src/Services/PlanoViewModel.php`, substituir:

```php
public static function isStripeLinkValid(?string $secret, ?string $link): bool
{
    $secret = trim((string)$secret);
    $link = trim((string)$link);
    $stripeEnabled = str_starts_with($secret, 'sk_') && !str_contains($secret, '...');
    $host = strtolower((string)parse_url($link, PHP_URL_HOST));
    return $stripeEnabled && filter_var($link, FILTER_VALIDATE_URL) !== false && $host === 'buy.stripe.com';
}
```

por:

```php
public static function isStripeEnabled(string $secret): bool
{
    return str_starts_with(trim($secret), 'sk_') && !str_contains($secret, '...');
}
```

- [ ] **Step 2: Rodar os testes PHPUnit para confirmar que nada quebrou**

```bash
cd C:/Projetos/cifras_fdm && php vendor/phpunit/phpunit/phpunit --bootstrap vendor/autoload.php tests/php/
```

Esperado: todos passam. Se algum teste referenciar `isStripeLinkValid`, ajustar o teste para `isStripeEnabled`.

- [ ] **Step 3: Commit**

```bash
git add public/src/Services/PlanoViewModel.php
git commit -m "refactor: replace isStripeLinkValid with isStripeEnabled in PlanoViewModel"
```

---

## Task 4: `plano.php` — novos botões e JS de checkout

**Files:**
- Modify: `public/src/Views/plano.php`

**Interfaces:**
- Consumes: `PlanoViewModel::isStripeEnabled(string $secret): bool` (Task 3); endpoint `POST /api/stripe/create-checkout-session.php` (Task 2); `window.getCsrfToken()` de `cifro-csrf.js` (já carregado); `cifroToast()` de `cifro-toast.js` (já carregado).

- [ ] **Step 1: Atualizar o bloco PHP de inicialização das variáveis do Stripe**

Em `plano.php`, localizar e substituir o bloco das linhas 285-295 (bloco `$stripeSecret` / `$stripeLinks`):

```php
$stripeSecret = (string)env('STRIPE_SECRET_KEY', '');
$stripeLinks = [
    'mensal'    => trim((string)env('STRIPE_LINK_MENSAL', '')),
    'semestral' => trim((string)env('STRIPE_LINK_SEMESTRAL', '')),
    'anual'     => trim((string)env('STRIPE_LINK_ANUAL', '')),
];
foreach ($stripeLinks as $tipo => $link) {
    if (!PlanoViewModel::isStripeLinkValid($stripeSecret, $link)) {
        $stripeLinks[$tipo] = '';
    }
}
```

por:

```php
$stripeSecret  = (string)env('STRIPE_SECRET_KEY', '');
$stripeEnabled = PlanoViewModel::isStripeEnabled($stripeSecret);
```

- [ ] **Step 2: Atualizar os botões do card MENSAL**

Localizar o bloco do card Mensal (linhas ~465-483) e substituir todo o bloco de botões:

```php
<?php if ($plano === 'mensal'): ?>
  <?php if ($stripeLinks['mensal'] !== ''): ?>
    <a href="<?= e($stripeLinks['mensal']) ?>" class="btn-upgrade btn-upgrade--outline"
       target="_blank" rel="noopener">Renovar mensal</a>
  <?php elseif ($pixEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
            data-plan="mensal">Renovar via PIX</button>
  <?php else: ?>
    <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
  <?php endif; ?>
<?php elseif ($stripeLinks['mensal'] !== ''): ?>
  <a href="<?= e($stripeLinks['mensal']) ?>" class="btn-upgrade btn-upgrade--outline"
     target="_blank" rel="noopener"><?= $isPago ? 'Trocar para mensal' : 'Assinar mensal' ?></a>
<?php elseif ($pixEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
          data-plan="mensal"><?= $isPago ? 'Trocar para mensal' : 'Pagar mensal via PIX' ?></button>
<?php else: ?>
  <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
<?php endif; ?>
```

por:

```php
<?php if ($plano === 'mensal'): ?>
  <?php if ($stripeEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--outline js-stripe-checkout"
            data-plan="mensal">Renovar mensal</button>
  <?php elseif ($pixEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
            data-plan="mensal">Renovar via PIX</button>
  <?php else: ?>
    <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
  <?php endif; ?>
<?php elseif ($stripeEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--outline js-stripe-checkout"
          data-plan="mensal"><?= $isPago ? 'Trocar para mensal' : 'Assinar mensal' ?></button>
<?php elseif ($pixEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
          data-plan="mensal"><?= $isPago ? 'Trocar para mensal' : 'Pagar mensal via PIX' ?></button>
<?php else: ?>
  <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
<?php endif; ?>
```

- [ ] **Step 3: Atualizar os botões do card SEMESTRAL**

Localizar o bloco do card Semestral (linhas ~504-522) e substituir:

```php
<?php if ($plano === 'semestral'): ?>
  <?php if ($stripeLinks['semestral'] !== ''): ?>
    <a href="<?= e($stripeLinks['semestral']) ?>" class="btn-upgrade btn-upgrade--primary"
       target="_blank" rel="noopener">Renovar semestral</a>
  <?php elseif ($pixEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--primary js-pix-payment"
            data-plan="semestral">Renovar via PIX</button>
  <?php else: ?>
    <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
  <?php endif; ?>
<?php elseif ($stripeLinks['semestral'] !== ''): ?>
  <a href="<?= e($stripeLinks['semestral']) ?>" class="btn-upgrade btn-upgrade--primary"
     target="_blank" rel="noopener"><?= $isPago ? 'Trocar para semestral' : 'Assinar semestral' ?></a>
<?php elseif ($pixEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--primary js-pix-payment"
          data-plan="semestral"><?= $isPago ? 'Trocar para semestral' : 'Pagar semestral via PIX' ?></button>
<?php else: ?>
  <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
<?php endif; ?>
```

por:

```php
<?php if ($plano === 'semestral'): ?>
  <?php if ($stripeEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--primary js-stripe-checkout"
            data-plan="semestral">Renovar semestral</button>
  <?php elseif ($pixEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--primary js-pix-payment"
            data-plan="semestral">Renovar via PIX</button>
  <?php else: ?>
    <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
  <?php endif; ?>
<?php elseif ($stripeEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--primary js-stripe-checkout"
          data-plan="semestral"><?= $isPago ? 'Trocar para semestral' : 'Assinar semestral' ?></button>
<?php elseif ($pixEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--primary js-pix-payment"
          data-plan="semestral"><?= $isPago ? 'Trocar para semestral' : 'Pagar semestral via PIX' ?></button>
<?php else: ?>
  <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
<?php endif; ?>
```

- [ ] **Step 4: Atualizar os botões do card ANUAL**

Localizar o bloco do card Anual (linhas ~539-557) e substituir:

```php
<?php if ($plano === 'anual'): ?>
  <?php if ($stripeLinks['anual'] !== ''): ?>
    <a href="<?= e($stripeLinks['anual']) ?>" class="btn-upgrade btn-upgrade--outline"
       target="_blank" rel="noopener">Renovar anual</a>
  <?php elseif ($pixEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
            data-plan="anual">Renovar via PIX</button>
  <?php else: ?>
    <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
  <?php endif; ?>
<?php elseif ($stripeLinks['anual'] !== ''): ?>
  <a href="<?= e($stripeLinks['anual']) ?>" class="btn-upgrade btn-upgrade--outline"
     target="_blank" rel="noopener"><?= $isPago ? 'Trocar para anual' : 'Assinar anual' ?></a>
<?php elseif ($pixEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
          data-plan="anual"><?= $isPago ? 'Trocar para anual' : 'Pagar anual via PIX' ?></button>
<?php else: ?>
  <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
<?php endif; ?>
```

por:

```php
<?php if ($plano === 'anual'): ?>
  <?php if ($stripeEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--outline js-stripe-checkout"
            data-plan="anual">Renovar anual</button>
  <?php elseif ($pixEnabled): ?>
    <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
            data-plan="anual">Renovar via PIX</button>
  <?php else: ?>
    <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
  <?php endif; ?>
<?php elseif ($stripeEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--outline js-stripe-checkout"
          data-plan="anual"><?= $isPago ? 'Trocar para anual' : 'Assinar anual' ?></button>
<?php elseif ($pixEnabled): ?>
  <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
          data-plan="anual"><?= $isPago ? 'Trocar para anual' : 'Pagar anual via PIX' ?></button>
<?php else: ?>
  <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
<?php endif; ?>
```

- [ ] **Step 5: Adicionar o bloco JS do Stripe Checkout logo antes do `</body>`**

Localizar a linha `<script>window.CIFRO_USER_ID = ...` (próxima ao final do arquivo, antes de `</body>`) e inserir o bloco JS imediatamente antes dela:

```html
<script>
(() => {
  // ── Toast de retorno do checkout ──────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'success') {
    window.cifroToast && cifroToast('Pagamento recebido! Seu plano será ativado em instantes.', 'success');
  } else if (params.get('checkout') === 'cancel') {
    window.cifroToast && cifroToast('Pagamento cancelado. Seu plano não foi alterado.', 'info');
  }

  // ── Botões de Stripe Checkout ─────────────────────────────────────────────
  document.querySelectorAll('.js-stripe-checkout').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plano = btn.dataset.plan;
      if (!plano) return;

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Aguarde...';

      try {
        const res = await fetch('/api/stripe/create-checkout-session.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Csrf-Token': window.getCsrfToken ? getCsrfToken() : '',
          },
          body: JSON.stringify({ plano }),
        });
        const data = await res.json();
        if (data.ok && data.data && data.data.url) {
          window.location = data.data.url;
        } else {
          window.cifroToast && cifroToast('Não foi possível iniciar o pagamento. Tente novamente.', 'error');
          btn.disabled = false;
          btn.textContent = originalText;
        }
      } catch (_) {
        window.cifroToast && cifroToast('Erro de conexão. Tente novamente.', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });
})();
</script>
```

- [ ] **Step 6: Verificar no browser que os botões aparecem com Stripe configurado**

Adicionar temporariamente ao `.env` local:
```
STRIPE_SECRET_KEY=sk_test_qualquer_coisa_para_teste_visual
```

Subir o servidor (`npm run serve`), abrir `http://localhost:8090/plano.php`, confirmar que os botões mostram "Assinar mensal/semestral/anual" em vez de "Pagamento indisponível".

Remover a chave de teste do `.env` após o teste visual.

- [ ] **Step 7: Commit**

```bash
git add public/src/Views/plano.php
git commit -m "feat: replace static Stripe Payment Links with dynamic Checkout Session buttons"
```

---

## Task 5: Limpar `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Remover `STRIPE_LINK_*` e atualizar comentários**

Em `.env.example`, localizar e substituir o bloco do Stripe:

```
# Payment Links gerados no Stripe Dashboard (aparece na página /plano.php)
STRIPE_LINK_MENSAL=https://buy.stripe.com/...
STRIPE_LINK_SEMESTRAL=https://buy.stripe.com/...
STRIPE_LINK_ANUAL=https://buy.stripe.com/...
```

por:

```
# Price IDs dos produtos no Stripe Dashboard (obrigatório para Checkout Sessions)
# Criar em: Stripe Dashboard → Products → Price → copiar o ID "price_..."
STRIPE_PRICE_MENSAL=price_...
STRIPE_PRICE_SEMESTRAL=price_...
STRIPE_PRICE_ANUAL=price_...
```

(As linhas `STRIPE_PRICE_*` já existem no arquivo — apenas remover o bloco `STRIPE_LINK_*` e o comentário "Payment Links".)

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: remove STRIPE_LINK_* from env.example, document STRIPE_PRICE_* as required"
```

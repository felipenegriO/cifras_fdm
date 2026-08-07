# Stripe Checkout Sessions (hosted) — Design

Data: 2026-08-04

## Contexto

O pagamento do plano pago (`/plano.php`) hoje depende de dois métodos: Stripe Payment Links estáticos (`STRIPE_LINK_MENSAL/SEMESTRAL/ANUAL`) e PIX manual via WhatsApp. Em produção, o Stripe está sem `STRIPE_SECRET_KEY` configurada, então todos os botões de plano caem no PIX (ou mostram "Pagamento indisponível" se o PIX também não estiver configurado).

O usuário tem chaves de teste (não produtivas) do Stripe disponíveis e quer usar o fluxo [Stripe-hosted Checkout](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted): o backend cria uma Checkout Session dinamicamente e redireciona o cliente pra URL retornada pelo Stripe, em vez de usar Payment Links estáticos pré-criados no Dashboard.

## Decisões

- **Modo de cobrança:** `subscription` (recorrente) — mantém o comportamento atual, onde o Stripe cobra automaticamente cada mês/semestre/ano e o webhook (`public/api/stripe/webhook.php`) já trata renovação (`invoice.paid`), cancelamento (`customer.subscription.deleted`) e mudança de status (`customer.subscription.updated`).
- **Redirecionamento pós-checkout:** de volta para `/plano.php`, com parâmetro (`?checkout=success` / `?checkout=cancel`) pra exibir um toast de feedback imediato. A ativação real do plano continua sendo feita de forma assíncrona pelo webhook — o toast não confirma ativação, só o retorno do fluxo de pagamento.
- **Payment Links estáticos:** removidos totalmente. Não ficam como fallback. `STRIPE_LINK_MENSAL/SEMESTRAL/ANUAL` saem do `.env` e do `plano.php`.
- **Integração com a API do Stripe:** cURL direto (sem SDK `stripe-php`), no mesmo estilo já usado em `public/api/stripe/webhook.php`. Motivo: não há certeza se o plano de hospedagem Hostinger em produção tem acesso SSH/Composer, e o objetivo é resolver o pagamento indisponível no mesmo dia sem essa dependência.

## Arquitetura

### 1. Novo endpoint `public/api/stripe/create-checkout-session.php`

- Método `POST`, exige usuário autenticado (sessão) e `banda_id` da banda atual — mesmo padrão de autenticação/CSRF dos demais endpoints em `public/api/`.
- Corpo: `{ "plano": "mensal" | "semestral" | "anual" }`. Valida contra whitelist fixa; qualquer outro valor retorna 400.
- Mapeia `plano` → `STRIPE_PRICE_MENSAL` / `STRIPE_PRICE_SEMESTRAL` / `STRIPE_PRICE_ANUAL` (já existentes no `.env`, já usados pelo webhook para resolver o plano a partir do `price_id`).
- Faz `POST https://api.stripe.com/v1/checkout/sessions` via cURL, Basic Auth com `STRIPE_SECRET_KEY:` (form urlencoded):
  - `mode=subscription`
  - `line_items[0][price]=<price_id>`
  - `line_items[0][quantity]=1`
  - `success_url={APP_URL}/plano.php?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url={APP_URL}/plano.php?checkout=cancel`
  - `metadata[banda_id]=<banda_id da sessão>`
  - `metadata[price_id]=<price_id>` (compatível com o que `webhook.php` já lê em `checkout.session.completed`)
  - `customer_email=<email do usuário logado>` (prefill do formulário hospedado)
- Se `STRIPE_SECRET_KEY` não estiver configurada, retorna 503 (o frontend já não mostra o botão de Stripe nesse caso).
- Resposta de sucesso: `{ "url": "<checkout session url>" }`. Erros do Stripe (ex: price_id inválido) retornam 502 com mensagem genérica (sem vazar detalhes internos do Stripe pro cliente).

### 2. `plano.php` — troca de botões

- Remove o bloco de cálculo de `$stripeLinks` / `PlanoViewModel::isStripeLinkValid` e os `<a href="...buy.stripe.com...">`.
- Botões de Stripe passam a ser `<button class="js-stripe-checkout" data-plan="mensal">`, no mesmo padrão visual/estrutural dos botões `.js-pix-payment` já existentes.
- JS: ao clicar, `fetch('/api/stripe/create-checkout-session.php', { method: 'POST', body: JSON.stringify({ plano }), headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': ... } })`. Em sucesso, `window.location = data.url`. Em erro, mostra toast de erro (`cifro-toast.js`, já usado no projeto) e reabilita o botão.
- Disponibilidade do botão continua condicionada a `STRIPE_SECRET_KEY` estar configurada (`PlanoViewModel` ganha um helper simples tipo `isStripeEnabled(string $secret): bool` no lugar de `isStripeLinkValid`); se não estiver, mantém o fallback existente pro botão de PIX ou "Pagamento indisponível".
- Ao carregar a página com `?checkout=success` ou `?checkout=cancel` na query string, dispara toast de feedback correspondente via JS (sem alterar estado do plano — isso é papel exclusivo do webhook).

### 3. `.env`

- Mantém: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MENSAL/SEMESTRAL/ANUAL`, `STRIPE_WEBHOOK_SECRET`.
- Remove: `STRIPE_LINK_MENSAL/SEMESTRAL/ANUAL` (não usados mais em lugar nenhum).
- `.env.example` atualizado para refletir a remoção e documentar o novo fluxo.

### 4. Testes

- Unit test PHP para o endpoint (`tests/php/`), cobrindo: validação de `plano` (whitelist), montagem do payload enviado ao Stripe (price_id correto por plano, metadata com `banda_id`), e tratamento de resposta de erro do Stripe — mockando a chamada HTTP (sem bater na API real do Stripe), seguindo o padrão de `tests/php/StripeWebhookHelperTest.php`.
- Não altera os testes existentes do webhook (`checkout.session.completed` já espera `metadata.banda_id` e `metadata.price_id`, que o novo endpoint preenche do mesmo jeito).

## Fora de escopo

- Migração para o SDK oficial `stripe-php` (fica registrado como possível troca futura isolada, caso confirmem acesso a Composer/SSH em produção).
- Qualquer mudança no fluxo de PIX/WhatsApp.
- Página de confirmação dedicada (usa o retorno pra `/plano.php` com toast).

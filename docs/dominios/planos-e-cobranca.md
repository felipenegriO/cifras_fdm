# Planos e cobrança

## F-027 Planos

| Plano | Músicas | Playlists | Usuários | Bandas administradas |
|---|---:|---:|---:|---:|
| Gratuito | 10 | Ilimitado | Ilimitado | 1 |
| Mensal | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Semestral | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Anual | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Ativo, legado | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Bloqueado/desconhecido | 0 | 0 | 0 | 0 |

O cadastro inicia no plano gratuito, limitado a 1 banda, 10 músicas, 1 usuário e 1 setlist. Registros legados com plano `trial` são convertidos para gratuito. Limites são aplicados antes de criar ou copiar recursos e retornam 403 com `plano_limit: true`.

`/plano.php` mostra plano, consumo e opções. `/plano-expirado.php` existe para estado bloqueado legado.

## F-028 Stripe

`/api/stripe/webhook.php` valida assinatura com `STRIPE_WEBHOOK_SECRET` e trata:

- `checkout.session.completed`: ativa plano e vincula assinatura;
- `invoice.paid`: renova/ativa com base no price;
- `customer.subscription.deleted`: migra para gratuito;
- `customer.subscription.updated`: atualiza plano ou bloqueio conforme status.

O vínculo primário é `stripe_subscription_id`; no checkout, metadados devem identificar a banda. O mapeamento de price IDs vem do ambiente.

## Inconsistência conhecida

O painel master e o ENUM aceitam `basico` e `banda`, mas `cifro_plan_limits()` não os reconhece. Até haver regra explícita, eles recebem limites zero e não devem ser usados como planos comerciais.

## Testes

`12-planos.spec.js`, `20-planos.spec.js`, `21-bandas-limite.spec.js`, `22-multiband-flow.spec.js`, `24-onboarding.spec.js`.

# Segurança e permissões

## Matriz de acesso

| Operação | Básico | Gestor | Administrador | Master |
|---|---:|---:|---:|---:|
| Ver músicas, setlists e roteiros | Sim | Sim | Sim | Sim |
| Seguir Live | Sim | Sim | Sim | Sim |
| Editar conteúdo | Não | Sim | Sim | Sim |
| Ser host e publicar Live | Não | Sim | Sim | Sim |
| Gerenciar membros | Não | Não | Sim | Sim |
| Administrar todas as bandas | Não | Não | Não | Sim |

## Controles

- `require_auth()`: páginas; redireciona não autenticado para landing e usuário expirado para login.
- `require_auth_json()`: APIs; responde 401 em sessão ausente ou expirada.
- `require_band_role()`: compara papel da banda atual e responde 403.
- `require_csrf()`: valida `X-CSRF-Token` ou campo `csrf_token` com `hash_equals`.
- `cifro_rate_limit()`: contador por sessão; usado em login, cadastro e recuperação.
- Saída HTML usa `e()` ou `htmlspecialchars` nos pontos protegidos.
- Headers globais incluem CSP, `nosniff`, `DENY`, referrer policy e permissions policy.
- Cookie de sessão usa `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS.
- Sessão expira após 8 horas sem atividade.

## Regras obrigatórias

- APIs de escrita autenticadas devem validar método, autenticação, perfil e CSRF.
- Nunca confiar no `banda_id` recebido sem confirmar vínculo; preferir `current_band_id()`.
- Repositories de conteúdo devem filtrar o ID e a banda na mesma consulta.
- Erros de recuperação de senha não devem revelar se o usuário existe.
- Webhook Stripe não usa sessão ou CSRF; sua autenticação é a assinatura Stripe.

## Lacunas conhecidas

- `cifro-sync.js` envia `banda_id` na query; os endpoints devem garantir que ele coincide com a banda autorizada.
- A CSP permite scripts e estilos inline.
- O rate limit vive na sessão e não limita tentativas distribuídas por IP ou múltiplas sessões.


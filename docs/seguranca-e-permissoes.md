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
- `cifro_rate_limit()`: bucket atômico em arquivo temporário por ação, identidade e IP; usado em login, cadastro, recuperação, reenvio de ativação e cancelamento.
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

## Convite de banda por link

- `banda_convites` guarda só o SHA-256 do token, nunca o valor em claro (ver [Modelo de dados](modelo-de-dados.md)).
- Gerar e revogar exigem `administrador` e CSRF; a consulta de estado (`GET`) exige `administrador` mas não muda estado.
- O **aceite é sempre `POST` com CSRF**, nunca `GET` — um `GET` que vinculasse seria disparado por prefetch do navegador ou pela pré-visualização de link de apps de mensagem (o WhatsApp abre todo link que passa por ele).
- `cifro_rate_limit('convite_aceite', 10, 300, $usuarioId)` limita tentativas de aceite por usuário.
- A página pública `/convite.php` mostra a mesma tela neutra para qualquer falha — token ausente, inválido, expirado ou revogado — e **nunca revela o nome da banda** fora do caso válido, para o endereço não virar sonda de quais bandas existem.
- O teto de usuários do plano é checado **duas vezes**: na geração do link (`cifro_require_plan_limit`, 403 `plano_limit`) e de novo no aceite (`BandaConviteFlow::aceitar`). A segunda checagem fecha a corrida de alguém aceitar durante as 24h de validade depois que a banda já cresceu por outro caminho.

## Lacunas conhecidas

- `cifro-sync.js` envia `banda_id` na query; os endpoints devem garantir que ele coincide com a banda autorizada.
- A CSP permite scripts e estilos inline.
- O rate limit cobre múltiplas sessões na mesma instância, mas não compartilha estado entre hosts e depende de configuração confiável de IP/proxy.

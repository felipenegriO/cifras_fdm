# Convite para a banda por link compartilhável — Design

## Objetivo

Deixar o administrador convidar músicos para a banda com um clique: um botão "Convidar" abre o compartilhamento nativo do celular (o mesmo do repertório), e quem recebe o link se cadastra do jeito que preferir e **já entra na banda**, sem o admin precisar saber o e-mail de ninguém.

## Diagnóstico do estado atual

**Só existe convite 1-para-1 por e-mail.** Na aba Membros (`public/src/Views/partials/banda/aba-membros.php`), "Novo Usuário" pede nome + e-mail, cria o usuário inativo e chama `MailService::sendInvite()`, que manda um link para `definir-senha.php?token=…` válido por 48h (`salvar_user.php:162-178`). O admin precisa saber o e-mail de cada músico e digitar um por um, e o convite depende do SMTP entregar.

**Os dois caminhos de cadastro sempre criam uma banda nova.** É a barreira central desta funcionalidade:

- `RegisterController::handle()` cria usuário + banda e vincula como `administrador` (`RegisterController.php:81-91`);
- `GoogleAuthService::createUserAndBanda()` faz o mesmo para o "Continuar com Google" (`GoogleAuthService.php:72-110`).

Não há hoje nenhum caminho de cadastro que termine numa banda existente.

**`register.php` descarta contexto de quem já está logado.** As linhas 4-6 mandam usuário autenticado direto para `index.php`. Um convite anexado à URL de cadastro seria engolido em silêncio nesse redirect — por isso o convite precisa de uma porta de entrada própria.

**O padrão de compartilhar já existe e funciona.** `public/src/js/playlist-share.js` monta um texto, tenta `navigator.share` no celular e cai para a área de transferência no desktop, devolvendo `'shared' | 'cancelled' | 'copied'`. É o molde a seguir.

**Multi-banda já é suportado.** `usuario_banda` é N-para-N, `select-banda.php` existe e `estadoDeAcesso()` já revalida o vínculo a cada requisição. Vincular alguém a uma segunda banda não abre frente nova.

**O plano Gratuito não comporta um segundo membro.** `cifro_plan_limits()` (`bootstrap.php:829`) dá `users => 1` para `gratuito` e `trial`, e `-1` (ilimitado) para todos os planos pagos. A checagem é `$currentCount >= $limit` (`bootstrap.php:867`), e uma banda no gratuito já tem 1 usuário — o próprio admin. Ou seja: **o convite por link só funciona em plano pago**, e no gratuito o primeiro clique seria recusado.

Duas consequências para este design. A primeira é que não existe risco de "vagas fantasma": não há nenhum plano com teto finito maior que 1, então quem se cadastra e não ativa não tira a vaga de ninguém — ou o teto é 1 (e ninguém entra mesmo) ou é ilimitado. A segunda é que o limite precisa ser comunicado **ao admin, antes de compartilhar** — senão quem descobre que não dá é o músico, depois de o link já ter circulado no grupo.

## Decisões tomadas

1. **Link único da banda, reutilizável.** Um link só, que o admin joga no grupo do WhatsApp. Não é um link por pessoa.
2. **Validade de 24 horas, usos ilimitados.** Sem configuração na tela: um botão, zero formulário. A janela curta é o que substitui o limite de usos.
3. **Entrada direta, sem aprovação.** Cadastrou pelo link, está na banda. O controle vem da validade curta e do botão de revogar.
4. **Perfil sempre `basico`.** Promoção a Gestor/Admin continua sendo feita depois, no modal de edição que já existe.
5. **Quem já tem conta também entra.** Logado ou deslogado, o link leva ao vínculo — é o caso do músico que toca em duas bandas.
6. **Cadastro por e-mail mantém a ativação por e-mail.** Igual ao cadastro de hoje: conta inativa + link para definir senha. Mantém o e-mail verificado e não abre caminho para alguém se cadastrar com o e-mail de outra pessoa. O caminho Google continua instantâneo.
7. **No plano Gratuito, o botão Convidar vira convite ao upgrade.** Ele aparece na toolbar, mas não gera link: mostra o limite e leva para `/plano.php`. O admin descobre a restrição antes de compartilhar, e o botão funciona como funil de conversão em vez de armadilha.

## Abordagem escolhida

Tabela própria de convites + página pública dedicada (`convite.php`) como porta de entrada única, com o token pendente atravessando o cadastro pela sessão.

**Alternativas descartadas:**

- **Reaproveitar `password_reset_tokens`:** a tabela exige `usuario_id` (um convite de banda não tem dono), e `UserRepository::createToken()` apaga os tokens anteriores do usuário — um convite colidiria com um reset de senha em andamento.
- **Token assinado por HMAC, sem tabela:** evitaria a migração, mas não permite revogar um link vazado antes das 24h nem contar quantas pessoas entraram. São justamente os dois controles que compensam a decisão de entrada direta.
- **Anexar o convite a `register.php?convite=…` em vez de página própria:** menos arquivos, mas o redirect de usuário logado (`register.php:4-6`) engoliria o convite, e a view de cadastro teria que abrigar os quatro estados do convidado.

## Modelo de dados

Segue o padrão de `password_reset_tokens`: grava apenas o SHA-256 do token; o valor em claro só existe dentro do link compartilhado.

```sql
CREATE TABLE IF NOT EXISTS banda_convites (
  token       CHAR(64)  NOT NULL,
  banda_id    CHAR(36)  NOT NULL,
  criado_por  CHAR(36)  DEFAULT NULL,
  expira_em   DATETIME  NOT NULL,
  revogado_em DATETIME  DEFAULT NULL,
  usos        INT       NOT NULL DEFAULT 0,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_convite_banda (banda_id),
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Sem coluna `perfil`: o perfil é sempre `basico` (decisão 4), e guardá-lo criaria um segundo lugar onde essa regra pode divergir. Sem tabela de usos: `usos` é um contador para a linha de estado, e quem entrou já aparece na lista de membros.

O schema tem um lugar só (`create_tables.sql`, lido por `scripts/setup/setup_db.php`), então a tabela entra **nos dois**: no baseline e numa migration idempotente `migrations/20260816_banda_convites.sql`, para bancos que já existem.

## Componentes

Cada unidade tem uma responsabilidade e pode ser entendida sem ler as outras.

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `BandaConvitePolicy` | Regras puras: um convite está válido? quando expira? qual o rótulo de "vale até"? Sem banco, sem sessão. | nada |
| `BandaConviteRepository` | Gerar, buscar por token, revogar, incrementar usos. | `Database` |
| `public/api/bandas/convite.php` | Endpoint admin: `POST {action: gerar\|revogar}`. Devolve o link e o estado. | policy, repo, `require_band_role` |
| `public/convite.php` | Página pública. Valida o token, ramifica nos quatro estados do convidado, grava o convite na sessão. | policy, repo |
| `BandaConviteFlow` | Consome o convite pendente da sessão e vincula o usuário à banda. Ponto único chamado pelos três caminhos de entrada. | repo, `UserRepository` |
| `public/src/js/banda-convite-share.js` | Monta o texto e dispara o compartilhamento. | `cifro-share.js` |
| `public/src/js/cifro-share.js` | `isMobile()`, `copy()`, `shareText()` — extraídos de `playlist-share.js`. | nada |

**Melhoria contida no código existente:** `playlist-share.js` já carrega `isMobile()` e `copy()` próprios. Em vez de duplicá-los, eles saem para `cifro-share.js` e os dois consumidores passam a usar o mesmo helper. É pequeno, fica dentro do caminho desta funcionalidade e evita que os dois compartilhamentos divirjam de comportamento.

## Fluxo

### Gerar e compartilhar (admin)

1. Toolbar da aba Membros passa a ter **[🔗 Convidar]** como ação primária, com "Novo Usuário" e "Importar" em secundário.
2. Um clique chama `POST /api/bandas/convite.php {action:'gerar'}`. Se já existe convite válido para a banda, ele é reaproveitado em vez de gerar outro — dois links vivos para a mesma banda só confundem.
   - **Plano Gratuito:** o endpoint responde `plano_limit` e a tela mostra, no lugar do compartilhamento, *"Seu plano Gratuito permite apenas você. Faça upgrade para trazer a banda."* com botão para `/plano.php`. Nenhum link é gerado (decisão 7).
3. O JS chama `CifroBandaConviteShare.share()`: `navigator.share` no celular, área de transferência no desktop, toast `'Link copiado! Vale por 24 horas.'` quando cair na cópia.

Texto compartilhado, no molde de `playlist-share.js`:

```
🎸 CONVITE
Você foi convidado para a banda *Os Fulanos* no Cifrô.

Toque no link para entrar:
https://cifro.com.br/convite.php?t=a1b2c3…

⏰ O convite vale por 24 horas.
```

4. Abaixo da toolbar, linha de estado quando há convite ativo: `Convite ativo até hoje às 19h32 · 3 pessoas entraram · Revogar`. É o que devolve ao admin o controle que a entrada direta abriu mão.

### Entrar pelo link (convidado)

`public/convite.php?t=TOKEN` valida e ramifica:

| Estado | Tela |
|---|---|
| Não tem conta | "Você foi convidado para **Os Fulanos**" → *Continuar com Google* / *Criar conta com e-mail* |
| Tem conta, deslogado | Link "Já tenho conta" → `login.php` → volta vinculado |
| Já logado | "Entrar na banda **Os Fulanos**?" + botão. Vincula e troca a banda ativa. |
| Já é membro | "Você já faz parte desta banda" + botão para abri-la. Não é erro. |

Token inválido, expirado ou revogado → card neutro *"Este convite não é mais válido. Peça um novo ao administrador da banda."*, **sem revelar o nome da banda**.

### O desvio no cadastro

`convite.php` grava `$_SESSION['cifro_convite'] = ['token' => …, 'banda_id' => …]` — irmão do `google_legal_acceptance`, que já atravessa o roundtrip do OAuth em `api/auth/google/callback.php:74`. Com convite pendente:

- **`RegisterController`** esconde o campo "Nome da banda", mostra "Entrando na banda X", pula a criação de banda e chama `BandaConviteFlow` para vincular como `basico`. A conta continua nascendo inativa com e-mail de ativação (decisão 6).
- **`GoogleAuthService::resolveOrCreateUser()`** ganha um parâmetro opcional de convite. Com ele presente, cria o usuário **sem** banda nova e vincula à banda convidada. Assinatura com valor default — nenhum chamador existente quebra.
- **`AuthController::finalizeLogin()`** consome o convite pendente antes de escolher a banda ativa, cobrindo quem já tinha conta.

O vínculo em si é `UserRepository::importToBanda($userId, $bandaId, 'basico')`, que já existe e já é `ON DUPLICATE KEY UPDATE` — reentrar no link duas vezes é inofensivo. `BandaConviteFlow` incrementa `usos` no mesmo passo, e só quando o vínculo é novo.

**Quando o vínculo acontece, no caminho e-mail/senha:** no momento do cadastro, não no da ativação. O convidado aparece na lista de membros como **Inativo** até definir a senha — exatamente como já acontece hoje com quem o admin cria pelo botão "Novo Usuário", inclusive com o botão de reenviar convite. Ele já conta para o teto do plano nesse momento, o que é inofensivo: nos planos onde o convite funciona, o teto é ilimitado (ver diagnóstico). Mantém-se assim um modelo de contagem só.

## Limites, segurança e erros

- **Teto do plano é barrado na geração, não no aceite.** É a defesa principal: `POST {action:'gerar'}` recusa quando `cifro_plan_limits(...)['users']` já foi atingido, e a aba Membros mostra o card de upgrade em vez de abrir o compartilhamento (decisão 7). Assim nenhum link impossível de usar chega a existir.
- **A checagem do teto é repetida no aceite**, mesmo assim. Um link gerado em plano pago sobrevive 24h a um downgrade ou a um pagamento que falhou, e o vínculo não pode passar nesse intervalo. Ela roda **antes de criar a conta** — verificar depois deixaria um usuário órfão, sem banda nenhuma. Banda cheia → *"Esta banda atingiu o limite de músicos do plano. Peça ao administrador para fazer upgrade."*
- **Gerar e revogar** exigem `require_band_role('administrador')` + `require_csrf()`, como `salvar_user.php:13`.
- **Aceitar o convite** é `POST` com CSRF — nunca um `GET` que vincula, para não vincular ninguém por prefetch de navegador.
- **`cifro_rate_limit()`** no endpoint de aceite, contra abuso de link vazado.
- **Banda desativada ou plano bloqueado** → convite recusado com a mesma tela neutra.
- **Token** de 32 bytes aleatórios, comparado por hash. Inviável de adivinhar; a tela neutra impede usar o endpoint para descobrir nomes de bandas.
- **Aceite dos termos:** a tela do convite exibe o mesmo consentimento de Termos/Privacidade do cadastro e grava via `recordLegalAcceptance()`. Entrar por convite não pode virar um atalho que pula o aceite.

## Testes

**PHPUnit** (`tests/php/`):

- `BandaConvitePolicyTest` — válido, expirado, revogado, fronteira das 24h.
- `BandaConviteRepositoryTest` — gerar, reaproveitar convite vivo, revogar, incrementar usos.
- `BandaConviteFlowTest` — vincula como `basico`; idempotente quando já é membro; recusa quando a banda está no teto do plano, sem deixar usuário órfão.
- Desvio de banda em `RegisterControllerTest` e `GoogleAuthServiceTest`: com convite pendente, **nenhuma banda nova é criada**.

**Playwright** (`tests/cifro/78-convite-banda.spec.js`), cenários nomeados em português de negócio:

- Administrador gera o convite e o link aparece com validade de 24 horas
- Músico sem conta se cadastra pelo convite e já vê o repertório da banda
- Músico que já toca em outra banda entra na banda convidada sem perder a primeira
- Convite expirado não revela o nome da banda
- Convite revogado deixa de funcionar imediatamente
- Banda no plano Gratuito não gera link e oferece upgrade ao administrador
- Banda que atingiu o teto durante a validade do link recusa o convidado sem criar conta órfã

## Fora de escopo

- Aprovação/moderação de quem entra pelo link (decisão 3).
- Escolha de perfil ou de validade na hora de gerar (decisões 2 e 4).
- Tela de auditoria "quem entrou por qual link" — o contador de usos e a lista de membros bastam.
- Convite individual por e-mail: continua existindo como está, sem alteração.

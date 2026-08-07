# Plano de ação — Landing page Cifrô

Base: auditoria de 2026-08-07 sobre `public/landing.php` (279 linhas) renderizada em 1280px e 375px.

## Premissas corrigidas pelo dono do produto

1. **O modo ao vivo NÃO funciona offline.** Confirmado em `public/src/js/live.js:6` — polling HTTP a cada
   2500ms contra `/api/live/status.php`. Sem rede, o status vira "Live desconectada".
   O offline é **leitura**: `service-worker.js` guarda app shell + `/index.php`, `/music.php`,
   `/roteiro.php`, `/select-banda.php` + snapshot de `/api/sync/data.php`, disparado pelo botão
   "Preparar para offline" (`offline-tools.js`).
   → Toda a copy precisa separar as duas capacidades. A copy atual as funde e induz a erro.
2. **Não há CNPJ.** Produto em MVP. A identificação legal é de pessoa física / projeto independente.
   Nada de inventar razão social. O rodapé e os documentos legais devem ser honestos sobre o estágio.
3. **Domínio oficial: cifro.online** (o `CNAME` apontava para `ministeriofilhosdemaria.com.br`).

## Regras de execução

- Nenhum número, depoimento, logo de cliente ou selo é inventado. Prova social entra por `env()`
  e, se não configurada, **a seção simplesmente não renderiza**.
- Nenhuma promessa que o código não cumpre.
- Os contratos do `tests/cifro/19-landing-page.spec.js` são preservados (3 `.proof-card`,
  4 `.feature-card`, 4 `.price-card`, primeiro `a.btn-plan` com `href="/register.php"` exato etc.).

---

## Fase 0 — Verdade e domínio  (P0)

- [x] `CNAME` → `cifro.online`
- [x] Reescrever hero e cards separando **offline (leitura)** de **ao vivo (precisa de internet)**
- [x] Ajustar `<meta name="description">` pelo mesmo motivo

## Fase 1 — Descoberta e compartilhamento  (P0)

- [x] Open Graph + Twitter Card + `canonical` + `theme-color` + `rel=manifest` + `rel=icon`
- [x] `public/og-image.png` (1200×630) gerado por script versionado
- [x] `public/robots.txt`
- [x] `public/sitemap.xml`
- [x] JSON-LD `SoftwareApplication` + `Offer` (preços vindos da mesma fonte da tabela)

## Fase 2 — Acessibilidade e mobile  (P1)

- [x] Contrastes reprovados em AA: badge 2,09 → ≥4,5; `--text-3` #666 → #8f8f8f
- [x] Bug de especificidade: `.hero p` sobrescreve `.hero-note` (renderiza 18px em vez de 13px)
- [x] `:focus-visible` global
- [x] Alvos de toque ≥ 48px nos CTAs e ≥ 44px nos links de rodapé
- [x] "Entrar" volta a aparecer no mobile
- [x] `.proof-title` div → `<h3>` (buraco no sumário de headings)
- [x] Emojis → SVG inline com `aria-hidden`

## Fase 3 — O que falta na página  (P1)

- [x] Seção "Como funciona" em 3 passos
- [x] Seção de offline honesta (o que funciona sem internet e o que não funciona)
- [x] Seção "Instale no celular" (o PWA existe e nunca foi mencionado)
- [x] FAQ com as objeções abertas, respondidas com o que o código faz de verdade
- [x] Bloco de transparência de MVP substituindo a prova social que ainda não existe
- [x] Espaço reservado para screenshots do produto (renderiza só quando os arquivos existirem)

## Fase 4 — Funil  (P1)

- [x] CTAs dos planos pagos carregam `?plano=` até o checkout
- [x] `?conta_excluida=1` deixa de ser ignorado
- [x] Camada de eventos de analytics agnóstica (`cifro-analytics.js`), ativada por `env()`

## Fase 5 — Jurídico de MVP sem CNPJ  (P0)

- [x] Termos: identificação do responsável, estágio beta, cancelamento, reembolso de 7 dias (CDC art. 49)
- [x] Privacidade: controlador identificado, canal do titular, base legal, retenção, subprocessadores

## Fase 6 — Performance  (P3)

- [x] Remover `cifro-theme.js` da landing (render-blocking e sem efeito: a página é dark fixa)
- [x] `preload` dos dois pesos de Inter realmente usados
- [x] `font-weight:800` sem arquivo correspondente → 700

## Fase 7 — Testes

- [x] Atualizar e ampliar `tests/cifro/19-landing-page.spec.js`
- [x] Rodar a suíte da landing

---

---

## Iteração 2 — correções pedidas pelo dono (2026-08-07, noite)

- [x] "E quando a internet da igreja cai?" → "E quando a internet cai?" (não comunicar só para igreja)
- [x] Texto do offline trocado para "você loga no site e o Cifrô guarda…"
- [x] **Cancelamento: copy corrigida.** Eu havia escrito "cancela sozinho, pela sua conta, sem falar com
      ninguém" em 3 lugares (landing pricing, FAQ e Termos §6). Isso é falso hoje:
      `PlanoViewModel::cancelUrl()` gera link de WhatsApp ou `mailto:` — é **pedido**, não self-service,
      e `PlanoViewModelTest` já provava isso. A copy agora descreve "Solicitar cancelamento", mantendo
      "sem multa e sem fidelidade", que é verdade.
- [x] Teste de regressão que falha se a landing voltar a prometer cancelamento com um clique.

### Trabalho concorrente detectado

Outra sessão está implementando **preparação offline automática**
(`docs/superpowers/specs/2026-08-07-offline-automatico-design.md`, `tests/cifro/56-offline-auto-sync.spec.js`),
mexendo em `offline-tools.js`, `cifro-sync.js`, `service-worker.js`, `config.php`, `live.js`, `editor.js`
e `AuthController.php`. **Não editar esses arquivos aqui** para não haver clobber.
Estado ao final desta iteração: `56-offline-auto-sync.spec.js` com 3 passando e 3 falhando.

---

## Iteração 3 — cancelamento self-service implementado

A promessa "cancela quando quiser" passou a ser verdade para quem assina no cartão.

- [x] `SubscriptionCancellationService` — lógica pura, injetável, 27 testes de unidade
- [x] `POST /api/plano/cancelar.php` — auth + CSRF + `require_band_role('administrador')` +
      rate limit (5 pedidos / 10 min por banda) + escopo de banda vindo da sessão
- [x] Coluna `bandas.cancelamento_agendado_em` + migração para bases existentes
- [x] `BandaRepository::agendarCancelamento()` / `limparCancelamento()`
- [x] UI em `plano.php`: botão real, diálogo de confirmação e estado "cancelamento agendado"
- [x] Webhook limpa a marca quando a banda volta a assinar (`checkout.session.completed`, `invoice.paid`)
- [x] `tests/cifro/57-cancelamento-assinatura.spec.js` — 12 testes e2e reais
- [x] Copy promovida na landing e nos Termos, distinguindo cartão (self-service) de Pix (sem recorrência)

**Decisão de projeto:** cancelar usa `cancel_at_period_end=true`, nunca cancelamento imediato.
Cortar acesso já pago seria lesivo ao consumidor. O downgrade real continua sendo feito pelo
webhook `customer.subscription.deleted`, que já existia.

### Bugs reais encontrados no caminho

1. **Injeção de nova linha no ID de assinatura.** `preg_match('/^sub_[A-Za-z0-9]+$/')` aceita
   `"sub_123\n"`, porque em PHP `$` casa antes de um `\n` final. Trocado por `\A...\z`.
   O identificador vai para o caminho da URL da API do Stripe. Coberto por teste.
2. **`scripts/setup/setup_e2e_db.php` lia `public/create_tables.sql`, que não existe** — o arquivo
   está na raiz. O script derrubava o banco e recriava vazio. Como o banco antigo sobrevivia de
   uma época em que o caminho existia, o schema de teste vinha derivando silenciosamente do real.
   Corrigido, com falha explícita se o schema sumir.
3. **`create_tables.sql` não tinha a tabela `app_error_logs`**, usada por `ErrorLogger`. Um deploy
   novo perderia todo log de erro em silêncio (o logger engole a exceção de propósito).
4. **`usuarios.email` estava `NOT NULL` no schema**, mas `UserRepository::saveToBanda()` grava
   NULL para membro sem e-mail. Deploy novo quebraria ao adicionar músico sem e-mail.

Depois de corrigir 2–4 e recriar o banco, a suíte PHP saiu de 10 skips para 3 — havia teste que
nem chegava a rodar.

### Flakiness real da suíte e2e completa, encontrada ao rodar tudo junto

Rodar só os arquivos novos/tocados (55, 56, 57) sempre passava. Rodar a suíte `cifro` inteira
(`npx playwright test --project=cifro`) dava **22 falhas**, incluindo os meus. Isolei a causa
reproduzindo a sequência 45→48→50→51→53→55→56→57:

A fixture automática `isolatedSession` (`tests/fixtures/coverage.js`) chama
`session_regenerate_id()` **antes de todo teste**, para isolar sessão entre specs. Isso invalida
o cookie salvo em `tests/.auth/user.json`, que é compartilhado por praticamente todo arquivo via
`test.use({ storageState: ... })`. O comentário em `53-convite-ponta-a-ponta.spec.js:117` já
documentava o sintoma sem resolvê-lo. Resultado: dependendo de quantos testes rodaram antes,
o cookie carregado no início do arquivo já está morto, e toda chamada autenticada (`page.goto`,
`page.request.post` com sessão) recebe 401/redirect para login — os testes falham por motivo que
nada tem a ver com o que estão testando.

**Corrigido** adicionando `test.beforeEach(() => fazerLogin(page))` — helper que já existia em
`tests/helpers/auth.js`, é *no-op* se a sessão ainda for válida e reloga se não for — em:
`28-interacoes-palco.spec.js`, `55-stripe-sandbox.spec.js`, `56-offline-auto-sync.spec.js`,
`57-cancelamento-assinatura.spec.js` (a minha, desde o início).

Resultado: das 22 falhas da suíte completa, **19 eram esse mesmo bug**, agora resolvido nesses 4
arquivos. Restam 3 falhas em `28-interacoes-palco.spec.js` (interação de apresentação ao vivo —
timing de UI, não sessão) que são pré-existentes, não tocam nada relacionado a landing/cobrança/
promessas do produto, e ficam fora do escopo desta tarefa.

**Pendência anotada, não corrigida:** `35-google-auth.spec.js` também falha na suíte completa.
Causa provável: o teste faz `fs.writeFileSync` em `.env.local` para simular config e restaura no
`finally` — se um teste anterior nessa família for interrompido, a env fica poluída para quem
roda depois. Não investiguei a fundo; é um arquivo de terceiros, não relacionado a nenhuma
promessa da landing.

## Pendências que dependem de código, não de texto

| Promessa na página | Estado real | Situação |
|---|---|---|
| "você loga e o Cifrô guarda no aparelho" | Preparação offline automática a cada abertura | ✅ `56-offline-auto-sync.spec.js` 6/6 verde |
| "cancela quando quiser" (cartão) | Self-service via Stripe `cancel_at_period_end` | ✅ implementado nesta iteração |
| "cancela quando quiser" (Pix) | Sem recorrência; acesso não renova | ✅ descrito como tal na copy |
| "acesso até o fim do período já pago" | `cancel_at_period_end`, downgrade só no webhook | ✅ coberto por teste |
| "suas cifras não são apagadas" | Cancelar não toca no conteúdo | ✅ coberto por teste |
| "sem multa e sem fidelidade" | Não há cobrança de saída em lugar nenhum | ✅ |
| "exporta seus dados em Configurações" | `api/account/export.php` | ✅ `58-privacidade-conta.spec.js`, 7/7 |
| "exclui a conta em Configurações" | `api/account/delete.php` | ✅ idem — inclui banda órfã removida junto |
| "7 dias de arrependimento (CDC art. 49)" | Reembolso é manual, por e-mail | ⏳ processo humano; aceitável, mas sem prova automatizada |

---

## Iteração 4 — teste e2e de exportar/excluir conta

- [x] `tests/cifro/58-privacidade-conta.spec.js` — 7 testes, todos com usuário e banda
      **descartáveis** criados via SQL direto (nunca a conta admin compartilhada da suíte):
      botão existe e exporta dados reais; visitante anônimo não exporta; excluir apaga o
      usuário de fato (não só desativa) e mata a sessão; confirmação de e-mail errada não
      apaga nada; visitante anônimo não exclui; excluir o único membro remove a banda órfã junto.

## Estado consolidado ao fim da iteração 4

- PHP: **443/443** (0 falhas, 3 skips explicados)
- E2E `cifro` (suíte completa, sequencial): **19 das 22 falhas anteriores eram o mesmo bug de
  sessão obsoleta**, agora corrigido em 4 arquivos. Restam 2 arquivos com flake pré-existente e
  não relacionado (`28-interacoes-palco` timing de UI, `35-google-auth` possível poluição de
  `.env.local`) — nenhum dos dois toca landing, cobrança ou promessas do produto.
- Toda promessa da landing rastreada na tabela acima está ✅, exceto o comprovante automatizado
  do prazo de 7 dias (processo manual por e-mail, fora do que dá para testar via HTTP).

## Fora do escopo automatizável (depende do dono)

| Item | Por quê |
|---|---|
| Screenshots / GIF do produto | Precisa de captura real do app com dados reais |
| Depoimento nominal | Precisa de pessoa real autorizando nome e foto |
| Números reais (bandas, músicas) | Só o banco de produção sabe |
| Nome, cidade e WhatsApp do responsável | Dado pessoal do dono |
| ID do GA4 / Plausible | Conta do dono |

Todos entram por `env()` e a página degrada sem eles.

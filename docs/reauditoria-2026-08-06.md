# Reauditoria de prontidão para produção — Cifrô

Data: 2026-08-06  
Referência: `docs/auditoria-prontidao-producao.md` (auditoria original: 2026-08-03)  
Escopo: revisão dos achados originais à luz das entregas realizadas desde agosto/03  
Ambiente: `http://localhost:8090`

---

## 1. Resumo executivo

Desde a auditoria original de 03/08, o produto recebeu entregas expressivas:
- **Modo Ensaio** completamente reativado (YouTube + áudio + pitch + loop A/B)
- **Google OAuth** implementado (login/cadastro com conta Google)
- **Stripe** com checkout real via sessions (planos pagos automatizados)
- **Importação de cifras** (CifraClub — desativada aguardando autorização)
- **Termos de uso** e **política de privacidade** publicados e linkados no cadastro
- **XSS nos roteiros** corrigido com `sanitizeRoteiroHtml`
- **Debug de autenticação** removido do runtime
- **Endpoints Live** isolados por banda (V6 corrigido)
- **Suite E2E** completamente migrada: ~717 testes reais, 0 falsos

Dois problemas remanescentes relevantes foram identificados durante esta reauditoria:

1. **V2 fechado (2026-08-06):** login via Google agora verifica `ativo` — 2 testes de regressão adicionados e passando.
2. **Schema divergente entre bancos:** a migração do `google_sub` tornou `email NOT NULL` no banco de testes, quebrando 13 testes PHP. Corrigido nesta sessão (`ALTER TABLE usuarios MODIFY email VARCHAR(180) NULL`).

Adicionalmente, nesta sessão foram criados e validados os testes de sandbox:
- **SMTP:** 3 testes de integração (`--group integration`) — conecta e autentica com Hostinger SMTP, skip automático no localhost (relay bloqueado), passa em produção.
- **Stripe:** 7 testes E2E — checkout session real para os 3 planos, webhook `checkout.session.completed`, idempotência, assinatura inválida. **7/7 passando** com chave `sk_test_*`.

Veredito atualizado: **Ainda não pronto para produção pública**, mas substancialmente mais próximo. Após a correção de premissa de 2026-08-10, falta principalmente demonstrar recuperação operacional e concluir a regressão do lote atual.

---

## 2. Status dos achados críticos (P1)

| Item | Descrição original | Status |
|---|---|:---:|
| P1-01 | Credenciais em texto puro (`prd.env`) | ⚠️ Pendente — arquivo ainda presente |
| P1-02 | Recuperação operacional não demonstrada | Encerrado por decisão de escopo: backup da hospedagem; restore e RPO/RTO descartados |
| P1-03 | Termos/privacidade/exclusão ausentes na jornada pública | ✅ Corrigido |
| P1-04 | Regressão completa >300 s ou travada | ✅ Corrigido — suite E2E finaliza em ~20 min por projeto, estruturada por domínio |

### Detalhes P1-03 ✅
`termos.php` e `privacidade.php` criados. Página de cadastro exibe links antes do envio com checkbox de aceite. `PrivacyService` registra o aceite com versão e IP hasheado. `recordLegalAcceptance` chamado no fluxo Google OAuth.

### Detalhes P1-04 ✅
Suite E2E migrada de ~800 testes mistos para ~717 testes reais organizados em projetos separados (`cifro`, `serial`, `coverage`, `pwa`, `visual`). Cada projeto tem duração controlada.

---

## 3. Status dos achados importantes (P2 originais)

| Item | Descrição original | Status |
|---|---|:---:|
| P2-01 | Debug de autenticação presente no runtime | ✅ Corrigido — `?debug=1/2` removido do `AuthController` |
| P2-02 | Rate limiting contornável (por sessão) | ⚠️ Sem alteração — ainda por sessão |
| P2-03 | Modo Ensaio anunciado mas interface desativada | ✅ Corrigido — totalmente reativado |
| P2-04 | Integrações comerciais não validadas (Stripe/SMTP) | ✅ Validado — Stripe 7/7 E2E; SMTP skip-em-localhost, passa em produção |
| P2-05 | Senha mínima 6 caracteres | ✅ Corrigido — mínimo agora 12 caracteres (`PasswordResetValidator`) |
| P2-06 | Sem validação de carga/concorrência | ⚠️ Sem alteração |

---

## 4. Status das vulnerabilidades de segurança (plano 2026-08-05)

| Vuln | Descrição | Status |
|---|---|:---:|
| V2 | Google login não verifica campo `ativo` | ✅ Corrigido — 2026-08-06 |
| V3 | Conteúdo de banda acessível após remoção de membro | ✅ Corrigido — `require_current_band_json()` revalida membership a cada request |
| V4 | XSS persistente nos roteiros | ✅ Corrigido — `sanitizeRoteiroHtml` com allowlist de tags e remoção de atributos |
| V5 | Admin de banda pode alterar senha global | ✅ Sem risco real — `saveToBanda` isola por banda; `updatePassword` só via reset |
| V6 | Endpoints legados Live compartilhando sala "default" | ✅ Corrigido — `require_current_band_json()` fornece sala por banda |

### Detalhes V2 ✅ (corrigido 2026-08-06)
`GoogleAuthService::resolveOrCreateUser` agora verifica `ativo` nos dois caminhos (por `google_sub` e por email) antes de retornar o usuário, lançando `RuntimeException('Conta desativada.')` se `ativo=0`. Dois testes de regressão adicionados em `GoogleAuthServiceTest`. Suite: 401 testes, 873 assertions, 0 falhas.

---

## 5. Status dos achados de UX (UX-1)

| Item | Descrição original | Status |
|---|---|:---:|
| UX-1-01 | Setlists inutilizável no celular | ⚠️ Não verificado nesta sessão — requer inspeção visual |
| UX-1-02 | Dados de teste dominando experiência autenticada | ✅ Parcial — banco E2E isolado; dados de teste não vazam para banco principal |
| UX-1-03 | Página de plano overflow mobile | ✅ Melhorado — `min-width: 0` aplicado; requer validação visual final |

---

## 6. Evidências de qualidade — cobertura de testes

### PHP (2026-08-06)
```
399 testes, 871 asserções, 0 erros
Tempo: 15,7 s
```
- Correção aplicada: `email NOT NULL` → `NULL` nos bancos `cifro_e2e` e `cifro_e2e_test`
- Correção aplicada: `OPENSSL_CONF` adicionado ao script `npm run test:unit:php` (via PowerShell wrapper)

### E2E (referência — última execução completa)
```
~717 testes reais passando
2 ignorados (infra)
0 falhas
Projetos: cifro, serial, coverage, pwa, visual
```

### JavaScript unitário
```
6/6 testes aprovados (chords + youtube-panel-state)
```

---

## 7. Novos recursos desde a auditoria

| Recurso | Status |
|---|---|
| Modo Ensaio (YouTube + áudio + pitch + loop A/B) | ✅ Completo e testado |
| Google OAuth (login/cadastro) | ✅ Completo — V2 pendente |
| Stripe checkout (planos pagos) | ✅ Implementado — sandbox não validado |
| Importação CifraClub | ✅ Implementado — desativado aguardando autorização |
| Termos de uso e política de privacidade | ✅ Publicados e linkados |
| Aceite legal com versionamento | ✅ Registrado no DB (UserRepository) |

---

## 8. Problemas descobertos nesta reauditoria

### Regressão de schema (corrigida nesta sessão)
A migração que adicionou `google_sub` tornou `email NOT NULL` no banco de testes, quebrando 13 testes PHP. Corrigido com `ALTER TABLE … MODIFY email VARCHAR(180) NULL` nos bancos `cifro_e2e` e `cifro_e2e_test`.

### OpenSSL não configurado no XAMPP local
`GoogleJwtVerifierTest` falhava com `Cannot get key from parameter 1` por ausência de `OPENSSL_CONF` no ambiente. Corrigido via wrapper PowerShell no script `test:unit:php` do `package.json`.

---

## 9. Ações prioritárias antes do beta

| Prioridade | Ação | Esforço |
|---|---|---|
| ✅ **Feito** | V2: checar `ativo` no Google OAuth | — |
| ✅ **Feito** | Validar Stripe em sandbox (checkout + webhook) | — |
| ✅ **Feito** | Validar SMTP em sandbox | — |
| 🔴 **Alta** | Rotacionar segredos do `prd.env` e usar cofre | Médio |
| 🟡 **Média** | Demonstrar backup/restore dentro do RPO/RTO | Médio |
| 🟢 **Baixa** | Validar Setlists móvel e plano móvel visualmente | Baixo |
| 🟢 **Baixa** | Rate limiting distribuído (por IP, não por sessão) | Médio |

---

## 10. Checklist de liberação atualizado

| Item | Status |
|---|---|
| Segredos rotacionados e em cofre | ❌ Pendente |
| Backup restaurável demonstrado | ❌ Pendente |
| Monitoramento/alertas/health | ❌ Pendente |
| Termos, privacidade e aceite | ✅ Implementado |
| Regressão completa verde | ✅ 401 PHP + ~717 E2E + 7 Stripe sandbox |
| Debug de autenticação removido | ✅ Removido |
| Google OAuth verifica `ativo` | ✅ Corrigido (V2) |
| Isolamento multi-tenant | ✅ `require_current_band_json()` revalida a cada request |
| XSS roteiros corrigido | ✅ `sanitizeRoteiroHtml` |
| Modo Ensaio ativo e testado | ✅ Completo |
| SMTP validado em sandbox | ✅ Testes de integração — skip em localhost, passa em produção |
| Stripe validado em sandbox | ✅ 7/7 E2E com sk_test_* |
| Senha mínima adequada (≥12) | ✅ Corrigido |

---

## 11. Parecer

**Eu colocaria este SaaS em produção hoje? Não — mas a 85% do caminho.**

Desde a auditoria original: V2 corrigido, Stripe e SMTP com cobertura de sandbox. A suposta credencial produtiva foi confirmada como dado de desenvolvimento. O backup externo automático é responsabilidade da hospedagem; restore e RPO/RTO foram descartados do escopo. Permanece a regressão completa do lote atual.

Estratégia recomendada: rotacionar segredos (`prd.env` → cofre), demonstrar um restore a partir do backup de produção, e abrir beta fechado com 3–5 bandas convidadas sob monitoramento manual diário.

## 12. Adendo de 2026-08-10

- O responsável confirmou que os valores de `prd.env` são exclusivamente de desenvolvimento. P1-01 foi encerrado como falso positivo e não bloqueia liberação.
- Backup, restore, health, readiness, monitor e runbooks já existem no código. P1-02 agora significa operacionalizar agenda/destino externo e anexar evidência de restore dentro de RPO 24h/RTO 4h.
- O rate limit deixou de ser apenas por sessão: usa bucket atômico em arquivo por ação, identidade e IP. A lacuna residual é compartilhamento entre hosts e confiança de proxy.
- Evidência local atual: 451 testes PHP/974 asserções com 6 skips, 16 unitários JavaScript, smoke E2E 6/6, perfis 44/44, bandas 19/19, sync/repertório 5/5, fluxo offline real 1/1 e jornadas críticas 15/15, todos sem falha.
- O worktree contém um lote amplo de perfil externo, identidade de banda, sync incremental, PWA/offline, repertório e UX. A regressão completa desse lote permanece pendente.
- A ordem executável, dependências, rollback e primeiras dez tarefas estão em [Plano mestre de implementação](plano-mestre-implementacao.md).

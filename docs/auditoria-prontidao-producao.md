# Auditoria de prontidão para produção — Cifrô

Data: 2026-08-03  
Escopo: aplicação local, código, documentação e testes automatizados  
Ambiente funcional: `http://localhost:8090`  
Veredito: **Não está pronto para produção**

## 1. Resumo executivo

O Cifrô é um SaaS para bandas organizarem cifras, setlists/roteiros, ensaios e apresentações ao vivo. A proposta de valor é clara na landing: manter a banda sincronizada, inclusive offline, com transposição e acompanhamento Live.

O produto já possui amplitude funcional relevante, identidade visual coerente, controles básicos de segurança e uma base de testes acima da média para seu porte. Foram aprovados 326 testes PHP, 6 testes unitários JavaScript e 6 testes E2E smoke. O fluxo público de landing, cadastro e login foi testado no navegador; login inválido retorna mensagem genérica adequada.

O lançamento público ainda não é recomendável. Há credenciais aparentemente produtivas mantidas em texto puro no workspace, mecanismos de debug de autenticação presentes no código, rate limiting limitado à sessão, ausência comprovada de política de privacidade/termos/exclusão de conta na jornada pública e nenhuma evidência operacional suficiente de backup restaurável, monitoramento, alertas, health check, rollback e resposta a incidentes. A suíte E2E completa também não terminou dentro de 5 minutos, impedindo um sinal integral de regressão.

Principais qualidades:

- Proposta específica e fácil de entender.
- Jornadas centrais bem mapeadas em documentação.
- Separação de papéis, CSRF e isolamento por banda previstos e testados em parte.
- Testes unitários e smoke aprovados.
- PWA, Live, ensaio e transposição formam uma proposta diferenciada.

Principais riscos:

- Gestão de segredos e prontidão operacional insuficientemente demonstradas.
- Conformidade e transparência para clientes reais incompletas.
- Dependências externas críticas não validadas ponta a ponta: Stripe, SMTP e download do YouTube.
- Regressão completa longa ou travada no ambiente auditado.

## 2. Veredito de produção

**Não está pronto para produção.**

Não foi comprovado um P0, mas os P1 de segredos, operação/recuperação e transparência legal precisam ser encerrados antes de clientes reais. Depois disso, a estratégia segura é beta fechado com poucas bandas, limites conservadores e monitoramento ativo.

## 3. Nota geral

| Dimensão | Nota |
|---|---:|
| Clareza da proposta | 9 |
| Facilidade de uso | 7 |
| Onboarding | 6 |
| Qualidade visual | 8 |
| Consistência | 7 |
| Acessibilidade | 6 |
| Funcionalidades | 8 |
| Estabilidade | 7 |
| Performance | 6 |
| Segurança | 5 |
| Privacidade | 3 |
| Confiabilidade | 5 |
| Qualidade técnica | 7 |
| Prontidão operacional | 3 |
| Aparência profissional | 8 |
| Autenticidade/ausência de aparência genérica de IA | 8 |
| Prontidão geral para produção | 5 |

## 4. Teste da avó de 80 anos

- Entenderia o SaaS: provavelmente sim; a frase “cifras, setlists e modo ao vivo” é concreta para músicos, mas “setlist”, “pitch”, “loop A/B”, “offline” e “host” exigem explicação.
- Saberá começar: sim, pelo CTA “Criar conta grátis”.
- Concluirá a principal tarefa: cadastro, provavelmente com pequena orientação; edição/Live/ensaio exigirão treinamento.
- Pedirá ajuda: confirmação por e-mail, escolha de banda, criação da primeira cifra, distinção entre setlist e roteiro, permissões e controles de ensaio.
- Nota geral desse perfil: 6/10.

| Fluxo | Nota | Classificação |
|---|---:|---|
| Entender a landing | 8 | Entende sem ajuda |
| Criar conta | 7 | Entende com pequena orientação |
| Entrar/recuperar senha | 7 | Entende com pequena orientação |
| Encontrar uma cifra | 7 | Entende com pequena orientação |
| Criar/editar cifra | 5 | Precisa de treinamento |
| Criar setlist/roteiro | 4 | Precisa de treinamento |
| Usar modo Live | 4 | Precisa de treinamento |
| Usar ensaio/pitch/loop | 3 | Provavelmente não concluiria |

Três mudanças prioritárias: substituir ou explicar termos técnicos; oferecer um assistente inicial de três passos; incluir ajuda contextual com texto junto aos ícones.

## 5. Mapa de funcionalidades

| Funcionalidade | Acesso/objetivo | Status auditado | Problemas/riscos | Nota |
|---|---|---|---|---:|
| Landing e planos | Público; explicar e converter | Funcionando completamente | Sem links públicos para termos e privacidade | 8 |
| Login/sessão/logout | Público/autenticado | Funcionando; smoke aprovado | Debug de autenticação permanece no código; rate limit por sessão | 7 |
| Cadastro e criação de banda | Público | Funcionando com limitações | E-mail real e ativação não validados; estado pós-cadastro depende de SMTP | 7 |
| Ativação/definição de senha | Link por e-mail | Não foi possível testar E2E | Dependência SMTP e senha mínima de 6 caracteres | 5 |
| Recuperação de senha | Público | Parcialmente testada por código/testes | Entrega real não validada | 6 |
| Seleção/criação/troca de banda | Autenticado | Coberta por testes existentes | Isolamento real com produção não validado manualmente | 7 |
| Administração de bandas | Master | Não testada manualmente | Alto impacto de permissão | 6 |
| Membros, convites e perfis | Administrador | Coberta parcialmente por E2E | Entrega de convite real não validada | 7 |
| Preferências | Autenticado | Documentada/testada | Persistência cross-device não comprovada | 7 |
| Lista/busca/filtro de cifras | Autenticado | Smoke aprovado | Carga alta não testada | 8 |
| CRUD/cópia de músicas | Gestor+ | Smoke parcial | Concorrência e clique duplicado não comprovados | 7 |
| Visualização/transposição | Autenticado | Smoke e unitários aprovados | Grande massa de cifras hardcoded permanece em JS legado | 8 |
| Apresentação | Autenticado | Coberta por testes existentes | Dispositivos reais/palco não validados | 7 |
| Setlists/playlists | Gestor+ | Coberta por suíte existente | Terminologia concorre com “roteiro” | 7 |
| Roteiros | Gestor+ | Coberta por suíte existente | Jornada exige aprendizado | 7 |
| Live host/seguidor | Gestor/básico | Coberta por testes, não manual | Falha de rede e escala multiusuário não comprovadas | 7 |
| Modo Ensaio | Autenticado | Funcionalidade parcialmente abandonada | Documentação informa elemento principal comentado e suíte legada | 4 |
| YouTube/áudio | Autenticado | Não determinístico | Dependência externa e disponibilidade | 4 |
| PWA/offline/sync | Autenticado | Projeto de testes separado | Não executado nesta auditoria; conflito/reconexão ainda é risco alto | 6 |
| Planos e limites | Administrador | Coberta por testes simulados | Stripe real não validado | 6 |
| Cobrança/webhook Stripe | Externo/admin | Simulado apenas | Checkout, renovação, cancelamento e reembolso reais não testados | 5 |
| Categorias | Gestor+ | CRUD smoke aprovado | Sem problema crítico observado | 8 |
| Proteções HTTP/CSRF | Global | Implementadas e testadas em parte | CSP permite inline; rate limit não distribuído | 6 |

Pré-requisitos gerais: conta ativa, sessão válida, banda selecionada e papel suficiente. Dependências centrais: MySQL, sessão PHP, SMTP, Stripe, navegador/IndexedDB e provedores do YouTube.

## 6. Problemas bloqueadores

**Nenhum bloqueador P0 foi comprovado durante a auditoria.**

O isolamento entre tenants possui testes e filtros documentados, mas não foi validado contra dados reais de produção; qualquer falha futura comprovada nesse controle deve ser promovida imediatamente a P0.

## 7. Problemas críticos

### P1-01 — Credenciais aparentemente produtivas em texto puro

- Impacto/probabilidade/esforço: comprometimento de banco, SMTP e chave de criptografia; alta se o arquivo escapar; esforço médio.
- Evidência: `prd.env` contém host, usuário, senha de banco, senha SMTP e chave de criptografia. `git ls-files -- prd.env` não retornou resultado; portanto não foi comprovado versionamento.
- Recomendação: rotacionar todos os valores, remover o arquivo do workspace compartilhado e usar cofre de segredos.
- Critério de aceite: valores antigos revogados, aplicação validada com novos segredos e secret scan limpo no repositório/histórico/artefatos.

### P1-02 — Recuperação operacional não demonstrada

- Impacto/probabilidade/esforço: indisponibilidade prolongada ou perda de dados após incidente; média; esforço médio.
- Evidência: há helpers de backup, mas não foram encontrados evidência de agenda, retenção, armazenamento externo, criptografia, alerta ou teste de restauração. Não há health check operacional documentado.
- Recomendação: automatizar backup, retenção e restauração ensaiada; monitorar aplicação, banco, filas/e-mail e webhook.
- Critério de aceite: restauração completa em ambiente isolado dentro de RPO/RTO definidos e evidenciada; health checks e alertas exercitados.

### P1-03 — Relação jurídica e privacidade incompleta na jornada pública

- Impacto/probabilidade/esforço: perda de confiança, reclamações e risco LGPD; alta para lançamento público; esforço médio.
- Evidência: landing, cadastro e rodapé oferecem contato, mas não exibem links para política de privacidade, termos de uso, tratamento/retenção de dados, exclusão de conta ou regras de cancelamento.
- Recomendação: publicar documentos válidos, registrar aceite quando necessário e implementar pedido de exclusão/exportação.
- Critério de aceite: links visíveis antes do cadastro, versionamento de aceite e fluxo testado de exclusão/exportação.

### P1-04 — Regressão completa não entrega feedback em tempo aceitável

- Impacto/probabilidade/esforço: defeitos escapam ou CI torna-se ignorado; média; esforço médio.
- Evidência: `npm run test:e2e` excedeu 300 segundos e foi encerrado; o reporter terminou com `EPIPE`. O smoke passou em 16,2 s.
- Recomendação: particionar por domínio/worker com isolamento, produzir progresso e artefatos independentes e estabelecer orçamento de duração.
- Critério de aceite: regressão principal conclui repetidamente no CI dentro do orçamento, com relatório final e zero testes pendurados.

## 8. Melhorias importantes

### P2-01 — Debug de autenticação presente no runtime

- Evidência: `AuthController.php:33-40` aceita `?debug=1/2` quando `APP_DEBUG=true`; `buildPasswordDebug()` expõe prefixo do hash e resultado de verificação (`:156-163`).
- Impacto: enumeração e informação sensível se configuração de produção for ativada por engano.
- Recomendação/aceite: remover os endpoints de debug do caminho HTTP; diagnóstico apenas em logs protegidos, sem hash/dados pessoais.

### P2-02 — Rate limiting contornável

- Evidência: documentação informa contador por sessão e reconhece ausência de limite por IP/múltiplas sessões.
- Impacto: força bruta, enumeração e abuso de cadastro/recuperação.
- Recomendação/aceite: limite distribuído por identidade+IP, backoff, observabilidade e testes de múltiplas sessões.

### P2-03 — Modo Ensaio anunciado, mas interface principal está desativada

- Evidência: `docs/testes.md` informa que `#btnAtivarEnsaio` está comentado e as suítes foram movidas para legado; a landing anuncia “Ensaio com YouTube”.
- Impacto: diferença entre promessa e entrega, reduz confiança.
- Recomendação/aceite: reativar e incluir na regressão ou remover a promessa até estar utilizável.

### P2-04 — Integrações comerciais não validadas ponta a ponta

- Evidência: Stripe é simulado e download do YouTube é declarado não determinístico; SMTP real não foi testado.
- Impacto: ativação, cobrança e ensaio podem falhar para clientes.
- Recomendação/aceite: testes controlados em sandboxes oficiais, alertas para falha e runbooks de reconciliação.

### P2-05 — Senha de ativação aceita apenas seis caracteres

- Evidência: UI de definição/reset informa “Mínimo 6 caracteres”; testes usam credencial padrão fraca no ambiente local.
- Impacto: contas mais vulneráveis a adivinhação/reuso.
- Recomendação/aceite: mínimo moderno, bloqueio de senhas comprometidas e casos automatizados.

### P2-06 — Ausência de validação de carga e concorrência

- Evidência: não foram encontrados resultados de teste de carga; E2E usa um worker e banco compartilhado.
- Impacto: Live, sync e listas podem degradar ou duplicar operações.
- Recomendação/aceite: metas SLO, cenários multiusuário, idempotência e concorrência validados.

## 9. Melhorias recomendadas

- P3-01: explicar “setlist”, “pitch”, “loop A/B”, “host” e “offline” em linguagem de músico iniciante.
- P3-02: onboarding orientado ao primeiro valor: criar/abrir uma cifra, transpor e compartilhar com a banda.
- P3-03: estado vazio com exemplo realista e CTA único.
- P3-04: padronizar contratos JSON (`ok/error` versus `sucesso/mensagem`).
- P3-05: reduzir CSP inline e avançar para nonces/hashes.
- P3-06: adicionar `autocomplete="name"` e `autocomplete="organization"` ao cadastro.
- P3-07: validar contraste, foco, zoom 200% e leitor de tela com auditoria dedicada.

## 10. Evoluções futuras

- P4-01: telemetria de ativação, tempo até primeira cifra e retenção por coorte.
- P4-02: importação guiada de repertório e templates específicos por tipo de banda.
- P4-03: histórico/versionamento de cifra e resolução colaborativa de conflitos.
- P4-04: central de ajuda com vídeos curtos e modo simplificado.

## 11. Problemas de clareza e UX

Primeiros cinco minutos: a proposta é compreendida em menos de 30 segundos e o cadastro exige três campos. O momento de valor provável é visualizar a primeira cifra e transpô-la; sem dados pré-carregados/onboarding comprovado, o usuário pode precisar criar conteúdo antes, elevando o abandono.

| Texto atual | Problema/interpretação | Sugestão |
|---|---|---|
| “Setlists por data” | Termo em inglês | “Repertórios do show, organizados por data” |
| “Modo ao vivo” | Não deixa explícito quem controla | “Apresentação sincronizada: o líder troca e todos acompanham” |
| “Controle de pitch, loop A-B” | Jargão técnico | “Ajuste o tom e repita um trecho do áudio” |
| “Funciona offline” | Pode sugerir que tudo funciona sem rede | “Consulte cifras salvas sem internet; sincroniza quando a conexão voltar” |
| “Usuário ou senha inválidos.” | Seguro, porém não orienta recuperação | “E-mail ou senha incorretos. Tente novamente ou redefina sua senha.” |

Contagem aproximada até o primeiro valor: landing → cadastro → e-mail → definir senha → entrar/selecionar banda → criar/abrir cifra: 6–9 telas/decisões, 8–15 cliques e 3–8 minutos, dependendo da entrega de e-mail.

## 12. Sinais de aparência gerada por IA

Não há sinal forte de conteúdo artificial. A marca, o trocadilho “qual tom mesmo?” e o foco em palco/culto/banda são específicos. Notas: autenticidade 8, consistência 8, personalidade 8, confiança 7, adequação 8, aparência profissional 8.

Sinais menores:

- Cards repetem estrutura e emojis genéricos. Impacto baixo. Substituir emojis por iconografia própria e evidência visual do produto.
- “Tudo que sua banda precisa” é promessa ampla. Trocar por “Do ensaio ao palco, sem perder o tom nem a ordem”.
- A landing promete Ensaio, enquanto a interface correspondente está documentada como desativada. Esse é o maior sinal de produto montado/inacabado; alinhar marketing e disponibilidade.

## 13. Segurança e privacidade

Comprovado:

- CSRF, papéis, sessão, headers e filtros por banda existem no código/documentação e possuem cenários automatizados.
- Login inválido não enumera usuário na mensagem.
- Credenciais produtivas ficam em arquivo local em texto puro.
- Debug de autenticação pode expor informações se `APP_DEBUG=true`.
- CSP ainda permite inline e rate limit é por sessão.

Possível/não comprovado:

- Não foi provado acesso cruzado entre tenants.
- Não foram executados pentest, varredura de dependências, DAST ou teste distribuído de força bruta.
- Cookies só ficam `Secure` sob HTTPS; produção HTTPS não foi inspecionada.
- Retenção, anonimização, encarregado, base legal, exportação e exclusão LGPD não foram demonstrados.
- Logs e backups não foram inspecionados em infraestrutura real.

## 14. Prontidão técnica e operacional

O sistema tem estrutura razoável para operação: variáveis de ambiente, migrations/schema, tratamento central, testes, PWA e documentação. Contudo, não foi demonstrado que pode ser monitorado, restaurado e suportado com segurança.

Ausências de evidência: CI/CD executado, deploy reproduzível, rollback, health/readiness checks, APM, métricas, alertas, rotação de logs, backup externo, restauração ensaiada, RPO/RTO, runbook de Stripe/SMTP, gestão de incidentes e teste de carga. Há dependências locais explícitas nos testes (`C:/xampp/php/php.exe`, localhost, banco compartilhado) e scripts de setup com chaves fixas; os scripts estão fora do document root recomendado, mas devem ser excluídos do artefato de produção.

## 15. Cobertura da auditoria

Testado:

- Landing, cadastro vazio, login e credenciais inválidas no navegador.
- Landing em viewport móvel 390×844: sem overflow horizontal ou textos cortados detectados.
- Inventário de rotas, documentação, configuração, autenticação, segurança, APIs e testes.
- PHPUnit: 326 testes/678 asserções, todos aprovados em 16,675 s.
- JavaScript unitário: 6/6 aprovados.
- E2E smoke: 6/6 aprovados em 16,2 s, incluindo login, home, cifra, sync e CRUD de categoria.
- Evidências visuais em `docs/evidencias-auditoria/`.

Não testado ou incompleto:

- Produção, HTTPS/domínio, banco real e isolamento real entre clientes.
- Cadastro completo por e-mail, ativação, recuperação e convite reais.
- Stripe real, cancelamento, alteração de plano, reembolso e falhas de webhook.
- PWA/offline, ensaio/YouTube, dispositivos físicos, leitor de tela e contraste instrumental; outras telas internas móveis não foram verificadas manualmente.
- Carga, concorrência, duas abas, rede lenta, sessão expirada manual e falhas parciais.
- Backup/restauração, observabilidade, alertas e rollback.
- Suíte E2E completa: excedeu 300 s e foi interrompida.

Limitações: não foram fornecidas URL produtiva nem credenciais dedicadas de auditoria; ações destrutivas e deploy foram excluídos; conclusões operacionais são “não comprovadas”, não afirmações de inexistência.

## 16. Plano de ação

### Antes de qualquer produção

| Prioridade | Ação | Problema | Esforço | Dependências/critério |
|---|---|---|---|---|
| P1 | Rotacionar e retirar segredos do workspace | P1-01 | Médio | Cofre; secret scan limpo e credenciais antigas revogadas |
| P1 | Implantar backup, restauração, health e alertas | P1-02 | Médio | Infra; restore ensaiado dentro de RPO/RTO |
| P1 | Publicar termos/privacidade/exclusão | P1-03 | Médio | Jurídico+Produto; aceite e fluxos testados |
| P1 | Tornar regressão completa determinística | P1-04 | Médio | QA/Engenharia; CI verde repetidamente |
| P2 | Remover debug HTTP de autenticação | P2-01 | Baixo | Build/testes aprovados, rota debug inexistente |

### Antes de liberar para os primeiros clientes

| Prioridade | Ação | Esforço | Critério |
|---|---|---|---|
| P2 | Validar SMTP e ativação em sandbox | Médio | cadastro/recuperação/convite observáveis ponta a ponta |
| P2 | Validar Stripe em sandbox e reconciliação | Médio | eventos idempotentes e falhas alertadas |
| P2 | Decidir e alinhar Modo Ensaio | Médio | utilizável e testado ou removido do marketing |
| P2 | Rate limit distribuído | Médio | abuso multi-sessão bloqueado sem afetar uso legítimo |
| P2 | Teste de isolamento entre duas bandas | Baixo | leitura/escrita cruzadas retornam 403/404 em toda API |

### Primeiros 30 dias

- Medir ativação, erros, latência e disponibilidade.
- Executar testes de acessibilidade com usuários e ferramentas.
- Melhorar onboarding, estados vazios e ajuda contextual.
- Exercitar runbooks de incidente, restauração e webhook.

### Próximos 90 dias

- Padronizar APIs e reduzir código legado.
- Testes de carga/concorrência e SLOs.
- Fortalecer CSP, gestão de dependências e DAST recorrente.
- Evoluir histórico de conteúdo e resolução de conflitos offline.

## 17. Checklist final de liberação

| Item | Status | Responsável sugerido | Evidência necessária | Bloqueia produção |
|---|---|---|---|---|
| Segredos rotacionados e em cofre | Pendente | DevOps/Segurança | secret scan + revogação | Sim |
| Backup restaurável | Pendente | DevOps/DBA | relatório de restore | Sim |
| Monitoramento/alertas/health | Pendente | SRE/Engenharia | alertas disparados | Sim |
| Termos, privacidade e exclusão | Pendente | Jurídico/Produto | páginas e teste E2E | Sim |
| Regressão completa verde | Pendente | QA/Engenharia | relatório CI | Sim |
| Debug de autenticação removido | Pendente | Backend | teste de rota | Sim |
| Isolamento multi-tenant integral | Parcial | Segurança/QA | matriz de APIs | Sim |
| SMTP/ativação/recuperação | Não testado | Backend/QA | teste sandbox | Sim |
| Stripe ponta a ponta | Não testado | Produto/Backend | teste sandbox | Sim para planos pagos |
| PWA/offline | Não testado nesta execução | Frontend/QA | projeto PWA verde | Não para beta online; sim se prometido |
| Acessibilidade crítica | Parcial | UX/QA | auditoria WCAG | Não para beta restrito |
| Suporte e runbooks | Pendente | Operações | escala e procedimentos | Sim |

## 18. Parecer final

**Eu colocaria este SaaS em produção hoje? Não.**

A base do produto é promissora e os fluxos essenciais mostram bom sinal, mas lançar hoje aceitaria riscos desnecessários sobre segredos, recuperação de dados, suporte operacional, conformidade e integrações críticas. Primeiro encerraria os P1, removeria o debug, obteria uma regressão completa verde e validaria isolamento, SMTP e Stripe em sandbox. A estratégia mais segura é um beta fechado, online-first, com poucas bandas convidadas, feature flags para recursos externos, backups verificados e monitoramento humano diário.

---

# Segunda auditoria — UX e layout

Data: 2026-08-03  
Ambiente: `http://localhost:8090`  
Escopo: experiência pública e autenticada, arquitetura da informação, formulários, responsividade, acessibilidade observável, PWA e layout.  
Evidências: `docs/evidencias-auditoria/segunda-auditoria-ux/`

## UX 1. Resumo executivo

A landing comunica o propósito em poucos segundos e conduz claramente para cadastro ou login. A experiência autenticada, porém, apresenta fricções graves: dados técnicos de testes dominam as listagens, termos e ações são inconsistentes, não há onboarding orientando o primeiro valor e partes importantes do layout móvel ficam comprimidas ou ultrapassam a largura útil.

O maior problema de experiência observado é a tela de Setlists no celular: campos, textos e controles são comprimidos em uma coluna muito estreita, tornando leitura e preenchimento impraticáveis. A tela de plano também ultrapassa a largura disponível. A página inicial exibe 57 músicas e dezenas de roteiros com nomes de fixtures como `__TESTE_SAVE_SEM_ID_RESPOSTA__`, `__HTML_ROTEIRO__` e conteúdo literal de teste XSS. Isso torna a navegação confusa e transmite aparência de ambiente inacabado.

Qualidades comprovadas:

- proposta pública específica para bandas;
- CTAs claros na landing;
- login simples e mensagem segura para credenciais inválidas;
- labels presentes na maioria dos formulários;
- página de música aprovada em 11 cenários visuais;
- PWA aprovada em 26 cenários automatizados, inclusive internet ruim, snapshot inválido e duas bandas.

Impacto para o negócio: usuários podem abandonar na primeira tela autenticada, desconfiar do produto ao ver fixtures e falhar ao criar repertórios no celular. Recomendação: corrigir os problemas UX-1 antes de beta com clientes e executar nova validação visual das telas internas, não somente da visualização de cifras.

## UX 2. Nota geral

| Dimensão | Nota |
|---|---:|
| Entendimento do produto | 9 |
| Facilidade para começar | 7 |
| Onboarding | 4 |
| Navegação | 6 |
| Arquitetura da informação | 6 |
| Clareza dos textos | 6 |
| Formulários | 6 |
| Prevenção de erros | 6 |
| Recuperação de erros | 6 |
| Consistência | 5 |
| Eficiência | 6 |
| Acessibilidade | 5 |
| Responsividade | 4 |
| Confiança | 4 |
| Facilidade para usuários idosos | 4 |
| Satisfação geral | 5 |

## UX 3. Veredito

**Experiência funcional, mas com fricções importantes.**

Os fluxos existem e a base visual é coerente, mas o layout móvel de Setlists, a contaminação visual por dados de teste, a ausência de onboarding e a baixa clareza de alguns estados impedem considerar a experiência pronta para clientes reais.

## UX 4. Teste dos cinco segundos

- Entende o que é: sim; “Cifras, setlists e modo ao vivo” explica a categoria.
- Entende para quem serve: sim; bandas e músicos.
- Entende o que fazer: sim; “Criar conta grátis” e “Já tenho conta”.
- Primeira impressão: produto focado, moderno e específico.
- Dúvidas: significado de setlist, pitch, loop A-B, alcance exato do offline e diferença entre setlist, playlist e roteiro.
- Classificação: clareza imediata na landing; compreensível apenas após exploração dentro do produto.

## UX 5. Primeiros cinco minutos

O visitante entende a proposta, cria conta com três campos e encontra login/recuperação. Depois de entrar, encontra músicas, setlists, editor, categorias, usuários, bandas e configurações. Não existe caminho inicial claramente recomendado nem progresso de onboarding. A home apresenta simultaneamente sincronização, upgrade, Live, offline, menus laterais e uma lista extensa, elevando a carga cognitiva.

Momento de valor: abrir uma cifra e transpô-la. Caminho estimado para conta nova: landing → cadastro → ativação por e-mail → login → banda → criar/abrir cifra, de 6 a 9 telas e aproximadamente 8 a 15 interações. O principal risco de abandono ocorre após o login, quando não há instrução “adicione sua primeira cifra”.

## UX 6. Pessoa de aproximadamente 80 anos

- Entende o produto: parcialmente, se for músico.
- Sabe começar: consegue usar o CTA público.
- Conclui a tarefa principal: provavelmente apenas com orientação.
- Precisa de ajuda: seleção de banda, diferença entre repertório/playlist/roteiro, preparação offline, Live e editor.
- Termos difíceis: setlist, playlist, Live, pitch, loop A-B, host/líder, cache e revisão.
- Elementos que geram medo: “Limpar Cache”, “Resetar dados”, “Deletar” e indicadores técnicos sem explicação.
- Nota: 4/10.
- Três mudanças prioritárias: onboarding guiado; linguagem sem termos técnicos; controles móveis com fonte e área clicável adequadas.

## UX 7. Mapa da jornada

| Etapa | Emoção/dúvida provável | Obstáculo | Oportunidade |
|---|---|---|---|
| Landing | Interesse; “serve para minha banda?” | Termos em inglês | Exemplos reais e linguagem local |
| Cadastro | Expectativa | Não explica claramente a ativação | Informar próximos passos antes do envio |
| Ativação | Incerteza | Dependência de e-mail | Reenvio e status visível |
| Login | Segurança | Sem demonstração alternativa | Mensagem de recuperação acionável |
| Primeira entrada | Sobrecarga | Muitos recursos sem prioridade | Checklist de três passos |
| Primeira cifra | Valor | Lista contaminada e extensa | Estado vazio/CTA/importação |
| Setlist | Organização | Layout móvel quebrado e termos inconsistentes | Fluxo móvel dedicado |
| Live/offline | Confiança no palco | Estados técnicos | Status simples e orientado à ação |
| Plano | Intenção de compra | Overflow e cobrança manual por PIX | Resumo claro, responsivo e rastreável |
| Suporte/saída | Insegurança | Apenas e-mail; exclusão/cancelamento pouco visíveis | Central de ajuda e fluxos explícitos |

## UX 8. Auditoria dos fluxos

| Fluxo | Passos/telas | Avaliação | Nota | Recomendação principal |
|---|---|---|---:|---|
| Entender e cadastrar | Landing → cadastro; 2 telas, 3 campos | Simples e intuitivo | 8 | Explicar ativação e privacidade |
| Login | 1 tela, 2 campos, 1 envio | Simples | 8 | Tornar recuperação parte da mensagem de erro |
| Encontrar música | Home → pesquisa → cifra | Funcional, mas ruidoso | 5 | Remover fixtures e paginar/agrupar |
| Criar/editar música | Editor → dados → cifra → salvar | Compreensível para músico experiente | 6 | Onboarding do editor e alerta de alterações |
| Criar Setlist | Setlists → nome/data → adicionar músicas → salvar | Propenso a erros no celular | 3 | Redesenhar fluxo responsivo |
| Gerenciar usuários | Usuários → novo/editar/importar → salvar | Compreensível | 7 | Explicar papéis e consequência das permissões |
| Configurar apresentação/offline | Configurações/menu → escolher/preparar | Técnico | 5 | Traduzir status e separar ações perigosas |
| Contratar plano | Plano → escolher → PIX/WhatsApp | Funcional, mas transmite operação manual | 5 | Corrigir mobile e explicar confirmação/prazo |

## UX 9. Problemas UX-0

**Nenhum bloqueador UX-0 foi comprovado em todos os dispositivos.**

O fluxo móvel de Setlists se aproxima de bloqueio, mas precisa ser confirmado em dispositivo físico; foi classificado como UX-1 com base no screenshot e overflow medido.

## UX 10. Problemas UX-1

### UX-1-01 — Setlists praticamente inutilizável no celular

- Rota: `/src/backend/editor/editorplaylist.php`, viewport 390×844.
- Perfis: todos, especialmente idosos e usuários móveis.
- Evidência: `src-backend-editor-editorplaylist-php-mobile.png`; documento com `scrollWidth=398` e `clientWidth=375`; formulário comprimido, labels quebradas palavra por palavra e campos com largura mínima.
- Reprodução: entrar → Setlists → usar viewport móvel.
- Impacto/frequência: alto e recorrente para quem monta repertório no celular.
- Recomendação: substituir colunas fixas por fluxo vertical, campos em largura total e lista de músicas em cards; manter CTA fixo sem cobrir conteúdo.
- Critério: nenhuma palavra quebrada artificialmente, nenhum overflow e tarefa concluída em 320–430 px.
- Esforço: médio.

### UX-1-02 — Dados técnicos de teste dominam a experiência autenticada

- Rotas: `/index.php`, editor, plano e seletores.
- Perfis: todos.
- Evidência: banda `<script>window.__xss_banda=1</script>`, roteiros `__HTML_ROTEIRO__`, 57 músicas com nomes repetidos de fixtures e limites incoerentes como 2500/1 bandas.
- Impacto: destrói confiança, dificulta encontrar conteúdo e faz o produto parecer comprometido ou inacabado.
- Recomendação: isolar banco E2E por execução, impedir testes no ambiente de demonstração e adicionar limpeza determinística.
- Critério: ambiente de auditoria/cliente contém apenas dados realistas e nenhum prefixo de fixture.
- Esforço: médio.

### UX-1-03 — Página de plano rompe a largura móvel

- Rota: `/plano.php`, viewport 390×844.
- Evidência: `scrollWidth=404`, `clientWidth=375`; card e textos ultrapassam o viewport.
- Impacto: reduz legibilidade e confiança exatamente no fluxo de pagamento.
- Recomendação: remover larguras mínimas, permitir quebra controlada e testar valores/nomes longos.
- Critério: zero overflow em 320 px e todas as ações de pagamento visíveis.
- Esforço: baixo/médio.

## UX 11. Problemas UX-2

- **UX-2-01 — Falta de onboarding:** não existe caminho recomendado após login. Critério: checklist opcional conduz à primeira cifra em até três minutos.
- **UX-2-02 — Terminologia inconsistente:** “Setlists”, “PlayLists”, “Playlist”, “Roteiros” e “repertório” concorrem. Critério: um termo principal e explicações consistentes.
- **UX-2-03 — Áreas clicáveis abaixo de 44 px:** topnav, fechar, checkbox e toolbar do editor mediram entre 20 e 40 px. Critério: controles essenciais com pelo menos 44×44 px.
- **UX-2-04 — Hierarquia da home:** não há `h1`; painéis “Menu” e “PlayLists” competem com a lista de músicas. Critério: título e ação principal evidentes, drawers fechados por padrão.
- **UX-2-05 — Estados offline excessivamente técnicos:** “revisão 0”, “app 3.1.0”, “Pacote não validado” e “sincronizado nunca” não orientam. Critério: estado, consequência e próxima ação em linguagem comum.
- **UX-2-06 — Botões genéricos:** “Salvar”, “Adicionar”, “Atualizar”, “Resetar dados” e “Copiar” perdem contexto. Critério: nomes descrevem o resultado.
- **UX-2-07 — Categoria sem label programático:** campo depende apenas de placeholder. Critério: label persistente associado.
- **UX-2-08 — Pagamento manual pouco transparente:** PIX seguido de envio por WhatsApp não informa prazo, confirmação, segurança ou cancelamento. Critério: processo e estado da solicitação explícitos.

## UX 12. Melhorias UX-3

- Preservar pesquisa, filtros e posição ao voltar de uma cifra.
- Adicionar indicador de alterações não salvas no editor.
- Oferecer duplicação, atalhos e ações em lote para usuários frequentes.
- Separar configurações comuns de ações destrutivas.
- Mostrar exemplos realistas nos estados vazios.
- Adicionar ajuda contextual para papéis, Live e preparação offline.

## UX 13. Evoluções UX-4

- Importação assistida de cifra por conteúdo colado.
- Histórico de versões e restauração de edição.
- Atalhos configuráveis e comandos rápidos.
- Onboarding adaptado por papel: músico, líder ou administrador.

## UX 14. Problemas de conteúdo

| Atual | Recomendado | Justificativa |
|---|---|---|
| Setlists por data | Repertórios do show, organizados por data | Remove anglicismo |
| PlayLists | Repertórios | Unifica nomenclatura |
| Pacote não validado | Ainda não disponível offline | Explica consequência |
| Preparar para offline | Baixar repertório para usar sem internet | Explica resultado |
| Limpar Cache | Remover dados baixados deste dispositivo | Reduz medo e ambiguidade |
| Resetar dados | Apagar dados offline deste dispositivo | Explicita escopo |
| Salvar | Salvar alterações da música/setlist | Informa consequência |
| Adicionar | Adicionar esta música ao repertório | Dá contexto |
| Live desconectada | Apresentação sincronizada desativada | Linguagem mais compreensível |

## UX 15. Problemas de navegação

- Dois botões de menu por ícone aparecem no topo sem texto visível.
- Home contém drawers de Menu e Playlists, enquanto Setlists também existe na navegação superior.
- Ausência de breadcrumb nas páginas profundas do backend.
- Editor mistura lista, criação e edição na mesma tela sem indicar claramente o estado atual.
- A volta de telas internas não demonstra preservação consistente de pesquisa e posição.

## UX 16. Problemas de formulários

- Setlists móvel comprime campos e labels até perder legibilidade.
- Campo de categoria usa placeholder como única instrução.
- Editor não apresenta indicação observável de alterações não salvas.
- Botões de toolbar do editor usam termos em inglês como Undo, Redo, Italic e Source code.
- Papéis de usuário não explicam capacidades antes da seleção.
- Ações de salvar não deixam claro qual objeto será alterado.

## UX 17. Problemas de acessibilidade

Impacto alto:

- fluxo de Setlists móvel ilegível;
- áreas clicáveis menores que 44 px;
- home sem `h1` e com estrutura iniciando em `h2`.

Impacto moderado:

- imagens da marca na área autenticada possuem `alt` vazio;
- modal de playlist possui `role=dialog`, mas não foi comprovado `aria-modal` nem gestão de foco;
- campo de categoria e campo interno de playlist sem label associado;
- teste manual de foco via automação foi inconclusivo e precisa ser repetido com teclado/leitor de tela físico.

Pontos positivos: `lang=pt-BR`, busca com nome acessível e vários botões de ícone possuem `aria-label`.

## UX 18. Aparência genérica ou artificial

A landing possui personalidade suficiente e linguagem ligada a bandas. O interior perde autenticidade por três fatores: mistura de termos em português/inglês, dados artificiais de teste e componentes legados com estruturas diferentes. O problema não é “parecer IA”, mas parecer uma composição incompleta de versões do produto.

Antes: “Tudo que sua banda precisa”.  
Depois: “Do ensaio ao palco, com o repertório no tom e na ordem certos.”

Antes: “Pacote não validado | Online | preparado em nunca | revisão 0”.  
Depois: “Este repertório ainda não foi baixado. Baixe agora para usar sem internet.”

## UX 19. Ganhos rápidos

| Problema | Mudança | Impacto | Esforço | Critério |
|---|---|---|---|---|
| Termos inconsistentes | Padronizar para “Repertório” | Clareza | Baixo | Um termo em toda UI |
| Botões genéricos | Nomear consequências | Menos erros | Baixo | Nenhum CTA crítico genérico |
| Campo sem label | Adicionar label persistente | Acessibilidade | Baixo | Associação programática |
| Alvos pequenos | Aumentar para 44 px | Mobile/idosos | Baixo | Matriz móvel aprovada |
| Status offline técnico | Reescrever status | Confiança | Baixo | Usuário entende ação seguinte |
| Fixtures visíveis | Isolar e limpar dados E2E | Confiança | Médio | Ambiente sem dados técnicos |

## UX 20. Plano de melhoria

### Correções imediatas

1. Corrigir layout móvel de Setlists.
2. Isolar e limpar dados E2E.
3. Corrigir overflow da página de plano.

### Próxima versão

1. Implementar onboarding para primeira cifra.
2. Unificar repertório/setlist/playlist/roteiro.
3. Ajustar áreas clicáveis e hierarquia semântica.
4. Reescrever estados offline e pagamento.

### Refinamentos

1. Preservar contexto de navegação.
2. Alertar alterações não salvas.
3. Melhorar eficiência para usuários frequentes.

### Evolução futura

1. Importação assistida.
2. Histórico de versões.
3. Onboarding por papel.

## UX 21. Checklist de validação

- [ ] Setlists funciona entre 320 e 430 px sem overflow ou palavras quebradas.
- [ ] Plano funciona em 320 px com nomes e valores longos.
- [ ] Nenhuma fixture aparece fora do banco isolado de testes.
- [ ] Home possui `h1`, ação principal e drawers fechados por padrão.
- [ ] Todos os controles essenciais medem pelo menos 44×44 px.
- [ ] Todos os campos possuem label persistente e associado.
- [ ] Termos de repertório são consistentes.
- [ ] Estados offline explicam situação, consequência e próxima ação.
- [ ] Editor alerta alterações não salvas.
- [ ] Pesquisa e posição são preservadas ao voltar.
- [ ] Fluxos críticos são concluídos apenas por teclado.
- [ ] Zoom de 200% não oculta ações.
- [ ] Testes visuais incluem Setlists, plano, usuários, configurações e home.

## UX 22. Parecer final

**Um usuário novo conseguiria utilizar este SaaS sozinho? Somente com orientação.**

A landing e o login são claros, mas a primeira entrada não conduz ao primeiro valor, a terminologia exige conhecimento prévio e o ambiente autenticado auditado contém dados técnicos que dificultam reconhecer o conteúdo real.

**Uma pessoa de aproximadamente 80 anos conseguiria utilizar este SaaS? Provavelmente não concluiria os fluxos principais sem treinamento.** Os maiores obstáculos são termos técnicos, áreas clicáveis pequenas, ações potencialmente destrutivas pouco explicadas e o layout móvel de Setlists.

## UX 23. Seção específica de layout

### Evidências observadas

| Tela | Desktop | Mobile 390×844 | Resultado |
|---|---|---|---|
| Landing | Sem overflow | Sem overflow | Aprovada |
| Home | Sem overflow global, mas drawers competem com conteúdo | Drawers ficam fora da tela quando fechados; alvos pequenos | Parcial |
| Editor de músicas | Estrutura estável | Sem overflow global; toolbar com controles de 28 px | Parcial |
| Setlists | Sem overflow em 1280 px | `398 > 375`; formulário severamente comprimido | Reprovada |
| Usuários | Sem overflow | Sem overflow global; ações por ícone | Parcial |
| Plano | Sem overflow em 1280 px | `404 > 375`; card ultrapassa viewport | Reprovada |
| Configurações | Sem overflow em 1280 px | `388 > 375`; menu encosta/ultrapassa margem | Reprovada |
| Visualização da cifra | 11 testes visuais aprovados | Cenários 375×667 e 667×375 aprovados | Aprovada |

### Consistência e hierarquia

- Design escuro, roxo e tipografia formam identidade coerente.
- Topnav concentra marca, banda, status, upgrade e dois menus, ficando denso no celular.
- Títulos e ações não seguem um padrão único entre editor, usuários, categorias e plano.
- Setlists mantém composição de desktop no celular em vez de reorganizar a tarefa.
- Elementos destrutivos vermelhos têm destaque adequado, mas “Deletar” deve ser “Excluir repertório”.
- A página de plano usa cards visualmente coerentes, porém o conteúdo longo não se adapta à largura.

### Testes automatizados executados

- `npm run test:e2e:visual`: **11/11 aprovados em 153,9 s**; cobertura concentrada na visualização de cifras e rolagem.
- `npm run test:e2e:pwa`: **26/26 aprovados em 141,7 s**; inclui snapshot, internet ruim, duas bandas, isolamento e service worker real.

Os testes aprovados não contradizem os problemas encontrados: a suíte visual atual não cobre Setlists, plano, usuários, configurações e home na matriz completa de viewports.

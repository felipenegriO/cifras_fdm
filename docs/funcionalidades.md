# Catálogo de funcionalidades

| ID | Funcionalidade | Estado | Documento | Implementação principal |
|---|---|---|---|---|
| F-001 | Landing pública e oferta | Implementado | [Acesso](dominios/acesso-e-onboarding.md) | `public/landing.php` |
| F-002 | Login, sessão e logout | Implementado | [Acesso](dominios/acesso-e-onboarding.md) | `AuthController`, `login.php`, `logout.php` |
| F-003 | Cadastro com criação de banda | Implementado | [Acesso](dominios/acesso-e-onboarding.md) | `RegisterController` |
| F-004 | Ativação e definição de senha | Implementado | [Acesso](dominios/acesso-e-onboarding.md) | `definir-senha.php` |
| F-005 | Recuperação de senha | Implementado | [Acesso](dominios/acesso-e-onboarding.md) | `esqueci-senha.php`, `reset-senha.php` |
| F-006 | Seleção e troca de banda | Implementado | [Bandas](dominios/bandas-e-usuarios.md) | `select-banda.php`, `selecionar.php` |
| F-007 | Criação de banda pelo usuário | Implementado | [Bandas](dominios/bandas-e-usuarios.md) | `api/bandas/criar.php` |
| F-008 | Administração global de bandas | Implementado | [Bandas](dominios/bandas-e-usuarios.md) | `bandas.php`, `salvar_banda.php` |
| F-009 | Gestão de membros e convites | Implementado | [Bandas](dominios/bandas-e-usuarios.md) | `users.php`, `salvar_user.php` |
| F-010 | Preferências do usuário | Implementado | [Bandas](dominios/bandas-e-usuarios.md) | `config.php`, `salvar_config.php` |
| F-011 | Lista e busca de cifras | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `index.php`, `Views/index.php` |
| F-012 | Cadastro, edição, cópia e exclusão de música | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `editor/api.php` |
| F-013 | Visualização e transposição de cifra | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `music.php`, `musicas.js` |
| F-014 | Apresentação de cifra e ajustes visuais | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `cifro-presentation.js`, `config.php` |
| F-015 | Gestão de setlists/playlists | Implementado | [Setlists](dominios/setlists-e-roteiros.md) | `editorplaylist.php`, `salvar_playlists.php` |
| F-016 | Exibição de setlists por validade | Implementado | [Setlists](dominios/setlists-e-roteiros.md) | `Views/index.php`, `PlaylistRepository` |
| F-017 | Gestão de roteiros | Implementado | [Roteiros](dominios/setlists-e-roteiros.md) | `editorroteiro.php`, `salvar_roteiros.php` |
| F-018 | Visualização de roteiro | Implementado | [Roteiros](dominios/setlists-e-roteiros.md) | `roteiro.php` |
| F-019 | Assumir host Live | Implementado | [Live](dominios/modo-live.md) | `api/live/host.php`, `live.js` |
| F-020 | Seguir música e rolagem Live | Implementado | [Live](dominios/modo-live.md) | `api/live/status.php`, `live.js` |
| F-021 | Publicar estado Live | Implementado | [Live](dominios/modo-live.md) | `api/live/update.php` |
| F-022 | Reprodução de áudio para ensaio | Implementado | [Ensaio](dominios/modo-ensaio.md) | `src/js/rehearsal/*` |
| F-023 | Loop A/B e controle de pitch | Implementado | [Ensaio](dominios/modo-ensaio.md) | `rehearsal.audio.js`, `rehearsal.pitch.js` |
| F-024 | Importação de áudio do YouTube | Implementado com dependência externa | [Ensaio](dominios/modo-ensaio.md) | `download-yt-audio.php` |
| F-025 | Instalação PWA, splash instalada e cache do shell | Implementado | [Offline](dominios/offline-pwa-sync.md) | `manifest.json`, `service-worker.js`, `pwa-splash.js` |
| F-026 | Dados offline por banda | Implementado | [Offline](dominios/offline-pwa-sync.md) | `cifro-sync.js`, `api/sync/*` |
| F-027 | Página e limites de plano | Implementado | [Planos](dominios/planos-e-cobranca.md) | `plano.php`, `bootstrap.php` |
| F-028 | Cobrança e atualização via Stripe | Implementado | [Planos](dominios/planos-e-cobranca.md) | `api/stripe/webhook.php` |
| F-029 | Proteções HTTP, CSRF e rate limit | Implementado | [Segurança](seguranca-e-permissoes.md) | `bootstrap.php`, `router.php` |
| F-030 | Gestão e filtro de categorias | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `categorias.php`, `categorias/api.php` |
| F-031 | Central de Ajuda, guias contextuais e glossário offline | Implementado | [Ajuda](dominios/ajuda-e-suporte.md) | `ajuda.php`, `HelpCenterService`, `cifro-help.js` |
| F-032 | Capotraste e transposição de instrumento | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `TransposicaoInstrumento`, `chords.js`, `music.php`, `config.php` |
| F-033 | Convite de banda por link compartilhável | Implementado | [Bandas](dominios/bandas-e-usuarios.md) | `BandaConviteFlow`, `api/bandas/convite.php`, `convite.php` |

## F-032 — Capotraste e transposição de instrumento

O mesmo número serve a todos os instrumentos: **quanto o instrumento sobe em relação às formas mostradas na tela**. `+2` é capotraste na 2ª casa para o violonista e transpose `+2` para o tecladista — os dois leem as mesmas formas e sai o mesmo som. Negativo existe só para quem transpõe eletronicamente. O rótulo muda conforme o instrumento escolhido pelo usuário: **Capotraste**, **Transpose** ou **Transposição**.

A cifra fica sempre guardada no tom soante; o deslocamento é aplicado na exibição. Por isso o indicador de **Tom** mostra sempre o som que sai, e não o das formas — é dele que o repertório, o modo ao vivo e a banda falam.

Quatro preferências, por usuário:

| Preferência | O que faz |
|---|---|
| Sempre simplificar | Busca a casa que deixa menos acordes com sustenido ou bemol |
| Nível básico | No violão, busca só formas abertas, sem pestana; no teclado, o tom com menos teclas pretas |
| Só quando a música pedir | Usa apenas o valor cadastrado na música |
| Nunca usar | Mostra sempre no tom original |

As duas regras automáticas contam os acordes reais da cifra, não só a tônica, e o empate favorece sempre a casa de menor módulo — o sistema nunca propõe deslocamento sem ganho real. Quando o valor cadastrado na música pontua tão bem quanto o calculado, o cadastro vence.

**Na importação**, o Cifrô lê o capotraste declarado pela página de origem — inclusive quando ele aparece fora da cifra, como "Capotraste na 2ª casa" — e propõe salvar no tom real, transpondo o corpo. Nada é transposto sem confirmação, e se o `Tom:` declarado não bater com o corpo somado ao capotraste, o preview avisa e deixa a sugestão desmarcada.

**Cada músico pode ter o seu capotraste em cada música**, salvo na conta e sincronizado entre aparelhos. Se o cadastro da banda mudar depois, o Cifrô compara três pontas — o cadastro de quando você escolheu, o de agora e a sua escolha — e só chama de conflito quando os dois lados andaram. Enquanto você não decide em **Pendências**, vale o cadastro da banda. Escolhas feitas offline sobem quando a conexão volta.

**No modo ao vivo o deslocamento nunca trafega.** O que sincroniza é o tom soante: host com capotraste na 2ª casa e seguidor sem capotraste veem o mesmo tom, cada um com a sua forma.

## F-033 — Convite de banda por link compartilhável

Na aba **Membros** (`minha-banda.php`, aba `membros`), o administrador tem o botão **Convidar** ao lado de "Novo Usuário" e "Importar Usuário". Ele gera um link (`/convite.php?t=...`) válido por **24 horas** e de **usos ilimitados**, e abre o compartilhamento nativo do aparelho ou copia o link para a área de transferência. A linha de estado logo abaixo mostra a validade e quantas pessoas já entraram por ele, com um botão para **revogar**.

Quem entra pelo link sempre recebe o perfil **básico** — promoção a gestor ou administrador é feita depois, na própria lista de membros.

Tocar em "Convidar" de novo **não invalida** o link anterior: como só o hash do token é guardado (ver [Modelo de dados](modelo-de-dados.md)), não há como recuperar um link já compartilhado, então gerar de novo criaria um segundo link válido em paralelo ao primeiro, e ambos continuam funcionando até expirar. Só **Revogar** derruba todos de uma vez.

A página pública do convite (`/convite.php`) trata quatro situações — link inválido/expirado/revogado, visitante sem sessão, usuário logado que ainda não é membro e usuário que já faz parte da banda — e nunca revela o nome da banda fora do caso válido. Quem chega sem conta é levado ao cadastro (por e-mail ou Google) já sabendo o nome da banda; ao concluir, entra direto nela. Quem já tem conta faz login normalmente e confirma a entrada.

Como o limite de usuários dos planos `gratuito` e `trial` é 1, e só os planos pagos liberam mais de um usuário, **o convite por link é, na prática, funcionalidade de plano pago**: banda no plano Gratuito vê um cartão de upgrade em vez do link.

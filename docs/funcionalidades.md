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
| F-025 | Instalação PWA e cache do shell | Implementado | [Offline](dominios/offline-pwa-sync.md) | `manifest.json`, `service-worker.js` |
| F-026 | Dados offline por banda | Implementado | [Offline](dominios/offline-pwa-sync.md) | `cifro-sync.js`, `api/sync/*` |
| F-027 | Página e limites de plano | Implementado | [Planos](dominios/planos-e-cobranca.md) | `plano.php`, `bootstrap.php` |
| F-028 | Cobrança e atualização via Stripe | Implementado | [Planos](dominios/planos-e-cobranca.md) | `api/stripe/webhook.php` |
| F-029 | Proteções HTTP, CSRF e rate limit | Implementado | [Segurança](seguranca-e-permissoes.md) | `bootstrap.php`, `router.php` |
| F-030 | Gestão e filtro de categorias | Implementado | [Músicas](dominios/musicas-e-cifras.md) | `categorias.php`, `categorias/api.php` |

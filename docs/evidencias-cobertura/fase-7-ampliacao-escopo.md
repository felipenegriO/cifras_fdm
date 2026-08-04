# Fase 7 — Ampliação do escopo global

Data: 2026-07-14.

## Escopo incluído

- Todas as views PHP em `public/src/Views/**/*.php`.
- Entry points PHP com decisão: login, cadastro, plano, redefinição de senha, seleção de banda, offline, músicas e roteiros.
- Os seis módulos JavaScript do modo Ensaio em `public/src/js/rehearsal/**/*.js`.

## Dados JavaScript

`musicas.js`, `playlists_salvas.js` e `roteiros_salvos.js` foram auditados. Eles somente declaram coleções de dados e não possuem funções, condicionais ou outra lógica executável; permanecem excluídos.

## Status

O gate anterior de 80% não é válido para o escopo ampliado. A configuração foi atualizada para coletar os novos arquivos e a próxima execução deve criar fluxos reais para cada arquivo não executado antes de publicar novos percentuais.

## Medição JavaScript

Em 2026-07-14, a medição inicial após os fluxos reais de upload, pitch, A/B, loop, reprodução, busca, prévia e restauração no modo Ensaio ficou em 1.509/2.001 branches (75,41%). Faltavam 92 branches para o gate de 80%. Uma falha intermitente de saída do modo apresentação foi corrigida para usar o botão visível ao usuário; seus sete cenários foram aprovados.

Nova execução em 2026-07-14 11:05:56: 440 cenários Playwright aprovados, um ignorado, zero falhas e nenhum teste individual acima de um minuto. Foram adicionados fluxos reais de tela para fallbacks de estado, YouTube, UI, waveform e pitch do modo Ensaio. A cobertura JavaScript subiu para 1.554/2.001 branches (77,66%). Faltam 47 branches para o gate de 80%.

Nova execução em 2026-07-14 11:13:51: 440 cenários Playwright aprovados, um ignorado, zero falhas e nenhum teste individual acima de um minuto. Foram ampliados os fallbacks reais do modo Ensaio para metadados YouTube, plugin de região WaveSurfer e caminho SoundTouch. A cobertura JavaScript subiu para 1.579/2.001 branches (78,91%). Faltam 22 branches para o gate de 80%.

Nova execução em 2026-07-14 12:56:18: 442 cenários Playwright aprovados, um ignorado, zero falhas e nenhum teste individual acima de um minuto. Foram corrigidos o fluxo real de rolagem no modo apresentação e adicionados cenários reais de categorias para carregamento vazio, falhas de API, submit vazio e exclusão com erro sem persistir dados. A cobertura JavaScript subiu para 1.607/2.001 branches (80,31%). Gate JavaScript aprovado.

## Fechamento da fase

Em 2026-07-20, o gate PHP foi aprovado com `powershell -ExecutionPolicy Bypass -File scripts\coverage\run-php.ps1 -Threshold 80`: 66 testes PHPUnit aprovados, 443 cenários Playwright aprovados, 2 ignorados, zero falhas, 0 arquivos PHP não executados e 1.382/1.693 branches cobertos (81,63%).

Correções aplicadas durante a fase: normalização dos caminhos Windows no agregador PHP, abertura real da view `editor/editorroteiro` pela rota `src/backend/editor/roteiro.php`, estabilização do setup autenticado, validação de data em timezone explícito, ajuste de seletores reais no modo ao vivo, revisão dos testes PWA offline e ajuste das heurísticas visuais para telas baixas. O teste de service worker específico de cobertura JS fica ignorado somente sob `PHP_COVERAGE=1`, porque ultrapassa um minuto com instrumentação PHP e não aumenta cobertura PHP relevante.

Em 2026-07-20, o gate JavaScript foi aprovado com `powershell -ExecutionPolicy Bypass -File scripts\coverage\run-js.ps1 -Threshold 80`: 444 cenários Playwright aprovados, 1 ignorado, zero falhas e 1.612/2.001 branches cobertos (80,55%).

Status final: fase concluída. Critério de sucesso atendido para PHP e JavaScript, ambos acima de 80% de cobertura de branches no escopo ampliado.

## Ampliação posterior rumo a 90%

Em 2026-07-20, foi iniciada uma rodada adicional para avaliar viabilidade de 90%. Foram adicionados fluxos reais do modo Ensaio para conversão concluída, falha de metadados e falha de download, mantendo todos os testes individuais abaixo de um minuto. O gate JavaScript foi reexecutado com `powershell -ExecutionPolicy Bypass -File scripts\coverage\run-js.ps1 -Threshold 80`: 446 cenários aprovados, 1 ignorado, zero falhas e 1.621/2.001 branches cobertos (81,00%).

Para 90%, ainda faltam 180 branches JavaScript e 142 branches PHP. Próximos alvos com maior retorno: `public/src/js/editor.js`, `public/src/js/cifro-sync.js`, `public/src/js/rehearsal/rehearsal.bootstrap.js`, `public/src/Views/plano.php`, `public/src/Controllers/AuthController.php`, `public/src/backend/editor/api.php`, `public/src/backend/users/salvar_user.php` e `public/src/backend/download-yt-audio.php`.

## Rodada autônoma até o máximo prático atual

Em 2026-07-21, foram adicionados testes reais para aumentar cobertura sem cenários artificiais:

- `tests/php/AuthControllerTest.php`: inicialização GET, janela de rate limit expirada, campos obrigatórios ausentes, bloqueio por excesso de tentativas e falha de autenticação com incremento de tentativas.
- `tests/cifro/03-music-view.spec.js`: visualização de música tornou-se autossuficiente criando uma música real de fixture quando a banda ativa não possui músicas.
- `tests/cifro/04-editor-musicas.spec.js`: validações reais de APIs de músicas, playlists e roteiros, incluindo JSON inválido, campos inválidos, duplicidade, revisão conflitante e referências inexistentes.
- `tests/cifro/07-bandas.spec.js`: validações reais de delete sem id, `toggle_plano` inválido/não encontrado e atualização de banda com normalização do plano `trial`.
- `tests/cifro/31-browser-branch-matrix.spec.js`: fluxos reais de fallback do editor e sincronização local com playlists, roteiros, categorias e estado offline.

Correções de confiabilidade aplicadas antes de avançar:

- `tests/cifro/14-senha-reset.spec.js`: validação de e-mail inválido ficou no `checkValidity()` nativo, evitando espera desnecessária.
- `tests/cifro/22-multiband-flow.spec.js`: leitura de JSON após navegação foi protegida contra corrida real do navegador.
- `tests/cifro/03-music-view.spec.js`: removeu dependência de estado prévio da banda ativa.

Gate PHP oficial em 2026-07-21:

- Comando: `powershell -ExecutionPolicy Bypass -File scripts\coverage\run-php.ps1 -Threshold 80`.
- Resultado: 70 testes PHPUnit aprovados, 454 cenários Playwright aprovados, 2 ignorados, zero falhas, 0 arquivos PHP não executados.
- Cobertura PHP: 1.428/1.693 branches, 84,35%.

Gate JavaScript oficial em 2026-07-21:

- Comando: `powershell -ExecutionPolicy Bypass -File scripts\coverage\run-js.ps1 -Threshold 80`.
- Resultado: 455 cenários Playwright aprovados, 1 ignorado, zero falhas.
- Cobertura JavaScript: 1.622/2.001 branches, 81,05%.

Status: máximo prático desta rodada atingido com gates verdes. Ainda existem arquivos abaixo de 80% individual, principalmente `service-worker.js`, `editor.js`, `offline-tools.js` e módulos do modo Ensaio, mas os próximos ganhos exigem cenários específicos de Service Worker, áudio/pitch e integrações opcionais. Nenhum teste individual validado nesta rodada ultrapassou um minuto; o gate completo leva cerca de 14 a 16 minutos por executar 456 cenários seriais com instrumentação.

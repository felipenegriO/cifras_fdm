# Evidência da fase 0

Status: concluída
Responsável: Codex
Início: 2026-07-14
Conclusão: 2026-07-14
Estado de referência: `4abf725`, árvore previamente modificada com 194 entradas preservadas

## Ambiente

| Item | Valor |
|---|---|
| Sistema | Windows, PowerShell |
| PHP | 8.0.30 ZTS x64 |
| PHPUnit | 9.6.35 |
| Xdebug | 3.5.3, branch/path coverage habilitado por `XDEBUG_MODE=coverage` |
| Node.js | 22.12.0 |
| npm | 11.8.0 |
| Coletor JS | Monocart Reporter 2.12.2 / V8 Chromium |
| MySQL | MariaDB 10.4.32 |

## Escopo e exclusões

PHP: services, repositories, controllers, APIs e backend autoral com decisões. Views e entrypoints sem decisões ficam fora. JavaScript: `public/src/js/**/*.js` e service worker. Terceiros, minificados, Ensaio legado e os arquivos de dados estáticos `musicas.js`, `playlists_salvas.js` e `roteiros_salvos.js` ficam fora.

## Etapas executadas

| Etapa | Resultado obtido | Status |
|---|---|---|
| 0.1 | PHPUnit 18/18; Node 6/6; regressão principal 391 aprovados, 1 ignorado, 0 falhas | concluída |
| 0.2 | Inventário comparado com `public`; exclusões revisadas | concluída |
| 0.3 | Xdebug 3.5.3 instalado e 1.203 branches PHP medidos em 55 arquivos | concluída |
| 0.4 | V8/Monocart mede 1.563 branches JS, inclui fontes zerados e exclui terceiros/dados | concluída |
| 0.5 | Déficits e arquivos prioritários consolidados | concluída |

## Baseline

| Plataforma | Cobertos | Total | Percentual | Adicionais para 80% |
|---|---:|---:|---:|---:|
| PHP | 703 | 1.203 | 58,44% | 260 |
| JavaScript | 572 | 1.563 | 36,60% | 679 |

## Maiores déficits

JavaScript: `editor.js` 151, `live.js` 144, `cifro-presentation.js` 138, `cifro-sync.js` 104, `script.js` 97, `music-view.js` 92, `roteiros.js` 61 e `service-worker.js` 60 branches não cobertos.

PHP: `LiveStateService.php`, `backup_helpers.php`, `webhook.php`, `download-yt-audio.php`, repositories de roteiro/categoria e endpoints de edição são os principais alvos.

## Problemas e correções

- URLs JavaScript versionadas duplicavam fontes: normalização adicionada e validada.
- Arquivos estáticos de dados inflavam o denominador: exclusão explícita, sem lógica executável.
- Categoria mantinha revisão otimista antiga: sincronização forçada antes e depois da mutação; teste real de cadastro/exclusão aprovado.
- PWA executava no projeto que bloqueava service worker: cenário isolado no projeto `pwa` e validado em Chromium real.
- Dois testes falharam na coleta integral por estado compartilhado: fluxo visual passou a escolher uma cifra visível da banda ativa; cenário offline deixou de exigir troca de sessão sem rede. Ambos foram reproduzidos isoladamente e aprovados em 1,3 s e 1,8 s.

## Gate

- [x] Suítes de referência aprovadas.
- [x] Inventário revisado.
- [x] Branches PHP medidos por Xdebug.
- [x] Branches JavaScript medidos incluindo fontes não executados.
- [x] Déficit calculado.
- [x] Evidência concluída.
- [x] Medição consolidada atualizada.

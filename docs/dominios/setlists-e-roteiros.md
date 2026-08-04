# Setlists e roteiros

## F-015 Gestão de setlists

Gestor ou superior pode criar, renomear, ordenar, preencher, remover e excluir setlists no editor. Cada setlist possui nome, data opcional `visivel_ate` e itens JSON. Os itens referenciam músicas e podem registrar o tom usado na apresentação.

`/src/backend/editor/salvar_playlists.php` recebe o conjunto de playlists e persiste por banda. A criação respeita o limite de playlists do plano.

## F-016 Exibição de setlists

A home mostra setlists da banda atual aplicáveis à data. Selecionar um item abre a cifra correspondente e pode informar `playlistTom`.

## F-017 Gestão de roteiros

O editor permite buscar, criar, editar e excluir roteiros, definir título e validade e inserir links de músicas. O endpoint `/src/backend/editor/salvar_roteiros.php` trabalha por ação e banda atual.

## F-018 Visualização

`/roteiro.php` exibe o conteúdo de um roteiro autenticado. Links internos levam às cifras. A lista considera a banda atual e a validade configurada.

## Diferença de domínio

- Setlist: coleção estruturada e ordenada de músicas.
- Roteiro: conteúdo textual livre que pode incluir referências a músicas.

## Fontes e testes

- Código: `PlaylistRepository`, `RoteiroRepository`, `editorplaylist.php`, `editorroteiro.php`, `playlists*.js`, `roteiros*.js`.
- E2E: `04-editor-musicas.spec.js`, `08-roteiro.spec.js`, `22-multiband-flow.spec.js`.


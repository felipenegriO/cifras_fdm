# Músicas e cifras

## F-011 Catálogo

`/index.php` é a home autenticada. Carrega músicas, setlists e roteiros da banda atual, permite busca e navegação para a cifra. Os dados podem vir do servidor ou do IndexedDB.

## F-012 Editor

Gestor ou superior acessa o editor. Uma música possui nome obrigatório, artista, classificação, cifra e BPM (`bit`). A API `/src/backend/editor/api.php` oferece listagem, gravação, cópia e exclusão. Escritas exigem CSRF e são limitadas pelo plano.

A cifra é normalizada antes da persistência. Cópia cria novo ID dentro da mesma banda. Operações por ID também incluem `banda_id` para impedir acesso cruzado.

## F-013 Visualização e tom

`/music.php?id={id}` abre uma música da banda atual. A interface renderiza cifra e letra, oferece transposição e aceita `playlistTom` quando a música foi aberta por uma setlist. O ID deve ser numérico.

## F-014 Apresentação

A visualização oferece controles voltados ao palco, ajustes de layout e integração com Live e Ensaio. Preferências persistidas no usuário influenciam a apresentação. O layout possui testes específicos de viewport e rolagem.

## F-030 Categorias

Gestor ou superior pode criar, renomear e excluir categorias em `/categorias.php`. O nome tem até 100 caracteres e é único por banda. Renomear uma categoria atualiza, na mesma transação, a classificação das músicas que a utilizam. Uma categoria em uso não pode ser excluída.

As categorias são exibidas como filtros na home e como opções no editor de músicas. Fazem parte do payload de sincronização e possuem versão própria para invalidar o cache da banda.

## Dados

Tabela `musicas`: `id`, `banda_id`, `nome`, `artista`, `classificacao`, `cifra`, `bit`, `atualizado_em`. Tabela `categorias`: `id`, `banda_id`, `nome`.

## Fontes e testes

- Código: `MusicaRepository`, `Views/index.php`, `Views/music.php`, `Views/editor/editor.php`, `musicas.js`, `cifro-presentation.js`.
- E2E: `02-home-cifras`, `03-music-view`, `04-editor-musicas`, `18-edge-cases`, `25-categorias`, `music-layout.spec.js`, `test-id165-scroll.spec.js`.

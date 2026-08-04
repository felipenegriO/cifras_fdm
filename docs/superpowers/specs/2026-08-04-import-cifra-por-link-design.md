# Importação de cifra por link (CifraClub) — Design

## Contexto

No editor de música (`editor.php`), o botão "Importar cifra" abre um modal com dois campos sempre visíveis: um campo opcional de "Link de origem" (guardado apenas como referência, nunca acessado) e uma textarea para colar o conteúdo completo da cifra. O parsing do texto colado é feito em `parseImportedSong` (`public/src/js/editor.js`), que separa título/artista/metadados (tom, capo, afinação) do corpo da cifra.

Já existe uma base de código para importação automática via URL: a interface `ChordImportProvider` (`public/src/Services/ChordImportProvider.php`) e uma implementação `DisabledCifraClubImportProvider` que valida o host (`cifraclub.com.br` / `www.cifraclub.com.br`) mas sempre lança `RuntimeException` com a mensagem "Importação automática por URL aguarda autorização formal do provedor." Essa classe não está conectada a nenhum endpoint — existe só nos testes (`tests/php/DisabledCifraClubImportProviderTest.php`).

**O usuário confirmou possuir autorização formal do CifraClub para buscar e extrair cifras automaticamente do site.**

## Objetivo

Permitir que o usuário, ao importar uma cifra, escolha entre:
1. **Colar um link** do CifraClub e deixar a aplicação buscar e extrair a cifra automaticamente.
2. **Colar a cifra completa** manualmente (comportamento atual, inalterado).

## Escopo

- Suporte automático apenas ao CifraClub nesta primeira etapa, mas a estrutura deve permitir adicionar outros provedores no futuro sem reescrever o fluxo.
- Não inclui: download de áudio/tablatura, importação em lote, histórico de importações.

## Backend

### `CifraClubImportProvider` (substitui `DisabledCifraClubImportProvider`)

Arquivo: `public/src/Services/CifraClubImportProvider.php`, implementa `ChordImportProvider`.

`import(string $url): array`:
1. Valida `scheme` (`http`/`https`) e `host` (`cifraclub.com.br` ou `www.cifraclub.com.br`). Host inválido → `InvalidArgumentException('URL de origem não permitida.')`.
2. Faz o fetch do HTML via stream context (`file_get_contents` com `stream_context_create`), com:
   - Timeout de 8 segundos.
   - `User-Agent` identificando a aplicação.
   - Limite de tamanho de resposta (ex.: 2 MB) para evitar abuso.
   - Falha de rede/timeout → `RuntimeException('Não foi possível acessar a página informada.')`.
3. Faz parse do HTML com `DOMDocument`/`DOMXPath`:
   - Título e artista a partir dos elementos de cabeçalho da página do CifraClub.
   - Corpo da cifra a partir do bloco `<pre>` que o CifraClub usa para o conteúdo.
   - Estrutura de resultado não encontrada (layout mudou, página não é uma cifra) → `RuntimeException('Não foi possível extrair a cifra desta página.')`.
4. Retorna array no mesmo formato que `parseImportedSong` já produz no frontend:
   ```php
   ['title' => string, 'artist' => string, 'content' => string, 'metadata' => ['tom' => ?string, 'capo' => ?string, 'afinação' => ?string]]
   ```

### Resolução de provider por host

Função/factory simples (ex.: `ChordImportProviderResolver::forUrl(string $url): ChordImportProvider`) que hoje só reconhece hosts do CifraClub e lança `InvalidArgumentException` para qualquer outro host. Isolar essa decisão permite acrescentar outro provider depois sem tocar no endpoint.

### Endpoint `POST /src/backend/editor/import.php`

Segue o padrão de `public/src/backend/editor/api.php`:
- `require_once bootstrap.php`, `send_no_cache_headers()`, `require_band_role('gestor')`, exige `POST`, `require_csrf()`.
- Body: `{ "url": string }`.
- Resolve o provider pelo host, chama `import($url)`.
- Sucesso: `{ "ok": true, "title": ..., "artist": ..., "content": ..., "metadata": ..., "source": url }`.
- Erro (`InvalidArgumentException`, `RuntimeException`): `{ "ok": false, "error": <mensagem> }` com HTTP 422.
- Não persiste nada — apenas retorna os dados para o preview no frontend, igual ao fluxo de colar texto.

## Frontend (`editor.php` + `editor.js`)

### Modal de importação

O modal passa a ter duas abas:

- **"Colar link"** (nova, padrão inicial):
  - Campo de URL + botão "Buscar cifra".
  - Ao clicar: chama `POST import.php`, mostra estado de carregamento no botão, desabilita o botão durante a requisição.
  - Sucesso: preenche o mesmo preview usado hoje (`elements.importPreview`), habilita "Usar no editor", reaproveitando `confirmImport()` sem alterações — o preview salvo em `importModal.dataset.preview` tem o mesmo formato de hoje.
  - Falha: mostra a mensagem de erro retornada pelo backend na área de preview (com estilo de erro) e um link/botão "Colar cifra completa manualmente" que troca para a outra aba mantendo o que já foi digitado.
  - Checkbox "Confirmo que tenho autorização..." continua obrigatório antes de habilitar "Usar no editor", igual ao modo texto.

- **"Colar cifra completa"** (a UI atual): campo de link opcional (guardado como referência) + textarea + preview via `parseImportedSong`. Sem mudanças de comportamento.

Trocar de aba limpa o estado de preview/erro da aba anterior (não mistura resultado de busca automática com texto colado manualmente).

### Reuso de código

- `previewImport()`/`confirmImport()` continuam controlando a textarea (modo colar). Um novo `previewImportFromUrl()` chama o endpoint e delega para a mesma lógica de exibição de preview e habilitação do botão de confirmação, para não duplicar a lógica de "usar no editor".

## Segurança

- Allowlist de host mantida (apenas CifraClub por enquanto).
- Timeout curto e limite de tamanho de resposta no fetch do servidor evitam abuso/DoS via URLs arbitrárias.
- Nenhuma URL fora da allowlist é buscada — hosts não reconhecidos retornam erro antes de qualquer fetch.
- Endpoint exige mesma role (`gestor`) e CSRF que os demais endpoints de edição.

## Testes

- Atualizar/substituir `tests/php/DisabledCifraClubImportProviderTest.php` por testes de `CifraClubImportProvider` cobrindo: host inválido rejeitado, parse de um HTML de exemplo (fixture) extraindo título/artista/conteúdo corretamente, e erro quando o HTML não contém o bloco de cifra esperado.
- Teste do resolver: host CifraClub retorna `CifraClubImportProvider`; host desconhecido lança `InvalidArgumentException`.

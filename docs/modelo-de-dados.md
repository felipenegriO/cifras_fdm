# Modelo de dados

Fonte: `create_tables.sql`, scripts de setup e migrations versionadas.

## Entidades

| Tabela | Chave | Escopo | Conteúdo |
|---|---|---|---|
| `bandas` | UUID textual | Global | nome, logo, criador, status, plano e assinatura Stripe |
| `usuarios` | ID textual de 32/36 caracteres | Global | identidade, credenciais, validade e configuração JSON |
| `usuario_banda` | usuário + banda | Banda | vínculo e papel `administrador`, `gestor`, `basico` ou `externo` |
| `musicas` | inteiro | Banda | nome, artista, classificação, cifra, BPM e atualização |
| `categorias` | inteiro | Banda | categorias disponíveis para classificar músicas |
| `band_sync_state` | banda | Banda | revisão monotônica do conteúdo sincronizável |
| `sync_changes` | inteiro | Banda | log incremental de revisão, entidade, operação e ID alterado |
| `playlists` | inteiro | Banda | nome, validade e itens JSON |
| `roteiros` | inteiro | Banda | título, conteúdo, validade e atualização |
| `live_state` | banda | Banda | host, cifra, página, rolagem, atualização e versão |
| `password_reset_tokens` | token SHA-like de 64 caracteres | Usuário | expiração e consumo único |

## Relações

```text
usuarios N:M bandas via usuario_banda
usuarios 1:N bandas via bandas.criador_id
bandas 1:N musicas
bandas 1:N categorias
bandas 1:N playlists
bandas 1:N roteiros
bandas 1:1 band_sync_state
bandas 1:N sync_changes
bandas 1:1 live_state
usuarios 1:N password_reset_tokens
```

As relações dependentes usam `ON DELETE CASCADE`. Toda consulta de música, playlist, roteiro e Live deve incluir a banda atual.

## Campos JSON

- `usuarios.config`: preferências visuais e operacionais do usuário.
- `playlists.itens`: sequência de músicas e informações específicas da setlist, incluindo tom quando informado.

## Invariantes

- `usuarios.email` é único.
- Uma associação usuário/banda é única.
- O nome da categoria é único dentro da banda.
- IDs de conteúdo só são válidos em conjunto com `banda_id`.
- Tokens são de uso único e deixam de ser válidos após `expira_em`.
- `live_state.version` sinaliza alterações para seguidores.
- `band_sync_state.content_revision` muda uma vez na mesma transação de cada alteração de conteúdo.
- `sync_changes.revision` referencia a revisão monotônica da banda; quando a janela não cobre a revisão do cliente, a API exige snapshot completo.

## Atenções de evolução

- O schema aceita planos legados `ativo`, `basico` e `banda`, mas os limites do bootstrap não definem `basico` e `banda`; hoje eles caem no limite padrão zero.
- O comentário do schema diz UUID de 36 caracteres, enquanto cadastros usam `bin2hex(random_bytes(16))`, com 32 caracteres.
- Mudanças em JSON devem manter leitura compatível com registros antigos.

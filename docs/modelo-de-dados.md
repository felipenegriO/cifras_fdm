# Modelo de dados

Fonte: `create_tables.sql`, scripts de setup e migrations versionadas.

## Entidades

| Tabela | Chave | Escopo | Conteúdo |
|---|---|---|---|
| `bandas` | UUID textual | Global | nome, logo, criador, status, plano e assinatura Stripe |
| `usuarios` | ID textual de 32/36 caracteres | Global | identidade, credenciais, validade e configuração JSON |
| `usuario_banda` | usuário + banda | Banda | vínculo e papel `administrador`, `gestor`, `basico` ou `externo` |
| `musicas` | inteiro | Banda | nome, artista, classificação, cifra, BPM, capotraste sugerido e atualização |
| `categorias` | inteiro | Banda | categorias disponíveis para classificar músicas |
| `band_sync_state` | banda | Banda | revisão monotônica do conteúdo sincronizável |
| `sync_changes` | inteiro | Banda | log incremental de revisão, entidade, operação e ID alterado |
| `playlists` | inteiro | Banda | nome, validade e itens JSON |
| `roteiros` | inteiro | Banda | título, conteúdo, validade e atualização |
| `live_state` | banda | Banda | host, cifra, página, rolagem, atualização e versão |
| `usuario_musica` | usuário + música | Usuário | capotraste pessoal e a foto do cadastro no momento da escolha |
| `password_reset_tokens` | token SHA-like de 64 caracteres | Usuário | expiração e consumo único |
| `banda_convites` | token SHA-256 de 64 caracteres | Banda | link de convite: criador, validade de 24h, revogação e contagem de usos |
| `schema_migrations` | ID textual | Global | checksum e data de cada migration SQL aplicada |

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
bandas 1:N banda_convites
usuarios 1:N password_reset_tokens
```

As relações dependentes usam `ON DELETE CASCADE`. Toda consulta de música, playlist, roteiro e Live deve incluir a banda atual.

## Campos JSON

- `usuarios.config`: preferências visuais e operacionais do usuário, incluindo `instrumento` (`violao`, `teclado`, `outro`) e `transposicaoPreferencia` (`simplificar`, `basico`, `cadastrado`, `nunca`). Chave ausente significa que o usuário ainda não escolheu, e é o que dispara o modal de primeiro acesso.
- `playlists.itens`: sequência de músicas e informações específicas da setlist, incluindo tom quando informado.

## Capotraste e transposição de instrumento

`musicas.transposicao_instrumento` (TINYINT com sinal, `-12` a `12`, padrão 0) guarda **quanto o instrumento sobe em relação às formas mostradas na tela**. É um número neutro: `+2` é capotraste na 2ª casa para o violonista e transpose `+2` para o tecladista, e os dois leem as mesmas formas. Negativo só faz sentido para quem transpõe eletronicamente, porque não existe capotraste negativo.

`musicas.cifra` continua sempre no **tom soante**. O deslocamento é dado de apresentação, aplicado na exibição — nunca gravado na cifra. Por isso as músicas anteriores a este campo ficam corretas com o padrão 0, sem migração de conteúdo.

### Personalização por músico

`usuario_musica` guarda o capotraste que **aquele músico** usa naquela música, e é a semente do NOTE-001 (anotações pessoais). As colunas `base_transposicao` e `base_tom` são o **merge base** do modelo do Git: a foto do cadastro no instante da escolha.

| Cadastro mudou? | A escolha diverge da base? | Resultado |
|---|---|---|
| não | — | a escolha pessoal vale |
| sim | não | *fast-forward*: adota o novo em silêncio |
| sim | sim | **conflito**: o músico decide em `/pendencias.php` |

Enquanto o conflito não é resolvido, a escolha pessoal fica **suspensa** e o app volta à preferência do usuário — o conteúdo oficial da banda nunca fica escondido atrás de uma decisão não tomada.

Esta tabela **não** participa de `band_sync_state`: é dado pessoal, e subir a revisão da banda invalidaria o cache offline de todos os integrantes por causa da escolha de um só.

## Convite de banda por link

`banda_convites` guarda apenas o **SHA-256 do token** na chave primária (mesmo padrão de `password_reset_tokens`); o valor em claro só existe dentro do link que circula fora do banco, no grupo do WhatsApp ou onde o administrador compartilhar.

| Coluna | Conteúdo |
|---|---|
| `token` | SHA-256 do token, 64 caracteres, chave primária |
| `banda_id` | banda que o convite abre |
| `criado_por` | usuário que gerou o link; `SET NULL` se a conta for removida |
| `expira_em` | criação + 24h (`BandaConvitePolicy::TTL_SEGUNDOS`) |
| `revogado_em` | preenchido quando o administrador revoga; `NULL` enquanto vale |
| `usos` | contador incrementado a cada aceite, sem limite máximo |
| `criado_em` | carimbo de criação |

Gerar um novo link **não invalida** os anteriores — eles seguem válidos até `expira_em`. Só existe o hash, então um link já enviado ao grupo não pode ser recuperado para ser reaproveitado; invalidá-lo ao gerar de novo mataria em silêncio o convite que acabou de circular. Revogar (`revogarDaBanda`) derruba todos os convites vivos da banda de uma vez.

## Invariantes

- `usuarios.email` é único.
- Uma associação usuário/banda é única.
- O nome da categoria é único dentro da banda.
- IDs de conteúdo só são válidos em conjunto com `banda_id`.
- Tokens são de uso único e deixam de ser válidos após `expira_em`, exceto `banda_convites.token`, que é de usos ilimitados até expirar ou ser revogado — ver [Convite de banda por link](#convite-de-banda-por-link).
- `live_state.version` sinaliza alterações para seguidores.
- `band_sync_state.content_revision` muda uma vez na mesma transação de cada alteração de conteúdo.
- `sync_changes.revision` referencia a revisão monotônica da banda; quando a janela não cobre a revisão do cliente, a API exige snapshot completo.

## Atenções de evolução

- Migrations SQL são ordenadas por nome em `migrations/` e aplicadas por `scripts/setup/migrate.php`; alteração de checksum após aplicação bloqueia novas execuções.

- O schema aceita planos legados `ativo`, `basico` e `banda`, mas os limites do bootstrap não definem `basico` e `banda`; hoje eles caem no limite padrão zero.
- O comentário do schema diz UUID de 36 caracteres, enquanto cadastros usam `bin2hex(random_bytes(16))`, com 32 caracteres.
- Mudanças em JSON devem manter leitura compatível com registros antigos.

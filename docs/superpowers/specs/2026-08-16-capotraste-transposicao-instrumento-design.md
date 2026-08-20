# Capotraste e transposição de instrumento

## Objetivo

Permitir que cada músico leia a mesma cifra nas formas mais fáceis para o **seu** instrumento, sem alterar o tom que a banda toca.

Um violonista põe o capotraste na 2ª casa e lê formas de Sol; um tecladista põe transpose +2 e lê as mesmas formas; os dois soam em Lá, junto com o resto da banda. Hoje o sistema não conhece esse conceito: quem quer tocar com capo transpõe a cifra na mão e perde o tom de referência do repertório.

A funcionalidade tem quatro partes:

1. um campo no cadastro da música, para registrar a casa que aquela música pede;
2. uma preferência por usuário, dizendo o quanto o sistema deve simplificar sozinho;
3. controles na tela de música para pôr e tirar na hora, respeitando o modo live;
4. leitura da informação de capo quando a música é importada do CifraClub.

## O conceito

O número guardado é **um só e neutro**: *quanto o instrumento sobe em relação às formas mostradas na tela*. O rótulo muda conforme o músico, o valor não.

| Valor | Violonista faz | Tecladista faz | Formas na tela |
|---|---|---|---|
| `+2` | capo na 2ª casa | transpose +2 | 2 semitons **abaixo** do som |
| `0` | nada | nada | no tom real |
| `−2` | *impossível* | transpose −2 | 2 semitons **acima** do som |

O som que sai é sempre o mesmo. O capo muda a forma que o dedo faz, nunca a altura que se ouve. Valor negativo só existe para quem transpõe eletronicamente — não há capotraste negativo no violão.

## Decisões tomadas

1. **A cifra é sempre guardada no tom soante.** O deslocamento é dado de apresentação, aplicado na hora de mostrar. As músicas existentes já estão assim, com deslocamento 0 implícito; nenhuma precisa ser migrada.
2. **O tom continua sendo detectado no cliente**, por `CifroChords.identifyKey`, como hoje. Não entra coluna `tom` no banco.
3. **As regras automáticas contam os acordes reais da cifra**, não apenas a tônica. Um tom de Ré traz F#m e Bm no meio da música, e uma regra que só olha a tônica não enxerga isso.
4. **O indicador de tom mostra sempre o tom soante.** Repertório, live e conversa entre músicos falam sempre do som que sai.
5. **O deslocamento nunca trafega no live.** Cada aparelho aplica o seu; o que sincroniza é o tom soante.
6. **Nada é transposto na importação sem clique**, e há conferência cruzada com o cabeçalho da página de origem.
7. **A personalização por músico é dado do usuário, não da banda.** Não sobe `band_sync_state`.
8. **Conflito entre a personalização e o cadastro é resolvido pelo músico**, com comparação de três pontas no modelo do Git.

## Modelo de dados

### `musicas` — coluna nova

```sql
ALTER TABLE musicas
  ADD COLUMN transposicao_instrumento TINYINT NOT NULL DEFAULT 0;
```

TINYINT **com sinal**. A API aceita de `-12` a `12` — uma oitava para cada lado. O cadastro é um fato musical da banda, então comporta tanto o capotraste de um violonista quanto o transpose negativo de um tecladista. O nome é longo de propósito: `transposicao` sozinho colidiria com a transposição de tom que o código já faz em `CifroChords.transposeHtml`.

`MusicaRepository::save()` e `::copy()` passam a gravar a coluna; `getAllByBanda`/`findById` já usam `SELECT *`, então o campo entra sozinho no snapshot de sync e no cache offline.

### `usuarios.config` — chaves novas

JSON, sem migration. Ambas entram na whitelist de `UserConfigValidator`:

| Chave | Valores | Ausente significa |
|---|---|---|
| `instrumento` | `violao`, `teclado`, `outro` | não perguntado ainda |
| `transposicaoPreferencia` | `simplificar`, `basico`, `cadastrado`, `nunca` | não perguntado ainda |

### `usuario_musica` — tabela nova (etapa 3)

```sql
CREATE TABLE IF NOT EXISTS usuario_musica (
  usuario_id  CHAR(36) NOT NULL,
  banda_id    CHAR(36) NOT NULL,
  musica_id   INT      NOT NULL,
  transposicao_instrumento TINYINT  DEFAULT NULL,  -- o que eu escolhi
  base_transposicao        TINYINT  DEFAULT NULL,  -- o que o cadastro dizia quando escolhi
  base_tom                 VARCHAR(8) DEFAULT NULL,-- o tom que soava quando escolhi
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, musica_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (musica_id)  REFERENCES musicas(id)   ON DELETE CASCADE,
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)    ON DELETE CASCADE,
  INDEX idx_usuario_musica_banda (usuario_id, banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

O nome é `usuario_musica`, e não `usuario_musica_capo`, porque esta é a semente do **NOTE-001** do `backlog.md` ("Anotações pessoais por músico", cujo escopo inicial já prevê "tom e capo preferidos"). Quando o NOTE-001 entrar, `nota` e `ancora` viram colunas desta mesma tabela e `base_cifra_hash` vira mais um campo de base, reaproveitando toda a máquina de conflito descrita adiante.

`banda_id` é redundante em relação a `musicas.banda_id`, mas fica: toda consulta de conteúdo neste projeto inclui a banda, e o índice por usuário e banda serve o carregamento do snapshot sem join.

## Regras automáticas

Função nova em `public/src/js/chords.js`, reaproveitando o `extractChords` que já existe:

```js
CifroChords.sugerirTransposicao(html, { criterio, faixa })
```

Para cada valor da faixa, transpõe a cifra em `−valor`, conta os acordes que atrapalham e devolve o de menor contagem. **Empate favorece o valor 0**, e por isso o sistema nunca propõe deslocamento sem ganho real.

Só a **raiz** do acorde entra na conta, não o baixo: `D/F#` é trivial de tocar e seria punido injustamente por causa do sustenido no baixo. Diminutos e aumentados contam sempre como problema — nenhuma casa os resolve, então eles só empatam e não distorcem a escolha.

O critério depende do nível **e** do instrumento:

| | Violão / guitarra | Teclado / outro |
|---|---|---|
| **Sempre simplificar** | acorde com `#` ou `b` na raiz | acorde com `#` ou `b` na raiz |
| **Nível básico** | acorde que exige pestana: raiz fora de C, A, G, E, D (maior, sus, add, dominante) e fora de Am, Em, Dm (menor) | acorde cuja tônica não pertence aos tons de menos teclas pretas: C, G, F, D, Am, Em, Dm |

Faixa por instrumento:

| Instrumento | Rótulo na interface | Faixa manual | Janela do automático |
|---|---|---|---|
| `violao` — violão ou guitarra | **Capotraste** | 0 a 12 | 0 a 7 |
| `teclado` — teclado ou piano | **Transpose** | −12 a +12 | −6 a +6 |
| `outro` — outro instrumento ou voz | **Transposição** | −12 a +12 | −6 a +6 |

Duas faixas diferentes, de propósito:

- **A faixa manual vai até uma oitava para cada lado.** O músico manda no próprio instrumento: se ele quer capotraste na 9ª casa ou transpose −10, o app não discute.
- **A janela do automático é menor.** Fora dela o resultado apenas se repete (deslocamento 8 dá as mesmas formas que −4), então buscar mais longe só produziria posições desconfortáveis sem ganho nenhum de simplificação. O cálculo automático nunca sugere sozinho uma casa apertada; chegar lá é decisão de quem toca.

No violão a faixa não desce abaixo de zero em nenhum dos dois casos: não existe capotraste negativo para executar.

## Cadastro da música

`Views/editor/editor.php` ganha um campo em `#songDetails`, ao lado de "Tom padrão": stepper numérico rotulado conforme o instrumento de quem está editando (**Capotraste**, **Transpose** ou **Transposição**), aceitando de −12 a 12 independentemente do instrumento — o cadastro vale para a banda inteira, não só para quem digitou.

Abaixo do campo, uma legenda dinâmica mostra o efeito: `formas em Sol` quando a música está em Lá e o valor é 2. Um botão **Sugerir** aplica a regra automática do instrumento de quem edita, como atalho para quem não quer calcular.

O campo "Tom padrão" que já existe continua mostrando o **tom soante**, sem desconto do deslocamento — é o tom que a banda toca.

`editor.js` inclui `transposicao_instrumento` no payload de salvamento; `editor/api.php` valida a faixa e recusa fora dela com 422, no padrão das demais validações do endpoint.

## Preferência do usuário e primeiro acesso

### Modal na home

Aparece em `index.php` quando falta ao menos uma das duas chaves de config, no padrão do `betaWelcomeModal` que já existe na tela. Dois passos:

1. **O que você toca?** — três opções, que definem o vocabulário do passo seguinte.
2. **Como quer que o app trate o capotraste?** — as quatro preferências, cada uma com um exemplo concreto ("música em Si♭ → capo 1, formas de Lá").

Rodapé fixo em ambos os passos: **"Dá para mudar isso quando quiser em Configurações."**

O botão **Decidir depois** não grava nada: o app se comporta como `cadastrado` e a pergunta volta no próximo acesso. O modal aparece **no máximo uma vez por sessão** (marca em `sessionStorage`), para que voltar à home várias vezes não repita a pergunta.

### Tela de configurações

Nova seção "Instrumento e capotraste" em `Views/config.php`, com os dois campos. Trocar o instrumento troca os rótulos e a faixa na hora, sem recarregar. Salva pelo `cfgSave` que já existe, contra `salvar_config.php`.

## Tela de música

### Indicadores

`#tom` passa a mostrar **sempre o tom soante** e ganha um vizinho com o deslocamento e as formas:

```
Tom: Lá        capo 2 · formas em Sol
```

No cabeçalho compacto: `Lá · capo 2`. Com deslocamento 0, o vizinho some e a tela fica idêntica à de hoje.

### Controles

- **Barra rápida (celular):** botão que põe e tira — alterna entre o valor sugerido e 0, com `aria-pressed`.
- **Ajustes → Leitura:** linha nova com stepper `−` / valor / `+` limitado à faixa do instrumento, mais um botão **Automático** que reaplica a regra da preferência.

Em modo somente letra o controle fica desabilitado, como o tom já fica hoje.

### Ordem de decisão ao abrir a música

1. personalização pessoal daquela música, se existir e não estiver em conflito (etapa 3);
2. senão, a preferência do usuário:
   - `nunca` → 0
   - `cadastrado` → `musicas.transposicao_instrumento`
   - `simplificar` / `basico` → cálculo automático
3. **desempate a favor do cadastro:** se o valor cadastrado pontuar tão bem quanto o calculado, vence o cadastro — respeita o que um humano já sabia sobre a música sem abrir mão da simplificação;
4. corta na faixa do instrumento.

Mudar o tom com deslocamento posto: o tom soante muda; se o deslocamento está em automático, a casa é recalculada; se foi posto à mão, a casa permanece.

## Modo live

O deslocamento de instrumento **nunca entra no payload do live**. O que trafega é o tom soante, e cada aparelho aplica o seu deslocamento por cima. Host com capo 2 e seguidor sem capo veem o mesmo tom soante com formas diferentes — que é o comportamento correto: os dois estão tocando a mesma música.

Correção técnica que acompanha: hoje `live.js` monta a página publicada lendo o **texto** do elemento `#tom`. Como esse indicador passa a conviver com outro indicador, a leitura muda para um `dataset.tomSoante` explícito no container da cifra, para o live não depender de um rótulo de interface.

## Importação do CifraClub

### Extração

`CifraClubImportProvider` hoje só reconhece `capo:` em linhas dentro do `<pre>`. Passa a procurar **também fora do `<pre>`**, porque o CifraClub apresenta "Capotraste: 2ª casa" em elemento próprio. Normaliza `2ª casa`, `capo 2` e `2` para o inteiro `2`, e devolve `null` quando não encontra.

### Confirmação no preview

O preview do editor mostra:

> A página informa **capotraste na 2ª casa**. Os acordes do corpo estão em **Sol**, então o tom real é **Lá**.
> ☑ Salvar no tom real (Lá) com capotraste 2 ☐ Importar como está

Marcado, a importação sobe a cifra 2 semitons e grava `transposicao_instrumento = 2`. Desmarcado, importa como veio com 0. **Nada é transposto sem clique.**

### Trava contra corromper cifra

Se a página informar `Tom:` e ele não bater com o tom detectado no corpo somado ao capo, o preview mostra o aviso — "a página informa tom X, mas o corpo somado ao capo dá Y" — e deixa **Importar como está** pré-selecionado. É essa conferência que evita estragar cifras no dia em que o CifraClub mudar o layout.

## Personalização por músico e conflito

### Comparação de três pontas

As colunas `base_*` são o **merge base** do modelo do Git: a foto do cadastro no instante em que o músico fez a escolha.

| Cadastro mudou? | Minha escolha diverge da base? | Resultado |
|---|---|---|
| não | — | nada acontece, minha escolha vale |
| sim | não | **fast-forward**: adota o novo em silêncio |
| sim | sim | **conflito**: o músico decide |

`base_tom` cobre o caso que `base_transposicao` sozinho não pega: se o gestor transpuser a cifra inteira, a casa 3 escolhida passa a soar em outro tom, e isso também é conflito.

### Leitura e escrita

- **Leitura:** as linhas do usuário atual entram no snapshot de `/api/sync/data.php` como `preferencias_musica`, e ficam num store novo `cifro_preferencias` no IndexedDB. A validação de payload de `cifro-sync.js` — que hoje exige `musicas`, `playlists`, `roteiros` e `categorias` como arrays — passa a validar a chave nova **tolerando a ausência dela**, para que um cliente atualizado não quebre contra um servidor ainda antigo durante o deploy.
- **Escrita:** `POST /src/backend/users/preferencia-musica.php` com `{musica_id, transposicao_instrumento}`. Grava o valor e atualiza `base_transposicao`/`base_tom` com o cadastro corrente. Entra na fila offline que `cifro-sync.js` já mantém para os endpoints de escrita.

**Não sobe `band_sync_state`.** Dado pessoal não é conteúdo da banda: subir a revisão da banda por causa do capo de um músico invalidaria o cache offline de todos os integrantes, possivelmente minutos antes de um culto. Entre dois aparelhos do mesmo usuário, última escrita vence — não há máquina de revisão nem resolução de conflito para esse caso.

### Aviso e resolução

O sync compara as linhas pessoais com o cadastro e emite um evento quando encontra divergência. O aviso é imediato: toast mais contador no menu, levando a uma tela de pendências.

Dois cuidados:

- **O toast fica retido durante o live e o modo apresentação**, e aparece ao sair. Interromper alguém no meio de um culto é o risco natural da notificação imediata.
- **Enquanto o conflito não é resolvido, vale o cadastro.** O conteúdo oficial da banda nunca fica escondido atrás de uma decisão que ninguém tomou.

Cada item da tela de pendências mostra `Cadastro antes: capo 2 · Cadastro agora: capo 4 · Você usa: 3`, com três ações:

| Ação | Efeito |
|---|---|
| **Usar o do cadastro** | apaga a linha pessoal; o músico volta a seguir a preferência |
| **Manter o meu** | atualiza só as colunas `base_*`; o valor escolhido permanece |
| **Abrir a música** | leva à cifra para decidir vendo o material |

## Segurança e privacidade

- Toda consulta a `usuario_musica` inclui `usuario_id` **e** `banda_id`. Um integrante nunca lê a linha de outro, por interface ou por API.
- O endpoint de escrita exige CSRF e sessão, valida a faixa do valor e recusa música que não pertença à banda atual.
- A exclusão da conta remove as linhas por `ON DELETE CASCADE`, e a exportação de dados pessoais passa a incluí-las.
- A personalização nunca entra no live nem no compartilhamento de repertório.

## Testes

Nomes em linguagem de negócio, em português, como é a praxe do projeto.

### PHPUnit

- `UserConfigValidator` aceita os quatro valores de preferência e os três de instrumento, e recusa qualquer outro.
- `CifraClubImportProvider` lê o capo dentro e fora do `<pre>`, entende "2ª casa", e devolve nulo quando a página não informa.
- O repositório de personalização não devolve a linha de outro músico nem de outra banda.
- O endpoint de escrita exige CSRF, valida a faixa e recusa música de outra banda.

### Unitários de `chords.js`

- A sugestão nos dois critérios e nos três instrumentos.
- Empate escolhe o valor 0.
- A faixa do violão nunca devolve negativo.
- Transpor por deslocamento preserva o tom soante.

### Playwright

- O modal aparece no primeiro acesso, grava a escolha e não volta.
- "Decidir depois" faz a pergunta voltar no acesso seguinte.
- Cadastro de música com capotraste.
- Pôr e tirar o capotraste na tela de música.
- **Live: host com capo 2 e seguidor sem capo veem o mesmo tom soante.**
- Import com capo pede confirmação, e recusar não transpõe a cifra.
- Conflito aparece, é resolvido nos dois sentidos, e a escolha sobrevive a F5.
- Escolha pessoal feita offline sobe quando a conexão volta.

## Etapas

Cada etapa é entregável sozinha.

1. **Fundação e exibição** — migration da coluna, campo no editor, regras em `chords.js`, instrumento e preferência, modal, configurações, tela de música e live. Nesta etapa o deslocamento posto na tela vale enquanto a tela estiver aberta.
2. **Importação do CifraClub** com confirmação e trava de conferência.
3. **Personalização por músico** — tabela, endpoint, sync, IndexedDB, pendências e conflito. É aqui que a escolha passa a durar e a sincronizar entre aparelhos.

## Fora do escopo

- Diagrama de acordes ou desenho do braço do instrumento.
- Afinações alternativas (drop D, meio tom abaixo).
- Deslocamento por repertório, diferente do deslocamento por música.
- Anotações pessoais em texto — ficam para o NOTE-001, que herda a tabela.

## Rollback

A etapa 1 sai desligando os controles na tela de música e escondendo a seção de configurações; a coluna fica no banco com 0 e nada muda para quem já usava. A etapa 3 sai ocultando a tela de pendências e deixando de ler o store pessoal: as linhas continuam no banco e voltam a valer quando a funcionalidade retornar.

## Documentação a atualizar

`docs/modelo-de-dados.md`, `docs/api.md`, `docs/funcionalidades.md`, `docs/testes.md`, e uma nota em `backlog.md` registrando que o NOTE-001 herda a tabela `usuario_musica`.

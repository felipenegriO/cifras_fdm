# Clareza da funcionalidade de Categorias — design

Data: 2026-08-19
Funcionalidade afetada: F-030 (Gestão e filtro de categorias)

## Problema

Usuários novos não entendem o que é categoria, como cadastrar nem para que serve.
A funcionalidade está implementada e correta no back-end, mas a apresentação falha
em cinco pontos concretos:

1. **Dois nomes para a mesma coisa.** O campo se chama "Classificação" no editor
   (`Views/editor/editor.php:81`) e "Categorias" na gestão e na home.
2. **Nasce invisível.** Banda sem categorias vê apenas o chip "Todas" na home
   (`Views/index.php:511`) e apenas "Não classificada" no editor. Nada convida,
   explica ou exemplifica.
3. **O filtro da home mente.** `aplicarFiltro()` escreve o nome da categoria no
   campo de busca (`Views/index.php:496`), e a busca casa contra nome, artista,
   classificação **e o corpo da cifra** (`Views/index.php:581`). Clicar no chip
   "Natal" traz qualquer música com "natal" na letra — o usuário conclui que
   categoria não funciona.
4. **A lista de categorias não dá retorno.** Cadastrar não produz nenhum sinal
   visível de que serviu para alguma coisa.
5. **O músico não-gestor fica no escuro.** Criar categoria é restrito a gestor+
   (`CategoriaController.php:5`, `backend/categorias/api.php` via
   `require_band_role('gestor')`), mas nada na tela diz isso.

## Decisões tomadas

- **O modelo de dados não muda.** `musicas.classificacao` continua um
  `VARCHAR(100)` único por música. Uma música tem no máximo uma categoria.
- **O critério é livre, a lista é da banda.** O Cifrô não define o significado de
  categoria. A banda pode usá-la como momento do culto, característica da música
  ou gaveta de organização — a interface mostra os três usos como exemplo e não
  privilegia nenhum.
- **Criar categoria continua restrito a gestor+.** O que muda é que o gestor pode
  criar sem sair do editor, e que o músico passa a entender por que não pode.
- **A home não muda visualmente.** Sem chip novo, sem layout novo. Música sem
  categoria continua aparecendo em "Todas". Só o resultado do clique é corrigido.

## Escopo

### 1. Vocabulário único

"Classificação" deixa de existir na interface. Em todo lugar: **Categoria**.
A opção vazia passa de "Não classificada" para **"Sem categoria"**.

Arquivos: `Views/editor/editor.php`, `js/editor.js`, artigos da Central de Ajuda.
O nome da coluna no banco (`classificacao`) permanece — é mudança de rótulo, não
de esquema.

### 2. Aba Categorias sem nenhuma categoria criada

Substitui a lista vazia atual por:

- Título: **"Organize as músicas do seu jeito"**
- Texto: **"Categoria é como sua banda agrupa as músicas. O critério é você que
  escolhe — comece por um destes:"**
- Três kits, cada um com seus nomes visíveis e um botão que cria o conjunto
  inteiro:
  - **Pelo momento do culto** — Abertura, Adoração, Ministração, Encerramento
  - **Pelo estilo da música** — Lenta, Animada, Congregacional
  - **Pela ocasião** — Natal, Páscoa, Infantil
- Abaixo, o campo livre que já existe hoje, com o texto de apoio
  "Ou crie a sua".
- Rodapé: **"Depois de criadas, elas viram filtros na tela inicial e uma opção no
  editor de cada música."** — hoje o "para que serve" não é dito em lugar nenhum.

**Como o kit é criado:** POSTs sequenciais na API existente
(`backend/categorias/api.php`), um por nome, encadeando o `content_revision`
devolvido por cada resposta como `baseRevision` da chamada seguinte. Nome que já
existe na banda é pulado (resposta 409 tratada como sucesso silencioso), não
interrompe o restante do kit. Falha de rede interrompe o kit e exibe toast; as
categorias já criadas permanecem. Sem endpoint novo.

Estes três kits são exemplos editáveis a qualquer momento pelo gestor — renomear
ou excluir segue as regras que já existem.

### 3. Aba Categorias com categorias criadas

Cada linha passa a mostrar a contagem de músicas: **"Adoração · 12 músicas"**,
com as formas "1 música" e "nenhuma música". A contagem é calculada no cliente a
partir de `window.songs` (já disponível via `cifro-sync`), comparando
`song.classificacao` com o nome da categoria de forma insensível a caixa e
acento. Sem endpoint novo e sem consulta adicional.

A categoria em uso já não pode ser excluída (regra existente). Hoje isso só
aparece como erro depois do clique; passa a ser visível antes: o botão de excluir
fica desabilitado com o motivo em `title`/`aria-label`
("Adoração está em uso por 12 músicas").

### 4. Campo Categoria no editor de música

Continua um `<select>` nativo — mesmo comportamento em celular, mesma
acessibilidade, mínimo de código novo.

- Rótulo: **Categoria**. Primeira opção: **Sem categoria**.
- Para gestor+, último item da lista: **"+ Nova categoria…"**, que abre um campo
  inline para o nome, cria via API e já seleciona a categoria criada.
- Para músico não-gestor: lista normal, sem o item de criar, com a dica
  **"Só gestores criam categorias novas."** abaixo do campo.
- Quando a banda não tem nenhuma categoria: o select mostra só "Sem categoria" e
  abaixo aparece, para gestor+, **"Sua banda ainda não tem categorias. Criar
  agora"** (link para `minha-banda.php?aba=categorias`); para músico,
  **"Sua banda ainda não tem categorias."** sem link.

A distinção de papel na interface usa uma flag nova exposta pela view do editor,
no mesmo formato das existentes (`window.CIFRO_USER_ID`, `window.CIFRO_BAND_ID`):
`window.CIFRO_PODE_EDITAR_CONTEUDO`, preenchida por `can_edit_content()`. A flag
é só para a interface — a autorização real continua no servidor, em
`require_band_role('gestor')`.

### 5. Nome duplicado não cria categoria repetida

Hoje o `UNIQUE (banda_id, nome)` é exato, então "adoração" e "Adoração" convivem
como duas categorias distintas — e músicas ficam divididas entre elas.

Passa a haver comparação insensível a caixa e acento **no servidor**, dentro da
mesma transação da criação: se já existir equivalente, a API responde 409 com o
nome existente no corpo, e o cliente seleciona a categoria existente em vez de
criar outra. O índice `UNIQUE` atual permanece como rede de segurança.

Duplicatas que já existam em bandas de produção **não são fundidas** por este
trabalho — apenas deixam de surgir novas. Fusão de duplicatas existentes fica
fora de escopo.

### 6. Filtro da home passa a filtrar por categoria

Categoria e texto viram dois filtros independentes que se combinam:

- `aplicarFiltro(categoria)` deixa de escrever em `#search`. Passa a guardar a
  categoria ativa em estado próprio (mantendo a persistência atual em
  `sessionStorage`, chave `cifroHomeCategory`) e a pedir novo render.
- O render aplica: *(texto casa em nome, artista, categoria ou cifra)* **E**
  *(categoria ativa vazia OU `song.classificacao` igual ao nome da categoria
  ativa, comparação insensível a caixa e acento)*.
- O chip ativo passa a ser derivado do estado, não de comparar o `textContent`
  com o conteúdo do campo de busca.
- Digitar na busca não desmarca o chip; limpar o chip é feito clicando em
  "Todas".

Nenhuma mudança visual: mesmos chips, mesmo layout, sem chip "Sem categoria".
Música sem categoria continua listada em "Todas" e sai da lista quando um chip
específico está ativo — que é o comportamento correto e esperado.

### 7. Checklist "Configure sua banda"

Bloco no topo da Minha Banda (acima da navegação de abas em
`Views/banda/minha-banda.php`), visível apenas para gestor+, listando os passos
pendentes de configuração:

- Convidar músicos — concluído quando a banda tem mais de um membro
- **Criar categorias** — concluído quando a banda tem ao menos uma categoria
- Montar o primeiro repertório — concluído quando a banda tem ao menos uma
  playlist

Cada item pendente é um link para a aba correspondente. Item concluído aparece
marcado. O bloco inteiro desaparece quando todos os itens estão concluídos, sem
necessidade de dispensa manual.

**Limite conhecido e aceito:** o checklist só alcança quem entra na Minha Banda.
O músico que usa apenas a home não o verá. Foi uma escolha deliberada frente à
alternativa de uma faixa na home; se a incompreensão persistir entre músicos, a
faixa na home continua disponível como incremento posterior.

### 8. Ajuda contextual

Artigo **"Como funcionam as categorias"** na Central de Ajuda, cobrindo: o que é,
que o critério é da banda, como criar, quem pode criar, e onde a categoria
aparece depois. Link contextual com o padrão já existente no projeto
(`help-context-link`, como em `Views/index.php` no menu de repertórios) em dois
pontos: a aba Categorias e o campo Categoria do editor.

## O que não muda

- Esquema do banco: `musicas.classificacao`, tabela `categorias`, índices.
- Uma categoria por música.
- Categorias pertencem à banda, não ao usuário.
- Criação, renomeação e exclusão restritas a gestor+.
- Renomear categoria continua atualizando as músicas na mesma transação.
- Categoria em uso continua não podendo ser excluída.
- Payload e versionamento de sincronização.
- Aparência da home.

## Testes

Nomes em português de negócio, conforme a convenção do projeto.

**Unitários / integração (PHPUnit)**
- Criar categoria com nome equivalente a uma existente, diferindo só em caixa ou
  acento, devolve conflito e não cria segunda categoria.
- Criar categoria com nome novo continua funcionando e devolve nova revisão.
- Músico sem papel de gestor recebe 403 ao tentar criar categoria pelo editor.

**E2E (Playwright, ampliando `25-categorias`)**
- Banda sem categorias exibe os três kits na aba Categorias.
- Clicar em "Usar estas 4" cria as quatro categorias do kit de momento.
- Aplicar um kit cujo nome já existe não duplica e cria apenas os restantes.
- Lista de categorias mostra a contagem de músicas de cada uma.
- Excluir categoria em uso está bloqueado com o motivo visível antes do clique.
- Gestor cria categoria pelo editor sem sair da música e ela já fica selecionada.
- Músico não-gestor não vê a opção de criar e vê o aviso de permissão.
- Banda sem categorias mostra o aviso e o link no editor.
- Clicar no chip de categoria na home lista apenas músicas daquela categoria, e
  não músicas que apenas contenham a palavra na cifra.
- Chip e busca combinam: com o chip ativo, digitar um termo restringe dentro da
  categoria.
- Checklist "Configure sua banda" mostra "Criar categorias" pendente e some
  quando todos os passos estão cumpridos.

## Riscos

- **Kit parcialmente aplicado.** Falha de rede no meio da sequência deixa parte
  das categorias criadas. Aceito: o estado é visível na própria lista e o gestor
  pode reaplicar o kit, que pula as já existentes.
- **Contagem no cliente pode divergir.** Ela reflete o cache de sincronização,
  não o servidor. Aceito: é informativa, e o cache já é a fonte que a home e o
  editor usam.
- **Correção do filtro muda o resultado percebido.** Bandas acostumadas com o
  chip trazendo mais músicas verão listas menores. É a correção do defeito, não
  uma regressão.

# Todos os textos do Reel — para revisão

Marquei com **⚠️** o que eu acho que precisa mudar.

---

## 1. Legendas na tela (o que o espectador lê)

Ficam em `stage/timeline.js`, no array `SCENES`.

Versão produzida — 60s, 1800 quadros a 30fps.

| Tempo | Legenda | O que aparece na tela |
|---|---|---|
| 0:00–0:04 | Por que o *Cifrô*? | cartão de texto |
| 0:04–0:06 | Não precisa montar PDF | pilha de PDF |
| 0:06–0:10 | E quando muda a ordem do repertório? | folha riscada |
| 0:10–0:14 | E se precisar trocar de tom? | cifra em C, "vocal canta em E" |
| 0:14–0:16 | Até encontrar a playlist no grupo? | conversa de grupo |
| 0:16–0:22 | E quando precisa buscar uma cifra e tem propaganda? | app com banner |
| 0:22–0:26 | No *Cifrô*, não! | cartão de texto |
| 0:26–0:30 | Todas as músicas em um só lugar! | biblioteca do app |
| 0:30–0:32 | Playlist integrada! | menu de repertórios |
| 0:32–0:38 | o host troca. *todo mundo acompanha.* | dois celulares + troca de tom |
| 0:38–0:40 | *(sem legenda)* | rolagem automática |
| 0:40–0:42 | o roteiro pronto | roteiro do culto |
| 0:42–0:46 | ensaia o trecho difícil em loop | painel de ensaio, loop ativo |
| 0:46–0:50 | e funciona sem internet | cifra offline |
| 0:50–1:00 | **Cifrô** / Em breve. / segue aqui pra acompanhar | cartão final |

**Correções aplicadas:** "Por que" separado (era "Porque"), "se" minúsculo, e
**o Cifrô** no masculino em todo o material.

**A troca de tom entra sem legenda** dentro do trecho do Modo Live (0:32–0:38),
para a pergunta de 0:10 não ficar sem resposta.

⚠️ **O cartão final tem 10 segundos** — um sexto do vídeo parado no logo. Se
quiser, corto para 4s e devolvo 6s às telas de produto.

---

## 2. Mocks das cenas de dor

Ficam em `stage/stage.html`.

**Folha impressa (0:02–0:04)**
Título: `Culto de Domingo`
Lista: Amanhecer · ~~Estrada Velha~~ · Casa Cheia · ~~Passo Firme~~ · Luz da Manhã
Rabisco: `mudou!`

**Conversa de grupo (0:04–0:06)**
> alguem tem a cifra de Casa Cheia?
> `C  G  Am  F` *(print borrado)*
> esse print ta em C, eu toco em E

*A falta de acento aqui é proposital — é assim que se digita em grupo.*

**App com propaganda (0:06–0:08)**
`[Intro] E B C#m A` · `[Verso] E … B / C#m … A` · `[Refrão] E B C#m A`
→ **banner "Publicidade"** cortando o refrão →
`A E B C#m` · `[Refrão]` · `E B C#m A` *(esmaecidos)*

---

## 3. Roteiro que aparece na tela (0:40–0:42)

Título: `Ordem do Culto de Domingo` *(sem travessão — a fonte do cabeçalho não tem
o glifo `—` e ele virava dois quadrados violeta)*

> **Abertura**: recepção e boas-vindas com "Amanhecer".
> Entrada da equipe, check de som rápido, primeira música em G.
> **Louvor**: sequência "Estrada Velha" e "Casa Cheia".
> Emenda direto, sem parar entre as duas. Segunda em E.
> **Palavra**: pausa musical para a ministração.
> Teclado em base durante o final da mensagem.
> **Ministração**: "Passo Firme" e "Luz da Manhã".
> Clima de entrega, dinâmica baixa no primeiro verso.
> **Encerramento**: "Voltar pra Casa" para fechar.
> Repetir o refrão final enquanto a equipe sai.

Acentos corrigidos e o texto dobrou de tamanho, para preencher a tela.

---

## 4. Repertório (letras autorais, aparecem nas cifras)

Estrutura de cada música: Intro · Verso 1 · Refrão · Verso 2 · Refrão · Ponte ·
Verso 3 · Refrão · Ponte · Refrão final. São longas de propósito, para a cena de
rolagem ter o que rolar (493px de percurso real).

**Corrigido:** as terceiras linhas de cada verso agora fecham com ponto e fazem
sentido sozinhas. Antes ficavam penduradas ("Quem esperou a noite inteira").

### Amanhecer — 92 bpm — G D Em C
**V1:** A manhã nova sobre a estrada, / o passo firme outra vez. / quem esperou já pode cantar.
**Refrão:** Canta comigo esse começo, / que a noite já passou.
**V2:** O que era peso virou canto, / o que era pressa virou paz. / e o dia abre devagar.
**Ponte:** Não é o relógio que decide / a hora de recomeçar.

### Estrada Velha — 108 bpm — D A Bm G
**V1:** A estrada velha ainda lembra / de cada volta que eu já dei. / o asfalto guarda o que eu deixei.
**Refrão:** Segue comigo essa viagem, / que o caminho é quem me leva.
**V2:** Levo pouco na bagagem, / o resto o vento carregou. / fica o mapa que eu rasguei.
**Ponte:** Toda partida é uma promessa / de que um dia eu volto aqui.

### Casa Cheia — 126 bpm — E B C#m A
*(é a música do momento do Modo Live — a mais vista do vídeo)*
**V1:** A mesa posta, a porta aberta, / ninguém janta sozinho aqui. / chega quem vem, fica quem quer.
**Refrão:** Casa cheia é casa viva, / e a nossa nunca esvaziou.
**V2:** O barulho é bem-vindo, / a bagunça faz sentido. / cadeira sempre sobra pra mais um.
**Ponte:** Quem chegou por acaso / já não sabe mais sair.

### Passo Firme — 84 bpm — C G Am F
*(é a música da cena de ensaio)*
**V1:** Não é força, é insistência, / é levantar de novo e ir. / o chão não muda, quem muda sou eu.
**Refrão:** Passo firme, mesmo lento, / chega longe do lugar.
**V2:** Devagar também é avanço, / quem para é que fica pra trás. / conto os passos, não os anos.
**Ponte:** A pressa cansa antes da chegada, / a calma dura a viagem toda.

### Luz da Manhã — 96 bpm — A E F#m D
**V1:** A luz da manhã não pergunta / se a noite foi longa demais. / ela chega do mesmo jeito.
**Refrão:** Toda manhã é uma resposta / pra pergunta de ontem à noite.
**V2:** Abre a janela devagar, / deixa o escuro ir embora. / nada aqui ficou perdido.
**Ponte:** Se demorou, não foi ausência, / foi só o tempo do amanhecer.

### Voltar pra Casa — 72 bpm — F C Dm Bb
**V1:** Andei bastante pra saber / que o longe não me cabia. / toda distância me trouxe aqui.
**Refrão:** Voltar pra casa não é parar, / é finalmente chegar.
**V2:** Não é derrota quem retorna, / é quem descobriu o caminho. / deixo a estrada e fico aqui.
**Ponte:** O que eu procurava lá fora / estava esperando na porta.

---

## 5. Nomes que aparecem

- Banda: **Banda Demo** ⚠️ aparece no cabeçalho de toda cifra. Vale trocar por um
  nome que pareça banda de verdade.
- Host: **Felipe** · Membro: **Juliana**
- Playlist: **Culto de Domingo**

---

## 6. Textos do app que aparecem e não são meus

⚠️ São bugs do Cifrô, não do vídeo — mas aparecem na tela:

- `Audio loaded!` e `Choose File` — em inglês, no painel de ensaio
- `Felipe esta exibindo` — sem acento em "está", e o balão aparece cortado
  sobrepondo o botão de live

---

## 7. Legendas do Instagram

Estão em `copy/plano-4-semanas.md`, peça a peça, com as hashtags.

# NEON · Semana 1 do relançamento

Ordem: **Bio → Reel "Quem está por trás" → Case DR Veículos → 5 erros que queimam sua verba**
Intervalo: 1 post a cada 2 dias. Stories todo dia (bastidor, enquete, repost do post do dia).

---

## 0. Antes de postar

- [ ] Arquivar (não excluir) os 5 posts de frase: "Marketing não é estética", "Relevância não pede atenção", "Marca forte acelera", "O que realmente faz uma marca crescer", "O poder que a marca faz no mundo".
- [ ] Manter: Reel do Tiago, Início Julia Ávila, "Tudo começa com um bloco".
- [ ] Trocar a bio (abaixo).
- [ ] Mandar a mensagem do item 5 para o Tiago **hoje**. O case depende dela.

## 1. Bio

```
NEON | Tráfego pago e marca para negócios locais
Mais clientes vindo do Instagram e do Google, com número na mesa.
📍 [Cidade] · Diagnóstico grátis em 24h ↓
```
Link: página de diagnóstico do site.

---

## 2. Reel: "Quem está por trás da NEON" (30 a 40s)

Celular na vertical, luz de janela na frente do rosto, legenda na tela. Uma tomada só, sem cortes elaborados.

| Tempo | Fala | Na tela |
|---|---|---|
| 0–3s | "Você entregaria seu dinheiro de anúncio pra alguém que nem mostra a cara?" | Texto: **QUEM ESTÁ POR TRÁS DA NEON** |
| 3–8s | "Prazer, eu sou [seu nome], da NEON." | Nome + @neoncreates |
| 8–20s | "A gente cuida de tráfego pago e marca pra negócio local aqui de [cidade]. Hoje são 6 marcas, de 6 setores diferentes. Nenhuma saiu." | B-roll: você no computador, Gerenciador de Anúncios **com dados de cliente borrados** |
| 20–30s | "Aqui eu vou mostrar o bastidor: o que a gente testa, o que funciona e o que dá errado. Com número." | B-roll: tela de criação de um criativo |
| 30–35s | "Tem um negócio e quer saber onde tá perdendo cliente? Comenta DIAGNÓSTICO." | **COMENTA "DIAGNÓSTICO"** |

**Legenda:**
```
Agência que não mostra quem faz o trabalho pede pra você confiar no escuro.

Eu sou [seu nome]. A NEON cuida de tráfego pago e marca pra negócios locais de [cidade]. Hoje são 6 marcas, de 6 setores, e 100% continuam com a gente.

Daqui pra frente esse perfil vai mostrar bastidor real: campanha, criativo, erro e resultado. Sem frase bonita no lugar de número.

Quer saber onde seu negócio está perdendo cliente? Comenta DIAGNÓSTICO que eu te chamo no direct.
```

---

## 3. Carrossel: Case DR Veículos (7 slides)

Arquivos: `instagram/out/dr/01.png` a `07.png`. **Não postar enquanto houver amarelo.**
Para preencher: editar `instagram/cases.js` e rodar `npm run render` dentro de `instagram/`.

**Legenda:**
```
[X] contatos por mês. Depois, [Y].

A DR Veículos [o problema em uma frase].

O que mudou não foi "postar mais". Foi:
→ [ação 1]
→ [ação 2]
→ [ação 3]

Resultado [em 60 dias]: [número principal].

Arrasta pra ver o criativo que mais trouxe contato.

Quer o mesmo pro seu negócio? Comenta DIAGNÓSTICO.
```

---

## 4. Carrossel: 5 erros que queimam sua verba (7 slides, pronto)

Arquivos: `instagram/out/erros/01.png` a `07.png` (capa A).
Capas alternativas: `out/erros-capa-b/01.png` e `out/erros-capa-c/01.png` (troque só o slide 1).
Fonte: `instagram/erros.html` (`?capa=a`, `b` ou `c`).

**Legenda (capa A):**
```
Você não tem problema de verba. Tem problema de vazamento.

Os 5 erros que mais queimam dinheiro em anúncio:
01. Impulsionar em vez de anunciar
02. Mexer na campanha todo dia
03. Anunciar sem página de destino
04. Não medir o que importa
05. Criativo sem gancho

Conta quantos você comete e responde aqui com o número. Sem vergonha, todo mundo já cometeu pelo menos um.

Salva pra revisar antes do próximo anúncio. E se quiser que a gente olhe sua conta, comenta DIAGNÓSTICO.
```

---

## 5. Mensagem para o Tiago (mandar hoje)

```
Fala Tiago! Vou fazer um post contando o case da DR no Instagram da NEON, quero mostrar o trabalho que a gente fez junto. Pode me ajudar com 4 coisas rápidas?

1. Antes da gente começar, mais ou menos quantos contatos/mês chegavam pelo Instagram/WhatsApp?
2. E hoje, quantos chegam por mês?
3. Lembra de algum carro vendido que veio direto do anúncio? Quantos, mais ou menos?
4. Em uma frase: o que mudou pra você desde que a gente começou?

Se puder mandar a 4 em áudio ou vídeo curto, melhor ainda, aproveito no post. Valeu!
```

Os dados de custo por contato e de período saem do Gerenciador de Anúncios, não precisa perguntar a ele.

---

## Sobre "Comenta DIAGNÓSTICO"

Cada comentário precisa de resposta no direct em poucas horas, senão a chamada perde credibilidade. Se o volume crescer, automatizar com ManyChat.

---

## Extra: Carrossel "Seu perfil tá espantando cliente" (7 slides, pronto)

Arquivos: `instagram/out/perfil/01.png` a `07.png`. Fonte: `instagram/perfil.html`.
A "Navalha Barbearia" é um perfil fictício, criado só para o exemplo.

**Legenda:**
```
Seu perfil é a vitrine. E muita vitrine está com a porta fechada.

Antes de te chamar, o cliente olha 5 coisas:
1. Nome: você aparece quando ele pesquisa o que você faz?
2. Bio: diz o que você faz, onde e como comprar?
3. Destaques: respondem as dúvidas que ele mandaria no direct?
4. Fixados: mostram quem você é, uma prova e como comprar?
5. Link: leva direto pra conversa?

Quantos dos 5 o seu perfil já tem? Responde com o número.

Quer que a gente olhe o seu? Manda PERFIL no direct e a gente responde com os 3 ajustes que mais fazem diferença.

(Perfil de exemplo, criado pra este post.)

#instagramparanegocios #marketinglocal #[suacidade]
```

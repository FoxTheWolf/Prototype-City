# 07: Léxico de intenções para o diálogo por texto livre (ChatGPT ou Gemini)

Retorno esperado: **um único bloco JSON válido**, salvo em `docs/tarefas/retorno/07-intencoes.json`. O Claude confere por script (JSON válido, campos certos, sem palavras repetidas no mesmo intent).

--- COLE DAQUI ---

Estou fazendo um jogo de simulação de cidade (estilo Shadows of Doubt), ambientado numa cidade americana fictícia por volta de **2008**. O jogador pode **digitar uma frase livre em inglês** para um NPC (como no jogo Façade), e o jogo, **sem IA e sem internet**, reconhece o que a frase provavelmente é por **palavras-chave com peso** e regras simples. Preciso do léxico.

Quero um JSON com três partes:

1. `"intents"`: de 25 a 40 intenções. Para cada uma:
```json
{
  "id": "ask_where",                        // snake_case, único
  "what": "Asking where a place or person is.",
  "keywords": { "where": 3, "find": 2, "get to": 3, "located": 2, "way to": 3, "how do i get": 4 },
  "needs_question": true,                   // se costuma ser pergunta
  "slots": ["place"],                        // o que o jogo deve extrair da frase: place | person | thing | time | number | none
  "examples": ["Do you know where the bank is?", "how do i get to 5th ave", "where's a pharmacy around here"]
}
```
Cubra: cumprimentar, despedir, agradecer, desculpar-se, perguntar onde fica, perguntar o caminho, perguntar a hora, perguntar o preço, pedir para comprar, perguntar quem trabalha aqui, perguntar sobre uma pessoa, perguntar o que a pessoa viu (ontem, hoje), perguntar sobre um evento (apagão, batida, polícia), perguntar o nome, perguntar o emprego, elogiar, reclamar, pedir um favor, pedir dinheiro emprestado, oferecer dinheiro (suborno leve), mentir sobre ser alguém (técnico, policial, entregador: engenharia social), pedir para entrar num lugar, pedir para usar o telefone, pedir a senha do Wi-Fi, ameaçar (leve), flertar (leve e educado), pedir desculpas, dizer sim, dizer não, não entendi, mudar de assunto, falar do tempo.

2. `"tone"`: palavras e marcas com peso para o **tom** da frase, de -3 (hostil) a +3 (gentil), e para outros eixos:
```json
{
  "polite":  { "please": 2, "thank you": 3, "excuse me": 2, "sorry": 1, "sir": 1, "ma'am": 1 },
  "rude":    { "hey you": 2, "now": 1, "shut up": 3, "move": 1 },
  "urgent":  { "quick": 2, "hurry": 3, "now": 1, "!": 1 },
  "unsure":  { "maybe": 1, "i think": 1, "kind of": 1, "?": 0 },
  "lie_markers": { "trust me": 2, "honestly": 1, "i swear": 2 }
}
```
Pode acrescentar outros eixos que façam sentido (formal/informal, nervoso).

3. `"rules"`: de 15 a 30 regras simples, em texto, de como juntar tudo. Exemplos: "uma frase que começa com do/does/can/could/is/are/where/what/who/when/why/how, ou termina com ?, é pergunta"; "'not' ou 'n't' antes da palavra-chave inverte o sentido"; "se dois intents empatam, vale o que tem a palavra mais pesada"; "um nome de lugar conhecido na frase puxa para ask_where"; "frases com menos de 2 palavras-chave dão 'não entendi'". Pense em erros de digitação comuns e em gírias de 2008 (u, ur, pls, thx).

Regras do conteúdo: **linguagem limpa** (sem palavrão, insulto pesado, conteúdo sexual ou violência explícita, nem nas palavras-chave: para ameaça e grosseria use palavras leves como "or else", "back off", "get lost"). Tudo em inglês. Só o JSON, sem comentários dentro dele.

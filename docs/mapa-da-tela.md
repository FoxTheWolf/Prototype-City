# Mapa da tela (antes do diálogo, etapa 14)

> Feito em 2026-10-06 a partir do código (`main.ts`, `phone/draw.ts`, `phone/payphone.ts`, `watch/watch.ts`, `counter.ts`, `bagUi.ts`, `askWay.ts`). A grade da interface tem sempre **80 linhas**; as colunas seguem a janela (≈ 237 em 16:9). As posições abaixo estão nessa grade. O mundo é desenhado por baixo, numa grade própria.

## O que existe hoje

| Elemento | Onde | Tamanho | Quando |
|---|---|---|---|
| Celular | canto de baixo à **direita** (x de `cols−56` a `cols−6`) | 50 × 52 (46 linhas à mostra) | P/↑ tira do bolso; espiada de 9 linhas quando vibra |
| Orelhão (teclado e fone) | **direita**, um pouco mais para dentro (x de `cols−48` a `cols−12`, linhas 33–77) | 36 × 44 | F num orelhão; tira o lugar do celular |
| Relógio | canto de baixo à **esquerda** (x 6–38, linhas ~64–80) | 32 × 17 | I mostra/esconde |
| Notebook | **centro**, em 3D no mundo | a tela inteira de baixo | N, sentado ou encostado |
| Dicas de uma linha ("[F] OPEN", "[F] PLUG", "[F] SIT DOWN", preço do produto) | **centro de baixo**, linhas `rows−8` (72) e `rows−6` (74) | uma linha | olhando para o objeto |
| Balcão (pagar) | **centro**, 62 de largura, um pouco acima do meio | 62 × (13 + 2 por item) | F no caixa |
| Mochila | **centro-esquerda** (−16 do meio) | ~26 × 28 | B |
| Pedir direção (lista e resposta) | **centro** (lista); a resposta acima das dicas (`rows−12`) | até ~60 de largura | F num pedestre |
| Mira ("+") | centro exato | 1 célula | olhando um produto |
| Alerta de polícia | **topo, centro** (linha 1) | uma linha | perseguição |
| Faixa de prisão | **centro** (duas linhas no meio) | uma faixa | 7 s depois de preso |
| Painel de debug | **topo à esquerda** | até 74 × ~25 | F3 |
| Câmera de segurança | tela inteira, com texto nos cantos | — | C |
| Nota de playtest | caixa do navegador por cima | — | F8 |

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │[debug F3]                  [ALERTA DE POLÍCIA]                               │
 │                                                                              │
 │                                                                              │
 │                    [balcão / pedir direção / mochila]                        │
 │                                  +                                           │
 │                                                                              │
 │                                                          ┌───────────┐       │
 │                                                          │           │       │
 │                                                          │  celular  │       │
 │                     resposta de pedir direção            │    ou     │       │
 │ ┌────────┐            [dica do produto / tomada]         │  orelhão  │       │
 │ │relógio │            [dica de porta / balcão]           │           │       │
 └─┴────────┴─────────────────────────────────────────────────┴───────────┴──────┘
```

**Conflitos de hoje:** as dicas de uma linha disputam a mesma linha (74) e só uma aparece; o balcão, a mochila e pedir direção são janelas no meio da tela (substituídas pelo diálogo no caso do balcão e de pedir direção); entre o relógio e o celular sobram **~140 colunas livres embaixo**.

## O que o diálogo vai precisar (decidido em `docs/visao.md`)

- **Legenda** da fala do NPC, aparecendo aos poucos, com o nome (se conhecido): centro de baixo.
- **Caixa de texto** do jogador logo abaixo, com a **leitura de intenção** e o **medidor de tom** (o plano em dois eixos) acima dela.
- **Balões** curtos sobre a cabeça de quem passa e comenta, presos ao mundo.
- **Close-up** do objeto olhado (a etiqueta, o cardápio, a placa), numa versão 2D desenhada do objeto, ao lado dele.
- Tudo isso funciona também **ao telefone** (o celular ocupa a direita ao mesmo tempo).

## Proposta de zonas (do Claude; a decidir com o usuário)

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │[debug]                        (E) alertas                                    │
 │                                                                              │
 │        (B) balões presos às cabeças, só nos 2/3 de cima                      │
 │                                                                              │
 │                 (F) close-up ao lado do objeto,                              │
 │                     fugindo do celular e da conversa                         │
 │                                                          ┌───────────┐       │
 │                    (P) dica de uma linha                 │           │       │
 │            ┌────────────────────────────────┐            │    (C)    │       │
 │            │ (A) legenda do NPC (3 linhas)  │            │  celular  │       │
 │ ┌────────┐ │ intenção · tom [plano]         │            │           │       │
 │ │  (D)   │ │ > caixa de texto do jogador    │            │           │       │
 └─┴────────┴─┴────────────────────────────────┴────────────┴───────────┴──────┘
```

- **(A) Conversa:** a faixa de baixo entre o relógio e o celular (x ~44 até `cols−62`, ~130 colunas; linhas ~60–79). De cima para baixo: a legenda (até 3 linhas), a linha da intenção com o medidor de tom à direita (um plano pequeno, ~9 × 5), a caixa de texto. A mesma zona serve à ligação (o celular segue à direita).
- **(P) Dicas de uma linha:** sobem para logo acima da zona A (uma linha só, por prioridade: a do que está na mira primeiro); durante a conversa, somem.
- **(C) Direita:** celular ou orelhão, nunca os dois.
- **(D) Esquerda de baixo:** relógio; o caderno (etapa 22) entraria aqui, no lugar dele.
- **(E) Topo:** alertas e o debug.
- **(B) Balões:** presos ao mundo, só nos 2/3 de cima da tela; no máximo 2 ou 3 de uma vez, os mais perto primeiro; um balão que cairia sobre A, C ou D some.
- **(F) Close-up:** ao lado do objeto, do lado que tiver mais espaço livre de C, D e A; sem espaço, no quadrante de cima à direita (acima do celular).
- **Janelas do meio (balcão, pedir direção):** viram a conversa (zona A). A mochila continua no meio, porque é uma tela de mexer (regra 2D/3D).

## Decisões do usuário (entrevista de 2026-10-06)

- **Ao telefone, o celular abaixa até a espiada** (só o topo à mostra) e a conversa fica na zona A, igual à conversa ao vivo: a conversa tem sempre o mesmo lugar.
- **A conversa como legenda de filme:** sem moldura; a fala do NPC em letras claras com sombra escura, o nome em âmbar na frente; só a caixa de texto do jogador tem uma borda fina; a intenção e o medidor de tom logo acima dela, discretos. Se a fala ficar difícil de ler de dia, escurecer um pouco o fundo atrás das letras (sem virar painel).
- **Balões, e de perto vira legenda:** balões sobre a cabeça de quem fala, no máximo 3 de uma vez, os mais perto primeiro, até ~12 m; mais longe, um balão vazio (`...`). A menos de ~3 m, a frase também aparece na zona A, mais apagada e sem a caixa de texto, como uma conversa ouvida sem querer (o "quem está perto ouve").
- **O close-up aparece sozinho:** olhando ~0,5 s para um objeto a até ~1,5 m; some ao desviar o olhar. Substitui a caixa de preço de hoje; F na mira continua pegando o produto. Sem espaço ao lado do objeto, vai para o quadrante de cima à direita (padrão do Claude).

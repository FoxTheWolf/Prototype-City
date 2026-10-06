# Retoques das etapas 14 (diálogo) e 15 (web/celular)

> Vindos do playtest e da caixa de feedback de 2026-10-06 (texto cru em `docs/feedback-arquivo.md`). O Plano no CLAUDE.md aponta para cá numa linha só, para não inchar. Ao fazer um item, mover para `docs/historico.md` e apagar daqui.

## Etapa 14 — diálogo

- **Memória de follow-up (prioridade; confirmado no playtest):** a pessoa guarda o assunto da última fala, para a pergunta seguinte casar. No playtest: "did you catch the game?" (talk_sports) → "who won?" caiu em NÃO ENTENDIDA. Guardar o último `intent`/tópico na conversa e, numa pergunta curta de continuação ("who won?", "what was the score?", "are you sure?", "where is that?"), responder no contexto dele. (`src/talk.ts`, `sim/intent.ts`.)
- **Intenções que faltaram no playtest** (`docs/tarefas/retorno/07-intencoes.json` + `sim/intent.ts`): pedir cardápio/comida num balcão — "can I see the menu?", "what do you serve here?", "what's on offer?", "I wanna eat something", "I wanna stay for a night" (num motel → já existe ask_where, mas a frase direta de alugar quarto não casou); social — "i wanna be your friend", "are you a hacker". Decidir quais viram intenção e quais caem num reconhecimento mais tolerante.
- **Highlight de sintaxe na caixa de digitação:** enquanto o jogador digita, colorir os operadores com peso que o parser identifica (how, where, who, when, what…) e o nome de lugar reconhecido, cada um com a sua cor, para mostrar o que foi entendido. (A caixa de fala; alinhar com `sim/intent.ts`.)
- **Autocomplete de lugares:** sugerir lugares que o jogador conhece/referenciou e os que estão perto (ex.: olhando o Nolan & Santos Bank, "where is Nolan…" já sugere). Usar os negócios perto do jogador + os já citados.
- **Tone com cor:** o indicador de tom (Respectful/Neutral/Friendly…) colorido — respectful em verde, etc.
- **Tirar "unrecognized"/"recognized":** sem reconhecer, mostrar só "type what you want to say"; ao reconhecer, mostrar a intenção/algo. Nada de rótulo "unrecognized".
- **Legendas dos pedestres em volta:** tirar da caixinha atual e pôr em outro lugar (decidir onde — perto de cada pessoa?).
- **Tamanho das letras:** aumentar um pouco o texto da caixa de fala e das legendas.

## Etapa 15 — web / celular

- **Reorganizar a grade do celular:** Snake sai para o MyApps; Lodestar Mini assume a posição que era do Streetwire; os demais deslocam. Ordem final: Calls, Contacts, Messages, Camera, Maps, Lodestar Mini, Streetwire, News, Weather. (`src/phone/apps.ts` / grade de ícones.)
- **Celular mais fácil de tirar com o notebook aberto:** tooltip com a tecla do celular; botão do meio do mouse tira/guarda o celular; e, quando a notificação sobe no rodapé com o notebook aberto, clicar nela levanta o celular. (`src/phone/phone.ts`, `src/laptop/`.)
- **Barra de favoritos no Lodestar:** pré-instalada com os importantes (o buscador Lookwise, o webmail); **o fórum de hacking não vem de fábrica** (o jogador o encontra pelo mundo). Por ora, em debug, a barra também traz o fórum — marcar como debug para tirar depois. Organizar num só lugar o que é atalho de debug.
- **Gerenciador de abas no Lodestar:** abrir várias abas (resolve o cadastro que pede confirmação por e-mail sem sair do site). E/ou: todo e-mail de confirmação que referencia o endereço traz um hyperlink que abre o webmail; se a inbox já está aberta noutra aba, vai para ela. Ou o webmail como seção permanente do Lodestar.
- **Links visitados em roxo:** escurecer em roxo os links já clicados, guardados na cache do navegador. (A parte de tokens/cookies/RAT foi para `docs/feedback-opus48.md`, é `[HACKING]`.)

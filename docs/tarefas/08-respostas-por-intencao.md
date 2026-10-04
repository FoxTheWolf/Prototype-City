# 08: Respostas dos NPCs por intenção e tom (Gemini ou ChatGPT; depois da tarefa 07)

Retorno esperado: **um único bloco JSON válido**, salvo em `docs/tarefas/retorno/08-respostas.json`. Mandar junto a lista de `id` dos intents da tarefa 07.

--- COLE DAQUI ---

Jogo de simulação de cidade americana de **2008**, tom noir mas **linguagem limpa** (sem palavrão, insulto pesado, conteúdo sexual nem violência). O jogador fala com estranhos na rua e com funcionários de lojas; o jogo reconhece a intenção da frase (lista abaixo) e o tom (gentil, neutro, grosseiro). Preciso das **respostas dos NPCs** no formato de gramática do jogo:

- Cada chave é `reply.<intent>.<tone>` (tone: `nice`, `plain`, `rude`) e o valor é uma lista de frases curtas (até ~20 palavras).
- Uma frase pode começar com condições entre colchetes, que limitam quem a diz: `[old/senior]`, `[teen/young]`, `[kids]` (tem filhos), `[job]`, `[retired]`, `[evening/late]`, `[morning]`, `[rain]`. `/` é "ou", espaço é "e", `!` é "não". Ex.: `"[old/senior] Oh, what a polite young person."`
- Peso opcional na frente: `"3|Sure thing."` (mais provável).
- Lacunas que o jogo preenche: `{place}`, `{road}`, `{first}` (o nome de quem fala), `{job}`, `{biz}` (onde trabalha), `{district}`, `{time}`.
- Símbolos de outra lista: `#nome#` (pode criar listas auxiliares, ex. `"#shrug#"`).

Quero de 6 a 10 frases por chave, com variedade de idade e humor; quem é tratado com grosseria responde mais seco ou vai embora; quem é tratado com gentileza ajuda mais. Inclua também `reply.confused` (não entendeu a frase), `reply.banter.nice|plain|rude` (respostas leves a conversa sem intenção séria: piada, bobagem) e `reply.leave` (encerra a conversa).

Intents: (colar aqui a lista de `id` da tarefa 07).

Só o JSON.

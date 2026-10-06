# QoL do terminal do notebook — pesquisa e escopo (15.7e / depois)

> Levantamento (2026-10-06, pedido do usuário) das qualidades de vida que o VS Code e os shells modernos (bash, zsh, fish) têm, para avaliar o escopo do que falta no terminal do jogo. **Decisão do usuário (2026-10-06): o caderno (etapa 22) NÃO é pré-requisito** — fazemos a UI do terminal (drop-up, campos) agora, e o caderno nasce já adaptado a ela (clicar no caderno preenche a chave quando ele existir). Marcar aqui o que vira tarefa; ao fazer, mover para `docs/historico.md`.

## Já feito no terminal do jogo
- Encadear comandos `&&` / `||` / `;` (15.7e-a), respeitando aspas.
- Auto-par de aspas: digita `"` → `""` com cursor no meio; redigitar a de fechar passa por ela; Backspace tira o par (15.7e-b/f).
- Tab completion de **nome de comando e caminho**, por segmento (inclusive depois de `&&`/`;`/`||`) (15.7e-e).
- Tab **monta o molde** de alguns comandos (iwconfig/tdump/wcrack) com o ESSID mais forte prefilled (15.7e-d, fatia).
- Clicar em **qualquer campo** do output (IP, host, MAC/BSSID, ESSID, chave) cola no comando (15.7e-c).
- Histórico com ↑/↓; edição de linha (Home/End/←/→/Backspace/Delete); Ctrl+C (interrompe), Ctrl+L (limpa); redirecionar `>`/`>>`; selecionar+copiar e Ctrl+V; scrollback (PageUp/Down).

## Faltando — do shell (bash/zsh/fish)
Ordenado por valor para o jogo (o terminal é a ferramenta central do hacking), com esforço estimado.

1. **Autosugestão fish-style (ghost text)** — enquanto digita, mostra em cinza a continuação mais provável (do histórico ou do contexto); →/End aceita. *Alto valor, médio esforço.* Ensina os comandos sem o jogador decorar.
2. **Realce de sintaxe ao digitar (fish/zsh-syntax-highlighting)** — comando conhecido em uma cor, flags em outra, aspas/strings, IP/host/ESSID reconhecidos coloridos; comando inexistente em vermelho. *Alto valor, médio esforço.* Casa com o pedido de realce do diálogo (14) — mesmo princípio.
3. **Menu de completar (drop-up) com Tab ciclando / setas** — quando há vários candidatos, um menu suspenso em vez de só listar; Tab cicla, Enter escolhe. Base para o item 4. *Médio valor, médio-alto esforço (overlay + input).*
4. **Completar de argumentos e flags, com contexto (o "campos estilo VS Code", resto do 15.7e-d)** — `iwconfig <Tab>` sugere `wlan0`; depois de `essid` o drop-up lista os ESSIDs do último `iwlist`; `-c`/`-w` sugeridos; **Tab alterna entre os campos** do molde; clicar num ESSID/num campo preenche. *Alto valor, alto esforço — a peça grande.* Depende do item 3.
5. **Busca reversa no histórico (Ctrl+R)** e **busca por prefixo** (digita prefixo + ↑). *Médio valor, baixo-médio esforço.*
6. **Histórico persistido no save** (hoje o histórico é da sessão do shell; perde ao desligar). *Médio valor, baixo esforço — entra no save como `w.forum`.*
7. **Atalhos de edição estilo readline:** Ctrl+W (apaga palavra atrás), Ctrl+U (limpa linha), Ctrl+K (apaga até o fim), Ctrl+A/E (início/fim), Ctrl+←/→ e Alt+B/F (andar por palavra). *Médio valor, baixo esforço.*
8. **Clicar para posicionar o cursor dentro da linha de input** (hoje o clique só cola campos do output; não move o caret na linha sendo digitada). *Médio valor, baixo esforço.*
9. **"command not found" com dica de pacote** ("o programa X está no apt / no fórum"), estilo command-not-found do Ubuntu. *Baixo-médio valor, baixo esforço.* Casa com o apt.
10. **Expansão de histórico `!!` / `!$`** e **aliases**. *Baixo valor, baixo esforço.* Talvez não valha (pouco usado por quem não é power user).
11. **Correção ortográfica ("did you mean cd?")**. *Baixo valor, baixo esforço.*
12. **Edição multilinha / continuação de comando** (um comando que segue na linha de baixo). *Baixo valor para o jogo; pouco usado aqui.*

## Faltando — do editor (VS Code), para o `nano`/editor e a linha de input
- **IntelliSense / popup de completar com descrição** (o item 3/4 acima aplicado ao editor).
- **Hover com dica** (passar o mouse num comando/flag mostra o que faz — versão leve do `man`).
- **Parameter hints / snippets com campos navegáveis por Tab** (o item 4).
- **Destaque de par de parênteses/aspas**; **auto-indent**; **find/replace** no editor. *Baixo valor para o escopo atual.*

## Ordem sugerida (proposta do Claude, a avaliar com o usuário)
Uma passada de "terminal que se explica", de alto valor e esforço crescente:
- **Bloco 1 (barato, alto retorno):** 2 (realce de sintaxe) + 1 (autosugestão). Deixam o terminal legível e guiado sem decorar. Também destravam o realce do diálogo (mesmo motor de cores).
- **Bloco 2 (a peça grande):** 3 (drop-up) → 4 (campos/argumentos com Tab e clique). É o "campos estilo VS Code" completo. Fazer agora; o caderno (etapa 22) se adapta a ele depois.
- **Bloco 3 (readline, barato):** 5, 6, 7, 8 juntos (busca no histórico, persistir, atalhos de edição, clicar no input).
- **Deixar para depois / talvez nunca:** 9–12 (baixo valor).

## Notas de implementação
- O realce e a autosugestão são **render** (desenhar a linha de input com cores / ghost text em `draw.ts`), lendo o que o parser do shell já sabe (comandos conhecidos, `cmdSegmentStart`, `argTemplate`, `net.list`). Sem mudar o modelo de input.
- O drop-up e os campos navegáveis **mudam o modelo de input** do shell (placeholders, campo focado) + um overlay em `draw.ts`/`wm.ts` + o roteamento de clique (`wm.ts`). É a parte que pede desenho cuidadoso; é a razão de ser "peça própria".
- Tudo isso é do shell (`src/laptop/shell.ts`), que é faixa sensível (`[HACKING]`): seguir `docs/mapa-shell.md`.

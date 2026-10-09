# Listas fixas: correções pequenas e retoques de luz

> Saíram do CLAUDE.md em 2026-10-06 (enxugamento). Lá fica só o ponteiro. Ao fechar um item, levá-lo para `docs/historico.md` e apagar daqui; itens novos entram aqui direto.
>
> **Desde o cronograma (2026-10-08):** estes itens já estão distribuídos nos blocos de correção C1–C10 de `docs/cronograma.md` (a lista diz qual bloco faz o quê); os retoques grandes de luz (nuvens, cones, sombras, saturação da noite, lua e estrelas) vão para a **etapa 23**. Item novo passa pela triagem (quebra / ajuste / depois) e entra no bloco seguinte com vaga, não aqui solto.

## Lista fixa: correções pequenas (Sonnet)
> Correções localizadas, sem sistemas novos. **Feitas pelo agente `bugfix`** (`.claude/agents/bugfix.md`: Sonnet 5.5, esforço médio) chamado de dentro de uma sessão normal, com um pedido curto (o bug, os arquivos, como conferir); não precisa de sessão própria. Juntar vários bugs num pedido só, porque cada chamada relê o contexto.
- **A 200 linhas sobram linhas embaixo da linha de status** (celular transparente embaixo, faixa preta na BIOS): provavelmente resolvido pela R.38; só conferir.
- **Ligação recebida pelo mouse:** botão esquerdo atende, direito rejeita.
- **Discador: o nome do contato aparece por cima do número digitado:** levar o nome para cima ou para baixo do número (`calls` em `src/phone/apps.ts`).
- **Misclick no celular confirma/cancela:** clicar fora do teclado não deve confirmar nem cancelar (`phone.ts`, o clique do ponteiro livre).
- **Som de apagão só no quarteirão afetado** (`audio/blackout.ts`/`sound.ts`, pela distância ao corte).
- **As portas de rua não abrem sozinhas** quando o jogador chega perto.
- **Rede social:** espaçar posts com o mesmo motivo (`sim/social.ts`); juntar as peças de `docs/tarefas/retorno/03-posts-streetwire.json` (conferir por script).
- **Postes do andaime e dos pontos de ônibus não são sólidos.**
- **Notebook** (só `src/laptop/draw.ts`/`laptop.ts`, não o shell): limitar o olhar para baixo com ele aberto; os nomes das teclas aparecem através da tampa fechada; luzes de energia e disco, marca e câmera maiores, botão de ligar acima do Delete.
- **Chuva vista nas paredes internas** dos interiores (provavelmente o `fallOver` em `gpu/shader.ts`).
- **Agradecimentos pelo sobrenome** onde o nome inteiro soa estranho (`thanks()` em `locale/names.ts`).
- **Placas de rua dentro do semáforo:** o braço do semáforo corta a placa (`streetBlade`): levar a placa para a ponta do braço, do lado da calçada; o verde mais escuro e o branco mais claro.
- **Os dígitos do relógio na camada HD (240 linhas)**, com o formato de sete segmentos dos Casio (os segmentos chanfrados), como no Ostranauts (`referencias/48`) (pedido do usuário em 2026-10-05).
- **Barras de fome e cansaço no relógio** (já existem: `sim/needs.ts`, o estômago e o fôlego): duas barrinhas no topo do visor, uma de cada lado (`watch.ts`).
- **Barra de batimentos no centro do relógio**: a terceira barrinha, no meio do topo do visor; quanto mais alto o batimento, menos fôlego.
- **O relógio acende a luz** quando sobe sozinho com o sinal de hora ou o alarme (`watch.ts`).
- **Menu com as câmeras:** o modo CCTV (já existe como "WATCH CCTV") vira o **fundo padrão** do menu, no lugar da vista do jogador girando; clicar em "WATCH CCTV" só tira o menu da frente. Cuidado: a câmera é 4:3 e o menu é adaptativo (mínimo de linhas): moldura ou barras.
- **Notícias dominadas por batidas e apagões (retorno do usuário em 2026-10-04):** um limite de manchetes por assunto numa janela de tempo (`locale/news.ts`/`sim/events.ts`); junto, a notícia do apagão só depois que a luz volta.
- **A barra de status do notebook some com o navegador aberto (feedback 2026-10-06):** o "negocinho no canto" com os status do notebook (specs/rede/hora) desaparece quando o Lodestar está aberto. Casa com a limitação conhecida de que, com o wm aberto, o terminal é desenhado por `wm.cells()`; a barra de status deve continuar por cima do navegador. **Provavelmente `src/laptop/draw.ts`/`wm.ts` (camada de UI, NÃO o shell** — não abrir `shell.ts`).
- **O celular usa o plano de dados mesmo no Wi-Fi (feedback 2026-10-06):** ao navegar no Lodestar conectado a um Wi-Fi, o celular parece consumir o plano de dados móvel em vez do Wi-Fi. Conferir o roteamento de rede do celular (`src/phone/`, a escolha Wi-Fi x dados; não é o `cellLog`/telco de hacking).

- **OPEN/CLOSED longe da porta (nota F8 de 2026-10-08, `playtest/2026-10-08_11-43-54_seed1383928503_note1.png`):** afastar a placa ~20% mais da porta, para ficar no vidro da vitrine.

### Da caixa de feedback de 2026-10-06 (playtest seed656322502)
- **Webmail: erro mudo com senha < 6 caracteres** no cadastro — mostrar a mensagem de "senha curta" (`src/web/webmail.ts`/`sim/mail.ts`).
- **Endereço de e-mail longo demais:** o domínio usa o nome inteiro da cidade ("newlockwoodonline.com"). Encurtar para 6–8 caracteres do nome (`sim/mail.ts`, a geração do domínio).
- **Link "find" na homepage não funciona** (portal, `src/web/sites.ts`): o link da busca na página de entrada não leva ao Lookwise.
- **Electron captura o botão "voltar" do mouse** e recarrega o jogo: desligar essa bind no Electron; se precisar, usar só dentro do navegador do notebook (`electron/main.cjs`/preload).
- **T9 não reconhece "motel":** revisar os termos relevantes do jogo no dicionário T9; considerar uma lista de dicionário T9 real (`src/phone/` T9).
- **Orelhão mostrar o custo da ligação** antes/ao discar; conferir, pelos playtests, se as situações de devolver o dinheiro estão cobertas (payphone).
- **ESC durante a conversa ainda abre o menu:** deveria fechar o diálogo primeiro.
- **Colunas geram muito perto da parede** (nota F8 5): fundir colunas coladas na parede com a própria parede (`sim/interior.ts`/geometria).
- **Legibilidade de placas por blocos:** a placa "GO" e as letras do semáforo de pedestre e da placa ao lado ficam quase invisíveis de perto/por tamanho (notas F8 8, 9) — compor por pontos/blocos como os letreiros (princípio "pontos de perto, ASCII de longe"), e a placa ao lado retrorreflexiva.

## Lista fixa: retoques de luz (Opus)
- **Cores:** o usuário julga as paletas com a **F4**; falta a saturação da noite (perguntar: forte demais ou fraca?). **Saturação demais** (faixas roxas no vidro, saguão verde-água): pedir capturas com a posição (`POS`).
- **A tela do celular clara demais** (reforçado pelo usuário em 2026-10-04): as telas muito brancas do celular com um fundo um pouco mais escuro, **dependente do tema** (um branco gelo, um cinza claro), o que também tira o bloom excessivo; depois, se ainda precisar, o bloom e a adaptação do olho (`render/eye.ts`, `EYE.k`/`pageDim`, e o bloom em `gpu/shader.ts`).
- **O bloom do relógio parece falso** (retorno do usuário em 2026-10-04): muito bloom na borda e quase nenhum dentro do visor; os dígitos pretos não são cobertos pelo brilho. O halo da luz azul deve passar também por cima dos dígitos e do papel do visor (`watch.ts`, `WATCH_LCD`, `HALO_TINT` em `gpu/compositor.ts`).
- **Lua e estrelas (retorno do usuário em 2026-10-05, depois da 13.10d3):** (1) as manchas dos mares não ficaram boas: refazer **a partir de uma imagem de referência**, sem arquivo de imagem no jogo ("Tudo é código"): o Claude propõe uma foto da NASA e a baixa com o sim do usuário para `referencias/lua/`, mede em Python e ajusta ~15 manchas aos mares, conferindo por número; (2) **os mares cortam os god rays** (faixas escuras saindo de baixo da lua): a fonte dos raios deve usar o disco liso, sem a textura; (3) as estrelas ainda deixam **rastro**: bloom leve e **mais estrelas** fracas pela semente (pedido do usuário).
- **A lâmpada das marquises verdes** sem a emissão nova: dar `gEm` como os letreiros.
- **Placas retrorrefletivas:** as placas de rua e de direção viradas contra o sol ficam escuras; dar um brilho leve de retrorrefletor (o Claude decide como, retorno do usuário em 2026-10-04).
- **Chão na chuva com ladrilhos clareando e escurecendo:** código antigo de chão molhado; achar e tirar.
- **Blackout de noite claro demais:** a luz que sobra com `cityLit` = 0 (céu, `cityAmb`, névoa, lua); depois `ADAPT_DARK`.
- **Alguns lugares acendem a luz de rua durante o blackout (nota F8 do playtest, 2026-10-06, `seed842808843_note1`):** certos postes/lugares seguem iluminados mesmo com a subestação deles caída. Conferir se esses postes estão ligados à subestação certa (`power.lamp[k]` em `sim/power.ts`) ou se alguma fonte de luz (letreiro/janela/holofote com backup) não respeita o corte; comparar com `generator`/`backup` (quem tem gerador fica aceso de propósito — distinguir dos que não deviam).
- **Nuvens e raios, se ainda incomodarem:** os degraus dos 12 passos (um deslocamento por célula pequeno e estável, ou um desfoque leve); um desfoque 3×3 nos raios.
- **Se o usuário quiser:** cones de luz nos holofotes das fachadas e nos faróis; a névoa laranja da cidade com luz de baixo para cima nas fachadas perto do centro.
- **Ainda não feito na luz:** a sala vista de fora sem o rebote; os painéis, os faróis e os letreiros não fazem sombra; os prédios não fazem sombra da luz dos postes; os objetos atrás do jogador não fazem sombra dos postes à noite. A grade de luz em voxels (a L.5 adiada, e as 16 direções do céu calculadas uma vez por lugar) só se o escuro das sombras incomodar.
- **Ajustes, para achar rápido:** `LAMP_SH_FAR`, `MOON_SHADE`, `CONE_K`/`CONE_FAR`/`CONE_DRY`/`CONE_WET`, `SKY_DIRS`, `REFL_OBJ_FAR`, `SIGN_EMIT`, `SCREEN_EMIT`, `SIGN_GLOW`, `SIGN_FILL`, `SIGN_EYE`, `BOUNCE_SUN`/`BOUNCE_SKY`, `DAYLIGHT_WIN`/`DAYLIGHT_FALL` em `gpu/shader.ts`/`gpu/objects.ts`; `SIGN_LIGHT`, `SCREEN_LIGHT`, `SCREEN_DAY`, `SIGN_DAY` em `raycaster.ts`; `ADAPT_DARK` em `gpu/world.ts`; `SURGE`/`SURGE_K`/`EYE_DARK_S`/`EYE_BRIGHT_S`/`EYE_PUSH_*` em `render/power.ts`. Os sons de apagão gravados do usuário ficam só no desenvolvimento (`EGG_SOUNDS`; **nunca empacotar `easter eggs/` no `.exe`**).

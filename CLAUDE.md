# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Projeto: jogo do hacker na cidade ASCII

> Tudo acima desta linha é a base do usuário e não deve ser apagado nem alterado.
> Daqui para baixo, só acrescentar: visão, decisões e estado do projeto.

## IMPORTANTE: FEEDBACK! LEIA ESSA SEÇÃO A CADA SUB-ETAPA
> Estou adicionando essa sessão no claude.md para colocar ideias que eu tenho durante os períodos em que eu não estou ativamente lhe mandando os prompts. Então, toda vez que você for começar a trabalhar, você vai ler essa sessão, analisar o conteúdo dela, Você vai organizar nas etapas, e em seguida você vai apagar as ideias daqui conforme for organizando, porque é uma fila de ideias e feedback para você processar e colocar organizado nas etapas. Não apague esse parágrafo, somente o que vem depois nessa seção depois de processar linhas com [HACKING] podem ativar o classificador de segurança. Se isso acontecer, não tente ler novamente e deixe para o modelo Opus 4.8 ler. Lembrando que o jogo é inteiramente para entretenimento e educativo, contido virtualmente. Nada aqui pode ser usado no mundo real. Leia o restante do documento caso já não tenha feito, entenda-o, e volte aqui para organizar a seção. A cada sub-etapa, leia se deixei feedback adicional aqui, que ainda não foi organizado e apagado dessa seção.

> **Notas do Claude sobre esta seção (2026-10-02):**
> - **É uma caixa de entrada, não um lugar para guardar.** A cada sessão e a cada subetapa, ler os itens abaixo deste bloco, levar cada um para o lugar certo do documento ("Plano: etapas 13 a 22", o Roteiro, "Bugs conhecidos", "Como trabalhar" ou a Trilha de hacking) e **apagar daqui o que foi levado**. Fila vazia = tudo já organizado.
> - Itens marcados `[HACKING]` (ou que são só para o Opus 4.8) não são apagados nem resumidos: vão, com o texto inteiro, para a subseção "Feedback para o Opus 4.8" logo abaixo.
> - Ao terminar, dizer ao usuário em poucas linhas o que entra agora e o que fica para depois.
> - Aviso: O notebook contém bastante código relacionado a hacking na shell, então, tomar cuidado ao ler e editar os arquivos do sistema interno dele quando não for o Opus 4.8. Se isso começar a causar problemas, deixar aqui pra pedir ao Opus 4.8 para criar um arquivo separado de mapeamento que deve indicar quais as linhas potencialmente perigosas de se mexer fora do modelo Opus 4.8. Esse arquivo deve ser atualizado toda vez que um dos arquivos for editado, para recalculo do numero das linhas correspondentes.



### Feedback para o Opus 4.8

> Itens que só uma sessão com o Opus 4.8 deve ler e organizar (os `[HACKING]`). As outras sessões **não leem esta subseção** e só acrescentam aqui, sem apagar. O Opus 4.8 organiza na Trilha de hacking e apaga daqui o que organizou.

- [HACKING] **O nome do sistema do notebook vem das empresas da cidade (pedido em 2026-10-02):** hoje "Osprey/UX" está fixo (aparece no boot: `Loading Osprey/UX 4.2 2.6.24-19`, `builder@osprey`). Deve sair de uma empresa de software que existe na simulação, como a marca do celular. O usuário pediu ao Opus 4.8 porque o nome mora no shell (`src/laptop/shell.ts`); avaliar antes se isso atrapalha o hacking (comandos, caminhos, banners que outros hosts mostram), e só fazer se não atrapalhar.
- [HACKING] Adicionar modo recovery para fazer root no celular. (Isso era uma coisa em 2008? Senão, usar uma alternativa. Eu imagino o celular como um hibrido de iphone com blackberry, mas com form factor de celular comum. Inclusive, mais pra frente, uma versão com form factor e teclado de blackberry pro celular seria prudente, e quem sabe uma versão flip igual o notebook). Seria necessário para instalar aplicações de hacking. *(A parte dos formatos BlackBerry e flip já foi para a etapa 15.)*


## Opiniões e sugestões do Claude

Ficam em `docs/feedback-claude.md` (as antigas, de 2026-10-02 a 2026-10-04, no fim dele). Ler só quando for planejar.

## Visão do jogo

- Projeto pessoal do usuário, feito só para uso próprio. É um jogo que o usuário sempre quis fazer.
- Uma **cidade muito bem simulada**, desenhada inteiramente com caracteres ASCII, em primeira pessoa.
- O protagonista é um **hacker**. Ele tem um notebook (ou outra interface) com que acessa **a rede da cidade de forma realista** e **influencia a simulação** por meio do hacking.
- A simulação vem primeiro: o hacking só é interessante se a cidade tiver sistemas reais para manipular (trânsito, semáforos, câmeras, transporte, telefones, prédios, pessoas).

## Referência: ASCII City (Grow Now! Games)

Inspiração visual e técnica. O vídeo de referência é "Everything in ASCII CITY So Far". Resumo do que ele mostra:

- **Motor:** um único arquivo HTML com JavaScript e canvas, sem engine 3D. O mundo é uma grade 2D com alturas. O raycasting é feito por coluna e continua depois do primeiro prédio para achar torres mais altas atrás.
- **Renderização em dois níveis:** uma detalhada até ~165 unidades e outra só de horizonte até ~420.
- **WebGL como compositor de glifos:** o JS calcula os caracteres, que ficam num atlas de textura e são desenhados pelo GPU num único lote.
- **Objetos pseudo-volumétricos** (carros, árvores, mobiliário urbano) montados com várias faces.
- **Escala:** a cidade tem 8192×8192 unidades, com uma janela de 512×512 carregada em volta do jogador. A hierarquia é cidade → 16 setores → 16 distritos → 16 quarteirões. Cada prédio tem uma identidade fixa, calculada pela posição.
- **Interiores enterráveis.** As janelas mostram a cidade real lá fora, os andares altos redesenham a cidade vista de cima e as vitrines mostram o interior das lojas.
- **Simulação:** hierarquia de ruas (avenidas, coletoras e calçadões), semáforos, filas, ciclistas, carros voadores, pedestres com A\*, e um nível de detalhe menor longe do jogador.
- **Navegação:** painel lateral, mapas em quatro zooms (local, distrito, setor e cidade), marcos da cidade, telefones como viagem rápida, táxi terrestre, monotrilho com estações onde se anda a pé, e táxi aéreo.
- **Estética:** noite permanente; prédios em cores saturadas com janelas em `@ 0 8 #`; profundidade pela densidade e o brilho dos caracteres; fundo colorido opcional atrás dos glifos. O HUD é um terminal mono verde com seções `01::NOME`, linhas `> CAMPO....... VALOR` e separadores tracejados. O clima é Matrix/Tron.

**Imagens de referência:** a pasta `referencias/` guarda quadros do vídeo, para uso pessoal como referência. Abra **só as imagens relevantes à etapa atual**, porque cada imagem custa bastante do limite de uso.
- `01-prototipo1-skyline`: o protótipo 1, com prédios coloridos e o chão de linhas (etapas 1 e 2)
- `02-andar-alto-vista`: vista de um andar alto pela janela (etapa 6)
- `03-visual-solido-carros`: fundo colorido nos glifos e carros volumétricos (etapas 4 e 7)
- `04-rua-poste-predios`: rua com poste, prédios e densidade de caracteres (etapas 1 e 4)
- `05-hud-mapa-local`: painel completo e mapa local (etapa 8)
- `06-mapa-setor` e `07-mapa-cidade`: mapas de setor e de cidade (etapa 8)
- `08-distrito-chuva-pedestre`: distrito com chuva, pedestre e mapa (etapas 3, 5 e 7)
- `09-abertura-dissolvendo`: a abertura em que a imagem sólida se desfaz em células (etapa 9)
- `10-taxi-rua-perto`: táxi de perto na rua, com o chão e as calçadas (etapas 4 e 7)
- `11-taxi-menu-destino`: dentro do táxi, com o menu de destino (etapa 10)
- `12-monotrilho-plataforma`: plataforma do monotrilho (etapa 10)
- `13-taxi-aereo-horizonte`: horizonte distante visto do alto (etapas 2 e 10)
- `14-interior-janela-cidade`: interior de prédio com a janela mostrando a cidade real (etapa 6)
- `15-interior-moveis`: interior com móveis pseudo-volumétricos diante das janelas (etapa 6)
- `16-fachada-janelas-internas`: fachada de perto, com cômodos coloridos vistos pelas janelas (etapa 6)
- `17-escultura-praca`: escultura/monumento numa praça, feito de caracteres (etapas 3 e 4)
- `18-fachadas-vitrines` e `19-fachada-vidro`: fachadas de perto, vitrines e prédio de vidro (etapas 4 e 6)
- `20-praca-objeto-dourado`: praça com um objeto dourado volumétrico (escultura ou fonte) (etapas 3 e 4)
- `21-marco-estatua-cupula`: marco da cidade, com estátua e cúpula num parque (etapa 3)
- `22-fachadas-historicas`: distrito de prédios antigos com fachadas ornamentadas (etapa 3)
- `23-cabine-telefonica`: cabine telefônica vermelha na calçada (etapa 9)
- `24-trem-interior-lua`: interior do trem com uma lua grande no céu (etapas 5 e 10)
- `25-taxi-aereo-interior`: interior do táxi aéreo (etapa 10)
- `26-horizonte-torres-marco`: horizonte com torres-marco art déco vistas do alto (etapas 2 e 3)

Enviadas pelo usuário em 2026-09-30. As de `v2` são capturas dele jogando o protótipo 2 do ASCII City (o único a que teve acesso); as de `ny` são fotos reais de Nova York:
- `27-v2-rua-cabines-vermelhas`: rua com cabines/portais vermelhos volumétricos, árvores e fachadas com padrões de caracteres coloridos (modelos e fachadas)
- `28-v2-fachadas-arvore`: fachadas variadas de perto, com padrões ricos (`@ 8 # o`), letreiros e uma árvore grande (fachadas, etapa 20)
- `29-v2-fachadas-altas-neon`: fachadas altas com padrões grandes de janelas e neons roxos na parede (fachadas e letreiros)
- `30-v2-torres-coloridas`: torres com coroas escalonadas e padrões de caracteres em várias cores (`X Z 0 8 +`), céu com chuva (fachadas e topos)
- `31-v2-modelo-torre-de-cima`: uma torre e um objeto amarelo vistos de cima, sobre um chão de linhas (vista do alto, câmera 3D)
- `32-ny-fachada-tijolo-historica`: Carnegie Hall: tijolo, arcos, cornijas em vários níveis, escada de incêndio lateral, bandeiras e marquise (fachadas históricas)
- `33-ny-entrada-marquise`: entrada de hotel com marquise e letreiro, mastros com bandeiras, vitrines de farmácia ao lado (entradas e térreo)
- `34-ny-rua-letreiros`: rua de Manhattan de dia com muitos letreiros, outdoors e placas perpendiculares (densidade de publicidade)
- `35-ny-times-square`: Times Square, telões e anúncios cobrindo as fachadas (distrito de neon)
- `36-ny-noite-vista-alta`: Manhattan à noite vista do alto: topos de torres iluminados (coroas acesas, como o Empire State), ruas como rios de luz (iluminação noturna, vista do alto)
- `37-bug-chuva-dentro`: captura do bug da chuva caindo dentro de um prédio no 17º andar (corrigido)
- `38-ny-letreiro-noticias`: o letreiro de notícias da Times Square (Motograph News Bulletin) em 2008, com lâmpadas âmbar correndo sobre um outdoor; enviada em 2026-10-01 (feito na 6.18)

Enviadas em 2026-10-03: Kamurocho, da série Yakuza (a vibe de um distrito de entretenimento denso, "além de Manhattan"; veja "Distrito de entretenimento" na etapa 20 do Plano), e duas capturas de bugs de luz:
- `39-yakuza-portal-neon-rua`: o portal aceso sobre a entrada da rua, letreiros-caixa nas paredes, cones, placas em pé na calçada, asfalto molhado refletindo
- `40-yakuza-beco-letreiros-verticais`: beco com letreiros verticais perpendiculares empilhados dos dois lados, molduras de lâmpadas, losangos acesos num poste, névoa
- `41-yakuza-esquina-neon-lixo`: esquina com neon, letreiros de lâmpadas, sacos de lixo empilhados, ar-condicionado nas paredes, fios cruzando a rua, flores de plástico
- `42-bug-luz-estourada-cinza` e `43-bug-cortes-de-luz`: a parede vermelha estourando para o cinza, as auréolas nas janelas e os cortes retos de luz (corrigidos na R.21c)

O vídeo original está em `E:\Downloads\Everything in ASCII CITY So Far ｜ The Story So Far - Grow Now! Games (1080p, h264).mp4`. Dá para extrair mais quadros com Python + OpenCV (`cv2`), que já está instalado: `cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)` e depois `cap.read()`. Para achar um trecho, monte primeiro folhas de miniaturas com o tempo escrito (uma a cada 8 s cabe em 8 folhas de 6×6) e só depois extraia em resolução cheia.

**Mapa do vídeo** (minuto:segundo → assunto), para achar trechos sem varrer o vídeo inteiro de novo:
- **0:00–2:50:** abertura e passeio.
- **2:58–8:58, protótipo 1** (imagem pequena no centro da tela): 3:30 resolução; 4:50 prédios atrás de prédios; 5:14 objetos pseudo-volumétricos; 5:38 WebGL; 6:18 mundo maior; 6:42–7:14 interiores e janelas internas; 7:22 vários andares; 7:30 vista de cima; 8:02 abertura.
- **8:58–12:42, Update 2 (trânsito e detalhe):** 9:06 visual novo; 9:38 carros; 10:10 trânsito; 10:42–11:06 detalhes do mundo; 11:14–11:30 vitrines; 11:38 modos novos; 12:10 otimização.
- **12:50–21:14, Update 3 (mapas e navegação):** 13:14 passeio automático; 14:58 mapa local; 15:30 distrito; 16:18 setor; 16:50 cidade; 17:38 timelapse; 18:34 marcos; 18:42 detalhes; 18:58 distritos; 19:30 rede de telefones; 20:10 abertura nova.
- **21:22–24:34:** transmissão ao vivo (ASCIICITY.LIVE).
- **24:42–34:26, Update 4:** 25:22 táxi terrestre; 26:34 hierarquia de ruas; 27:06 tocador de música; 27:38 monotrilho; 28:42 viagem de trem; 30:34 táxi aéreo; 32:10 táxi aéreo em velocidade 2x; 32:58 protótipo 3; 34:10 prévia do que vem.

**Regra de originalidade:** copiar a técnica e o gênero é permitido. Os nomes, a história, os marcos e a identidade visual específica do ASCII City **não** devem ser copiados. Criamos os nossos.

## Inspirações (jogos de que o usuário gosta)

Lista dada pelo usuário em 2026-09-30, pelo estilo visual e pelo nível de simulação. O que tirar de cada um é uma leitura inicial, a confirmar com ele quando a etapa chegar. A mesma regra de originalidade vale para todos.

- **Dwarf Fortress:** simulação profunda e sistêmica, em que as histórias surgem dos sistemas e não de roteiro; mundo e personagens gerados com muito detalhe; tudo desenhado em caracteres.
- **Caves of Qud:** ASCII com cor e personalidade forte; mundo procedural rico em detalhes e texto; sistemas que se combinam de jeitos inesperados.
- **Cataclysm: Dark Days Ahead:** cidade procedural em caracteres com prédios e interiores reais; cada objeto e item existe e tem função; simulação detalhada do dia a dia.
- **Project Zomboid** (principalmente pelo nível de simulação): cidade inteira em que se entra em qualquer casa, com luz, água e objetos reais; a passagem do tempo e as rotinas importam; cada ação física tem custo.
- **Hacknet:** terminal realista, comandos, redes, portas e logs (já citado no estilo de hacking).
- **Uplink:** hacking impactante e divertido, com consequências no mundo (já citado no estilo de hacking).
- **Cyberpunk 2077 e o Cyberpunk de mesa:** clima de cidade noturna densa e vertical, neon e hacking de sistemas do ambiente. O usuário gosta muito do **visual** do netrunning e da Blackwall, que lembra o visual em caracteres deste jogo. Também vale a lição do jogo de mesa, escrito nos anos 80 e 90 sobre um futuro próximo, e por isso **retrofuturista** (veja "Época e tom" nas decisões).
- **Matrix:** referência forte. A chuva de código, o texto que derrete e se desfaz (a abertura do ASCII City já aponta para isso) e o clima verde de terminal.
- **Cyberpunk e Matrix entram só como estética e clima, nunca como tecnologia (esclarecido pelo usuário em 2026-09-30).** Não há netrunning no sentido de entrar fisicamente ou mentalmente na rede, nem ciberespaço navegável, implantes, *quickhacks* ou hackear algo só olhando para ele. O hacking continua sendo o de 2008: terminal, cabos, Wi-Fi e portas físicas (veja "Estilo de hacking"). O visual inspirado neles pode aparecer em telas, terminais, transições e na abertura, mas não vira fantasia tecnológica.
- **Shadows of Doubt:** dark noir, cidade em que se entra em qualquer prédio, cidadãos com rotinas. O usuário gosta muito do **aconchego de entrar num interior numa noite de chuva** e ficar protegido dela. Isso é um objetivo de sensação para as etapas 5 e 6: som da chuva abafado do lado de dentro, janelas molhadas, luz quente no interior contra a rua fria.
- **GTA IV:** Liberty City como modelo de cidade americana em grade, época ~2008, celular como objeto e acesso à internet em lugares físicos (já citado nas decisões).

- **Megaestruturas (dito pelo usuário em 2026-09-30):** o usuário adora megaestruturas, como o elevador espacial do Ace Combat 7 (ele disse "Combat 8"), ou estruturas tão grandes que dá para ver do espaço. **Pode não ser relevante**, porque foge bastante do escopo de uma tecnologia de ~2008. Fica como inspiração para guiar decisões futuras. 
  - **Forma decidida em 2026-09-30: o Sarcófago com uma chaminé de tiragem.** É uma cúpula de contenção colossal e **inacabada** sobre a cratera principal do fogo, com ~3 km de largura, ~400 m de altura (feita com **600 m**, para a escala aparecer na grade; veja a 5.11) e **2,5 km depois da cerca** (eram 5 km; o usuário pediu metade em 2026-10-01, para parecer uma megaestrutura). Tem esqueleto de treliça, painéis faltando e guindastes parados no topo; o laranja do fogo vaza por baixo e pelas frestas. Ela se junta a uma **torre de tiragem** (a ideia de usar o calor do fogo para gerar energia), mas **larga e baixa**, com diâmetro grande em vez de altura, para não aparecer do centro. A inspiração real é o arco de Chernobyl. Para a história e o hacking, é uma obra parada por falência ou corrupção, com telemetria, sensores e guindastes ainda ligados.
  - **Decidido em 2026-09-30:** a megaestrutura fica **ligada à zona de fogo** e pode servir à história no futuro. Fica **longe, além do cordão**, e **não aparece do centro**, para não mexer na skyline. Só aparece no horizonte quando o jogador se aproxima da borda da cidade, perto da cerca, e aí deve transmitir a escala, para que se perceba o tamanho enorme dela. O que ela é ainda está a definir, sempre plausível para ~2008 no tom retrofuturista (etapa 5, junto com o horizonte).
- **Curvatura do horizonte (pedido em 2026-09-30, feita na 5.10 com R = 400 km):** simular uma curvatura **bem leve**, com o chão e os objetos distantes descendo um pouco (queda ≈ d²/2R, com um R falso bem menor que o da Terra, porque o real dá só ~0,3 m a 2 km). Não pode dar a impressão de cidade cilíndrica (etapa 5, junto com o céu).

Também servem de referência, pelo que já está nas decisões: RDR2 (cidadãos e rotinas), Grey Hack (hacking), HighFleet (interfaces físicas com som) e Else Heart.Break() (impacto sistêmico).

## Decisões tomadas

- **Plataforma:** navegador. O protótipo 1 foi um único HTML com JavaScript puro; daqui em diante vale a decisão de stack abaixo (Vite + TypeScript, vários arquivos).
- **Renderização:** raycaster por coluna com prédios de alturas diferentes, desenhado em uma grade de caracteres.
- **Estética:** noite com a luz amarela de postes de sódio e HUD âmbar/ciano, para se distinguir do verde do ASCII City. A paleta final é a de sódio (decidida na etapa 4).
- **Ritmo de trabalho:** avançar aos poucos, respeitando o limite de uso do usuário. De preferência, uma sessão nova para cada funcionalidade.
- **Idioma:** o usuário escreve em português, então as respostas são em português.
- **Stack (decidido em 2026-09-30):** Vite + TypeScript, rodando no navegador. O servidor de desenvolvimento é necessário porque Workers e módulos não funcionam em arquivos abertos com duplo clique. Git para versionar. O `terminal-city.html` fica como referência do protótipo 1.
- **Simulação separada da renderização:** os módulos da cidade e da simulação não conhecem a tela; recebem o tempo e atualizam dados. Assim o núcleo pode ir para um Web Worker, ou para Rust/WASM ou um servidor, se um dia pesar.
- **Aleatória, mas com semente:** cada jogo novo sorteia uma semente, e a cidade, as pessoas e as rotinas saem dela. Com a mesma semente e as mesmas ações do jogador, o resultado é o mesmo. Isso **não** limita a variedade (Shadows of Doubt também usa sementes de cidade). Serve para reproduzir bugs, para salvar só "semente + mudanças" e para o hacking ser previsível e manipulável.
- **Modelo de NPCs no estilo Shadows of Doubt / RDR2:** cada cidadão tem casa, trabalho, relações (cônjuge, colegas de apartamento, colegas de trabalho) e uma rotina com horários. A geração segue esta ordem: malha da cidade → prédios → apartamentos e locais de trabalho → cidadãos → relações → rotinas.
- **Nível de detalhe da simulação:** perto do jogador, os cidadãos andam de verdade. Longe, a posição é calculada pela rotina ("às 14h a pessoa X está no trabalho"), sem simular o caminho. Todos têm identidade persistente; os detalhes podem ser gerados sob demanda a partir da semente.
- **Estilo de hacking:** realista como Hacknet e Grey Hack (terminal, comandos, redes, portas, senhas, logs), mas impactante e divertido como Uplink.
- **Interfaces físicas e diegéticas (esqueuomorfismo), no estilo HighFleet:** tudo o que o jogador usa existe no mundo do jogo e é operado "com as mãos". Botões, interruptores, alavancas, teclados e mostradores, cada um com uma função clara e **com som** ao ser acionado. O usuário gosta muito de coisas que se apertam e fazem barulho, então o retorno tátil e sonoro é prioridade, não enfeite.
- **O acesso depende do lugar físico (estilo GTA IV):**
  - Para usar a internet, é preciso ir a um lugar com rede (um cybercafé, por exemplo), digitar a senha dele, e o sinal do Wi-Fi depende da distância física até o ponto.
  - Um sistema fora da rede (um semáforo, por exemplo) só se hackeia indo até ele, achando a porta de acesso física e conectando o notebook nela.
  - O celular é um objeto: você o tira do bolso e disca números. Também há orelhões. Veja "Design: celular e apps".
  - O táxi se pede ligando para a central ou fazendo sinal na rua. Dentro dele, o destino é escolhido falando com o motorista ou no painel do táxi, e não num menu abstrato.
- **Terminais progressivos e verbosos:** o usuário adora terminais em que o texto vai sendo composto aos poucos (como uma saída de boot ou de comando), em vez de aparecer de uma vez. Termos técnicos e verbosidade são bem-vindos, **desde que correspondam a algo real no jogo**.
- **Máquinas virtuais com hardware real:** cada computador do jogo tem especificações próprias (CPU, memória, disco, placa de rede, sistema operacional) que o terminal mostra e que **limitam de verdade** o que roda nele (programas que não cabem na memória, processamento lento numa CPU fraca etc.). O limite é do computador virtual, não do PC de quem joga.
- **Impacto sistêmico, no estilo Else Heart.Break():** as ações de hacking mexem com a simulação a ponto de poder causar consequências enormes, até apocalípticas, se o jogador quiser ou não tomar cuidado: quebrar a economia, alterar preços de mercadorias, bagunçar o trânsito, causar acidentes, afetar a vida das pessoas. Mais profundo que Watch Dogs, que é mais roteirizado. Devem existir muitos lugares e sistemas hackeáveis.
- **Época: por volta de 2008 (decidido em 2026-09-30),** no estilo GTA IV. É a época dos primeiros smartphones e da primeira loja de apps, do boom das redes sociais, dos celulares com câmera de baixa resolução, do 3G/EDGE lento, do Wi-Fi com senha, dos cybercafés e dos orelhões ainda em uso. Smartphones convivem com celulares comuns: cada cidadão tem um aparelho diferente. Tudo o que for tecnologia no jogo deve ser plausível para essa época.
- **Época e tom: retrofuturismo noir (ajustado em 2026-09-30).** 2008 é a base das **capacidades** tecnológicas (velocidade de rede, câmeras de baixa resolução, celulares, poder dos computadores), mas o mundo **não precisa se limitar ao que existia de fato em 2008**. A leitura é a de um 2008 imaginado por alguém dos anos 80 e 90, como o Cyberpunk de mesa: mais sombrio, mais noir, com ecos de ficção científica daquela época **na estética** (terminais verdes, neon, corporações, cidade vertical). O tom é **dark noir**, no estilo Shadows of Doubt. A tecnologia não passa muito de 2008: continua proibido o que quebra as capacidades (carros voadores, IA conversacional, realidade aumentada, implantes, netrunning, ciberespaço navegável).
- **Borda da cidade: zona de fogo subterrâneo + cordão (decidido em 2026-09-30).** A borda não é água nem rodovia, e sim um limite com consequência real, no estilo do deserto de Mad Max:
  - A cidade fica ao lado de uma bacia de carvão que pegou fogo há décadas e nunca apagou (inspirada em Centralia, na Pensilvânia). Em volta há uma faixa abandonada, com asfalto rachado, fumaça saindo do chão, crateras que afundam e monóxido de carbono.
  - Entrar na faixa faz subir um medidor de CO: tontura, visão escurecendo e desmaio. O chão pode ceder.
  - O governo cercou a borda da zona com um cordão: cerca, torres com holofotes, postos de controle e patrulhas. Chegar perto aciona alerta; cruzar dá prisão.
  - No horizonte noturno aparecem fendas brilhando em laranja e colunas de fumaça. A fumaça segue o vento do clima (etapa 5) e pode chegar aos bairros da borda.
  - Para o hacking: a agência que monitora a zona tem sensores de gás; o cordão tem câmeras, rádio e listas de autorização.
- **Idioma dos textos do jogo (decidido em 2026-09-30):** inglês por padrão, inclusive os nomes gerados (distritos, ruas, marcos, lojas). Os textos ficam em arquivos de locale, para dar para trocar o idioma depois. As respostas ao usuário continuam em português.
- **Tamanho da cidade (decidido em 2026-09-30):** o padrão é uma cidade **média, de ~2×2 km**. O tamanho deve ser **um parâmetro da geração**, e não algo fixo no código. No futuro, uma opção de menu antes de criar o mundo vai permitir aumentar ou diminuir o tamanho se o desempenho aguentar; o menu não é para agora. O desempenho deve se adaptar ao tamanho (nível de detalhe e janela carregada em volta do jogador), e não depender de a cidade ser pequena.
- **Estilo urbano: americano, em grade (decidido em 2026-09-30),** como a Liberty City do GTA IV: grade regular, avenidas largas, arranha-céus no centro e bairros mais baixos em volta.
- **Unidades: 1 unidade = 1 metro (decidido em 2026-09-30).** A conversão da escala atual (andar de 0,55 e olho a 0,48, cerca de 1 unidade para 3,5 m) é feita na etapa 2. Valores de referência: olho a ~1,7 m, andar de ~3,5 m, faixa de rua de ~3,5 m.
- **Painel lateral no estilo do ASCII City:** fica, desde que seja diegético. Deve ter o visual de terminal com texto composto aos poucos. **Decidido na etapa 8: é o celular** na mão do jogador (veja a etapa 8 no Histórico).
- **Projetar pensando nas próximas etapas (pedido do usuário em 2026-09-30):** toda decisão de projeto deve considerar as etapas que vêm depois. O que é feito agora como visual deve nascer ligado a dados da simulação, de forma modular, para ser ampliado depois sem reescrever. Exemplo: os letreiros da etapa 4 mostram o nome de uma empresa que existe na simulação (`city.businesses`). Os interiores (etapa 6) e a economia (etapa 13) usam e ampliam esse mesmo registro, em vez de inventar nomes à parte.
- **Texto no mundo: pontos de perto, ASCII de longe (princípio do usuário, 2026-10-01; aplicar sempre):** todo texto que existe no mundo (letreiros, placas, outdoors, telões, placas EXIT, sinais, botoeiras) é desenhado em dois níveis. **De perto**, cada letra é formada por vários pontos (as lâmpadas da fonte 5×7, `bulbOn`/`fontRows` em `signs.ts`, com `o`/`@` pela densidade). **De longe**, cada letra vira um único caractere ASCII, na célula que contém o centro dela (ou a mesma letra repetida numa coluna, quando é estreita e alta). Mais longe ainda, uma faixa acesa. Nunca esticar uma letra ASCII por várias células.
- **Conteúdo seguro (regra do usuário, 2026-10-01):**
  - **Hacking com princípios reais e nomes fictícios (esclarecido pelo usuário):** os princípios seguem os reais, como no Hacknet e no Grey Hack (portas, varreduras, serviços, senhas, logs, redes). **A única coisa que muda são os nomes dos programas**, que viram versões parecidas mas fictícias (por exemplo, "Nmap" vira "Mmap"). Não mudar nada além disso por enquanto. Tudo roda só dentro da simulação do jogo.
  - **As falas dos NPCs** (ligações, SMS, posts, manchetes) ficam limpas: sem palavrão, insulto, conteúdo sexual, violência explícita, nem nada que possa ser sinalizado. O tom noir vem do clima e da situação, não do vocabulário.
- **Render do mundo na GPU com WebGPU (decidido pelo usuário em 2026-10-02):** migrar **o render do mundo inteiro** (não um híbrido permanente) para WebGPU (compute shaders e storage buffers: a cidade vai como listas, não espremida em texturas). Só Chromium/Electron, o que é aceito. A migração é por partes atrás de uma tecla, comparando com a versão em CPU, que é apagada quando a nova estiver igual. Ficam na CPU: a simulação e as camadas de interface (celular, notebook, painéis). Ordem: medir → protótipo (chão e fachadas) → fachadas e janelas, céu e nuvens, letreiros, objetos e carros, luzes, interiores, chuva e vidro. A câmera 3D de verdade vem junto.
- **Delegar a outras IAs (combinado em 2026-10-02, para economizar o limite do usuário):** o usuário tem o Gemini (pago) e o ChatGPT (grátis). Delegar só o que não depende do código: textos da gramática (com um briefing do formato e das regras), pesquisa (referências de 2008, receitas de som) e segundas opiniões de arquitetura. Os briefings ficam em `docs/tarefas/`, um por tarefa, curtos (nunca o CLAUDE.md inteiro). O resultado volta para o Claude conferir (de preferência por script). **ChatGPT pago: o usuário decidiu não assinar (2026-10-03).** As correções simples continuam com o Sonnet (lista fixa de correções); as tarefas mais custosas que não envolvem muito código continuam indo para o ChatGPT grátis e o Gemini, como acima.
- **Toda frase do jogo pela gramática (pedido do usuário na 11.5):** com pesos de idade, gênero e contexto, para cada pessoa soar única. Vale para tudo o que vier (taxistas, posts, sites, notícias): **todo texto novo entra como peças em `locale/text/` e passa por `expand` com a `Sel` de quem fala.**
- **O resultado de um trabalho depende só do que o jogador controla (decidido pelo usuário em 2026-10-03):** nada de sorteio da simulação no sucesso ou no pagamento (quantos carros havia na hora, se houve batida), senão vira um jogo de sorte e frustra. O sucesso confere o que o jogador fez (o disjuntor aberto, o semáforo alterado na janela). Condições que dependem da simulação podem voltar quando o jogador tiver ferramentas para influenciá-las.
- **Objetos de cubinhos (regra de design do usuário em 2026-10-04):** daqui em diante os objetos (carros, mobília, postes, marcos) são compostos de **muitos cubos pequenos** que formam a silhueta, as curvas e os detalhes ("voxel" na fala do usuário quer dizer isso, não voxel no sentido técnico de grade). O modelo atual de poucas caixas fica como **nível de detalhe de longe** (e reserva se o desempenho apertar). Cuidados: o custo é por célula e por cubo, então os cubinhos só de perto (LOD por distância, como os letreiros), cubos menores que ~10 cm não aparecem a 20 m, e a GPU precisa de uma estrutura por objeto (uma grade pequena de ocupação por modelo, percorrida pelo raio) quando os cubos passarem de algumas dezenas. Primeiro alvo sugerido: os carros (etapa 20), depois a mobília.
- **Efeitos de interface por cima (regra do usuário em 2026-10-04):** bloom, halo, reflexo e brilho de tela são desenhados **depois** do desenho da interface, nunca embaixo (já foi problema no celular, no notebook e no relógio). Atenção ao caso que engana: somar luz sobre uma superfície já clara (o aço do relógio) estoura no branco e o efeito some, parecendo estar atrás; por isso o halo **tinge** o que está embaixo antes de somar (`HALO_TINT` em `gpu/compositor.ts`).
- **Tudo é código (regra do usuário em 2026-10-04):** o jogo não tem arquivos de mídia: nenhum MP3/WAV, FBX ou PNG. Os sons são sintetizados, os modelos são primitivas, as texturas saem do shader; dados em texto (JSON da gramática, tabelas) são o normal. Transcrever um som gravado amostra por amostra para o código **não** conta como síntese (é um arquivo de áudio disfarçado): para acertar sons, o caminho é a análise por síntese da etapa 21. (Os sons do usuário em `easter eggs/` ficam só no desenvolvimento.)
- **O jogador é o número dele (decidido em 2026-10-04):** na rua, o jogador é conhecido só pelo número da linha (os últimos quatro dígitos, "0179"). O nome existe só para banco e documentos e **nunca** entra na reputação. A reputação (o calor, a fama, os contatos do meio) fica presa ao número: **jogar fora o chip é recomeçar do zero** (um toque leve de roguelike: some a investigação, some também o nome que você fez). Os hackers não confiam em e-mail: usam um **app de mensagens cifradas** no celular (como o Signal de hoje, com nome fictício), ligado ao número; um fórum de trabalhos, se vier, também entra pelo número com SMS de confirmação. O apelido que a cidade der ao jogador **nunca** é "Brownout".
- **História de fundo (base aberta, 2026-10-04):** a proposta do fogo que não apaga porque alguém o alimenta (resumo em `docs/feedback-claude.md`, 2026-10-04) é a base; pode mudar.
- **Pessoas no estilo bloco e skins (decidido com o usuário em 2026-10-04, depois de uma pesquisa dele sobre direitos):** o modelo e a skin são nossos (geometria e skin geradas no código, `pedLook`/`mcSkin`); **nunca** incluir arquivo, textura, modelo, som ou skin padrão da Mojang (Steve/Alex), nem usar "Minecraft" no nome, no título ou na divulgação do jogo. Se um dia o jogo importar skins de arquivo, descrever como "skins 64×64 no formato clássico", e a skin importada é do jogador. Se o jogo for vendido, consultar um advogado de propriedade intelectual antes.
- **Escopo da 1.0 e nada de suporte a coisas quebradas (princípio do usuário em 2026-10-04; guiar decisões futuras):** as etapas 13 a 22 são o necessário para uma versão 1.0 completa e jogável (só convenção de nome, não é para publicar). Primeiro o jogo inteiro, depois a expansão. O que causa muitos problemas e exige *workarounds* em vez de desenvolvimento (como foi a avenida diagonal; e foi o motivo dos reworks da luz e dos interiores) fica para depois da 1.0 (ex.: o cinema). Ao planejar, preferir a solução que diminui o suporte a casos quebrados.
- **Os dados da simulação são a matéria do hacking:** registros de moradores e funcionários, logs de telefone, câmeras, controle de portas e semáforos vêm da simulação e não são inventados à parte.
- **Canais do contratante (decidido em 2026-10-03):** a máquina de trabalho (`sim/jobs.ts`) é **agnóstica de canal**; a entrega é só um adaptador. **SMS agora** (F.1, já feito). **E-mail na etapa 12:** uma conta de e-mail como a do banco, lida no notebook, de um provedor que é empresa da cidade e portanto **hackeável** — o canal de contratos mais longos e do mistério de fundo (Sarcófago, jornalista). **Ligação do contratante no 13c,** junto do sistema de diálogo: uma ligação com escolhas de fala é a mesma tecnologia de falar com NPCs e de engenharia social. Antes do 13c, nada de ligação de contratante (só daria um menu "aperte 1"). Acrescentar um canal é acoplar um adaptador, não reescrever.
- **Clima e céu (pedido em 2026-09-30):** o usuário quer chuva, garoa, neve e afins, com partículas que caem de verdade e respingam no chão, além das fases da lua. A divisão pretendida:
  - O *estado* do clima (se chove, a intensidade, o vento), a data e a hora ficam na simulação, com semente, porque um dia vão afetar as pessoas e o trânsito.
  - As partículas são só render.
- **Ciclo de dia e noite, com calendário (decidido em 2026-09-30, com ressalva de estética):** o usuário tende a querer, porque as rotinas dos cidadãos, as estações, a passagem do ano e as fases da lua dependem disso. A preocupação dele é o dia estragar o clima de hacker. Proposta para preservar a estética (a validar quando for implementada):
  - **A noite continua sendo o visual principal.** O dia é enevoado e nublado, com céu claro e dessaturado, glifos mais apagados e janelas e postes apagados. É o "visual de serviço". O entardecer e o amanhecer têm céu colorido e são os momentos bonitos da transição.
  - **O dia e a noite mudam o jogo, não só a cor.** De dia, as ruas ficam cheias, há mais testemunhas, os escritórios estão ocupados e o trânsito é pesado. De noite, os sistemas estão menos vigiados, há menos gente e os plantões são curtos. O hacker tem motivo para preferir a noite, mas o dia tem alvos próprios, como as rotinas e as pessoas no trabalho.
  - **Relógio e calendário na simulação:** hora, dia, estação e ano. A duração do dia varia com a estação, a lua segue o ciclo real de ~29,5 dias, e a probabilidade de chuva e neve depende da estação. **Decidido:** um dia dura 48 minutos reais e o jogador pode dormir e pular o tempo (feito na 5.5; o dia ainda é um visual provisório).

- **Decisões da etapa 4 (2026-09-30):**
  - **Paleta: sódio âmbar (escolhida pelo usuário em 2026-09-30,** depois de comparar com neon noir e verde terminal). As outras foram removidas. *(Em 2026-10-03 o usuário escolheu temperatura real para as luzes da noite: o sódio continua nos postes, mas cada fonte fica com a sua cor; veja a revisão da luz na Sessão B.)*
  - **Fundo colorido:** o usuário gosta das duas versões, com e sem fundo. A tecla **B** passa por estágios: **0,24 da cor do glifo (o padrão, o "1/3" escolhido pelo usuário em 2026-10-01)**, 0,16, 0,08 e desligado (`SOLID` em `main.ts`). Antes era 0,36, que ele achou claro e sólido demais.
  - **Caracteres:** o usuário prefere **ASCII**, que é o padrão. Os blocos Unicode (`░▒▓█─│┌`) ficam como opção na tecla **U**, enquanto não atrapalharem o desenvolvimento.
  - **Som:** o módulo de áudio (Web Audio, sintetizado, sem arquivos) nasce na etapa 4, com os sons de ambiente: zumbido de neon que falha junto com o letreiro, zumbido de poste de sódio, cidade distante e tom grave perto da zona de fogo.

## Plano: etapas 13 a 22 (renumerado em 2026-10-04)

> **Numeração (decidida pelo usuário em 2026-10-04):** só **etapas e subetapas numeradas** (13, 13.1, 13.1a…), sem letras de sessão. O que já foi feito fica com o nome antigo no histórico (etapas 1–12, R, as sessões A/B/L de luz e a fatia vertical F.1–F.9). O que falta são as etapas 13 a 22, na ordem em que vamos fazer, e três **listas fixas** fora das etapas (correções, retoques de luz, pendências da Trilha de hacking). Ao fechar uma subetapa, o que ela atendeu vai para `docs/historico.md` e sai daqui. A versão no `CHANGELOG.md` segue o número (`0.13.1`).
>
> **Ritmo:** retorno do usuário no fim de cada grupo de subetapas (veja "Como trabalhar"). Tarefas sem código vão para as outras IAs (briefing em `docs/tarefas/`).
>
> **Testes:** tudo o que foi feito antes da renumeração foi testado pelo usuário (2026-10-04).

### Etapa 13: Lugares e lojas (planejada com o usuário em 2026-10-04)
> **Decidido:** comprar **pegando na prateleira** (o item físico, levado ao caixa e pago ao funcionário); **~15 tipos que se usam** na primeira passada (o resto do catálogo depois); a **mochila nasce junto da compra** e a fome logo depois. Base: o catálogo `docs/tarefas/retorno/01-tipos-de-lugar.json`.
- **13.1 ✅ (2026-10-04)** a tabela única de tipos de lugar (`src/sim/placeTypes.ts`: horário, equipe, Wi-Fi, câmeras, letreiro, raridade, o que vende e preço) e seis tipos novos (pizzaria, deli, fast food, loja de celular, cybercafé, motel). Os nomes das mercadorias em `en.json` ("goods").
- **13.2 ✅ (2026-10-04)** o interior da loja pelo tipo (`shopFloor` em `furnish`, `sim/interior.ts`): diner e fast food com balcão, banquetas, forno e mesas; café, deli e pizzaria com vitrine, geladeira ou forno; bar com balcão, banquetas e a prateleira de garrafas; cybercafé com fileiras de computadores; lavanderia com lavadoras e secadoras; mercearia com geladeiras e corredores de prateleiras; eletrônicos, celular e penhor com vitrines. Cada prateleira, geladeira e vitrine guarda `stock` (mercadorias da tabela), desenhadas cada uma com sua cor (`goodColor` em `render/models.ts`).
- **13.2b–d ✅ (2026-10-04)** o elevador chega ao topo das torres com recuo; as geladeiras só com frios e bebidas (`COLD` em `placeTypes.ts`); a sala de estoque (`store`) nas lojas fundas e as lojas completadas quando sobra chão (`fillShop`); as portas com F (`sim/doors.ts`: abrir, fechar, trancada; folhas de vidro animadas nas portas da rua); a cabine do elevador por prédio (`sim/lifts.ts`: andar sorteado, chamada no corredor, mostrador e botão). As paredes cortadas perto do X não aparecem em nenhuma planta com a diagonal desligada.
- **13.3 ✅ (2026-10-04)** os balconistas são cidadãos com turno e folga escalonada (`staffOn` em `sim/citizens.ts`); o caixa só atende com alguém no turno; a porta da loja tranca por fora fora do horário. Os balconistas ainda não aparecem dentro (vêm com a 13.8 e a etapa 16).
- **13.4 ✅ (2026-10-04)** pegar na prateleira com F (`src/shop.ts`, mirando o produto), pagar no caixa em dinheiro ou cartão (`src/counter.ts`, também o cardápio para viagem dos lugares de `order` e o saque no banco), sair sem pagar é furto (evento `shoplift`, para o calor depois); a mochila com física (`src/sim/bag.ts`, tela em `src/bagUi.ts`, tecla B) e as vagas do celular, notebook e chip.
- **13.5 ✅ (2026-10-04)** a fome (`src/sim/needs.ts`): o estômago esvazia em 18 h de jogo, a fome encurta a corrida (fôlego), come-se no balcão (Tab: aqui ou para viagem) ou da mochila (E); avisos com o ronco. Testemunhas num lugar cheio esperam a etapa 16.
- **13.6 ✅ (2026-10-04)** upgrades como objetos: chip, antena e bateria vão para a mochila e são usados arrastando até a vaga (a antena e a bateria aparecem no modelo do notebook; o chip abre a animação do celular e troca a linha); três operadoras (`OPERATORS`, `operatorName(city, op)`; as outras revendem as antenas da dona).
- **13.7 ✅ (2026-10-04)** placas: o nome das ruas em cada cruzamento (`streetBlade`), placas de direção para o marco mais perto nos cruzamentos de vias largas (`guideSign`), a placa GRIDLINK no portão das subestações (`cornerSigns` em `raycaster.ts`). Falta: placas de distrito.
- **13.8 ✅ (2026-10-04)** pessoas no formato do Minecraft: proporções e grade de pixels do Minecraft, a skin gerada no shader (`mcSkin`, `Mat.Skin`, `pedLook`) em vez de textura. Falta: a skin de arquivo do jogador (64×64, UV do Alex; **confirmado pelo usuário** em 2026-10-04) quando o corpo dele aparecer; os balconistas dentro das lojas (etapa 16).
- **Pessoas: o que vem depois (decidido pelo usuário em 2026-10-04):**
  - **O modelo atual dos NPCs é provisório.** No futuro: mudar as proporções e levemente o rosto (para ter cara própria e não de Minecraft), e acrescentar as sugestões do Claude: roupas de profissão (uniformes por emprego: garçom, policial, segurança, técnico da GRIDLINK, entregador), roupas de 2008 e da estação (casaco no inverno, guarda-chuva, cachecol), acessórios (boné, óculos, bolsa, fone, crachá).
  - **O jogador continua no padrão Minecraft Alex por enquanto**, com skin 64×64 importável no mesmo UV.
  - **Editor do personagem dentro do jogo:** mudar as proporções do corpo e pintar a skin no jogo; um modelo para pintar no Blockbench também (exportar/importar).
  - **O mesmo sistema de proporções alteráveis serve aos NPCs** (cada cidadão com proporções próprias pela semente: altura, largura, cabeça).
- **13.9 Achar o caminho sem o Maps** (retorno do usuário em 2026-10-04: "pense em mais assistências que deixariam o jogo quase inteiramente jogável sem o Maps, já que o celular pode ficar sem bateria; pedir direções a NPCs e se guiar pelas placas"). Depois da 13.8. Em ordem de valor:
  - ✅ **13.9b:** pedir direção a quem passa (`src/askWay.ts`, F perto de um pedestre; a pessoa para, aponta e diz a rota em quarteirões pela gramática `directions.en.json`).
  - **Número nos prédios e endereços** ("1240 5th Ave") na porta, usados também pelo Maps, pelas lojas no telefone e pelos sites: quem sabe o endereço acha pela placa da rua.
  - **Placas de distrito** nas entradas ("ENTERING OLD MARLOW") e o nome do distrito nos toldos e pontos de ônibus.
  - **Placas de distrito iluminadas sobre a pista** (pedido do usuário em 2026-10-04): como as das rodovias americanas, mas cobrindo uma faixa só: três distritos, a direção e talvez a distância.
  - **Placas de direção no lugar certo** (retorno de 2026-10-04): hoje a de destino (`guideSign`, "… 0.5 mi") está virada para o poste e em cima da faixa de pedestres. Ir para o braço do semáforo, acima das lentes, quando houver um cruzamento perto; senão, no meio do quarteirão, na calçada, entre os postes.
  - **Legibilidade:** placas e anúncios grandes desenhados em blocos/pontos, nunca com um glifo por letra esticado; vale sobretudo para as informativas e as de publicidade que hoje são difíceis de ler.
  - **Totens "YOU ARE HERE"** nas esquinas grandes e nos pontos de ônibus: um mapa de papel do bairro, lido com F.
  - **Mapa de papel / guia da cidade** à venda (farmácia, mercearia, loja de celular): item da mochila que abre sem bateria; mostra ruas e marcos, mas não onde você está. **Com ele na mochila, a tecla M o abre** (pedido do usuário em 2026-10-04).
  - **Lista telefônica** nos orelhões (páginas amarelas com endereço).
  - Já ajudam: as placas de rua e de direção (13.7), a bússola do relógio, os marcos altos no horizonte, os letreiros das lojas. Depois: placas de hospital, estacionamento e estação (etapa 18).
  - ✅ **13.9a:** a bateria do celular (gasta com o uso, carrega com o carregador na mochila nos lugares com tomada, `OUTLETS`). Em casa, quando o apartamento existir (etapa 22).
  - **13.9c Tomadas (retorno do usuário em 2026-10-04):** o carregador do celular e o do notebook **não são upgrade nem item comprado** (quem tem o aparelho tem o carregador): tirar o carregador da loja e da mochila. As **tomadas viram objetos** nas paredes dos lugares (`OUTLETS`): F na tomada (ou sentar perto dela) pluga o aparelho, que carrega em tempo real; uma **outra tecla** (não o F) faz "esperar carregar", avançando o tempo até encher (o mesmo pulo de tempo de dormir; bloqueado durante perseguição/calor alto).
- **Modelos do Blockbench:** as regras ficam em `docs/blockbench.md` (não decidido; só se um modelo gerado ficar ruim, ou para publicar).
- **Depois, na mesma linha:** mais escritórios perto do centro; a renda dos moradores segue o lugar; `homeUnit` (ainda não existe) em `sim/citizens.ts`; o resto do catálogo (cinema, karaokê, fliperama, escritórios…); **shopping** (hoje toda empresa fica no térreo, `B.shop`; lojas em andares de cima só num prédio marcado como shopping; bares e restaurantes sempre no térreo).
- **Cinema e outros interiores complicados ficam para depois da 1.0** (decidido pelo usuário em 2026-10-04): o cinema precisa de várias salas e peças novas; não entra agora. Veja "Escopo da 1.0" nas decisões.
- **A diagonal está desligada** (P.1, `DIAGONAL` em `sim/city.ts`) e o Theater District tem uma praça de dois quarteirões. Se um dia voltar, os bugs dela voltam junto.
- **13.10 Rework dos interiores (plano feito em 2026-10-04 com o usuário).**
  - **O princípio (do usuário):** o interior é **o mesmo espaço físico** do mundo. As paredes são só uma barreira entre o dentro e o fora; se as portas e as janelas não existissem, nada mudaria. Tudo o que funciona fora funciona dentro e vice-versa, como o dia e a noite: **nenhuma transformação especial quando o jogador entra** (era isso que causava a maioria dos problemas). A única exceção aceitável é o som (e talvez algo pequeno, a decidir).
  - **Decidido:** módulo de **2 m** (as janelas passam para a grade de 2 m; as fachadas terão um rework de qualquer jeito); os terrenos dos prédios são arredondados para a grade do módulo (a cidade de cada semente muda; os saves de teste não importam).
  - **13.10a ✅ (2026-10-04) Módulo e paredes com volume** (o desenho das paredes com volume fica para a 13.10b; os testes acharam ~11% dos terrenos sem porta para a rua e ~3,6 mil lojas sem porta própria, para a 13.10c)**:** `BAY` = 2 m; terrenos arredondados à grade (as sobras viram recuo ou beco); o raster das plantas com células de parede (paredes externas e internas com espessura, portas como vãos nelas); corredor e núcleo do elevador medidos em módulos; a colisão pelas células de parede. Cria a pasta `tests/` com as invariantes das plantas no Node (toda sala alcançável, toda loja com porta para a rua, nenhuma porta bloqueada por móvel).
  - **13.10b ✅ (2026-10-04) Um só espaço:** `roomWalk` no shader para todo raio que entra num prédio (o jogador dentro, ou da rua pela janela ou pela porta); folhas, portas abertas, cabine e lâmpadas por planta e por lote; LOD em dois níveis (completo até 60 m, salas e luz além) e o desbotamento de longe; paredes com espessura. Falta: a chuva decidir o "dentro" pelo ponto do raio (hoje ainda pelo vidro do andar do jogador, `nearT`); de fora, só o andar que o raio atravessa (uma laje vista de baixo pela janela continua o teto daquele andar).
  - **13.10c ✅ (2026-10-04) Plantas por modelo** (`sim/layouts.ts`, `layoutShop` em `furnish`; veja o histórico). Falta: mais variações por tipo e os tipos sem modelo (banco, hotel, motel, cinema, estacionamento seguem o gerador antigo); ~1 mil terrenos por semente continuam fechados por todos os lados, sem porta para a rua (plano na 13.10e); mais modelos de planta delegados (`docs/tarefas/09-plantas-de-lojas.md`); depois, apartamentos e escritórios pelo mesmo sistema.
  - **13.10d Portas 3D e tipos de porta (a próxima; reordenado pelo usuário em 2026-10-04):** vidro (lojas, saguões), metal (serviço, estoque), madeira (apartamentos), de enrolar (a porta de aço desce na frente da loja fechada), cada uma com animação e som. **A porta é um objeto 3D de verdade que gira na dobradiça** (pedido do usuário em 2026-10-04), a mesma vista de dentro e de fora (hoje são duas portas pintadas diferentes); a versão chapada atual fica como LOD de longe, trocada pelo modelo de perto como os interiores.
  - **13.10e Terrenos sem porta (plano de 2026-10-04):** o `tests/plans.ts` conta ~1 mil terrenos por semente fechados por todos os lados (lotes no miolo do quarteirão, cercados por outros lotes). Resolver na geração, em ordem: (1) se o lote fechado encosta num vizinho com frente para a rua, **fundir** como fundos dele (vira a sala de estoque, os fundos do saguão ou mais apartamentos); (2) senão, **abrir um beco de serviço** de 1 módulo (2 m) da rua mais perto até ele, na grade do `BAY` (porta de metal da 13.10d); (3) o que sobrar vira pátio interno sem prédio. Conferir pelo teste: `noDoor` = 0 em várias sementes, e o beco não corta loja nem porta existente. A cidade de cada semente muda de novo (aceito).
  - **13.10f Sentar:** F numa cadeira, banqueta, sofá ou banco baixa a câmera; o notebook usa o mesmo lugar.
  - **13.10g Elevador e luz:** a luz da cabine mais forte; (depois) interruptores de luz nas salas; a botoeira vista de fora da cabine (deve vir de graça com a 13.10b); conferir a iluminação dos interiores com a luz única.
  - **13.10h Retoques do um só espaço (a última da etapa; baixa prioridade, decidido pelo usuário em 2026-10-04)** (o que sobrou da antiga 13.10b2, cuja parte feita está no histórico)**:** (1) os móveis "vazando" o relevo do mundo (silhuetas laranja de mesas e cadeiras sobre a parede marrom escura): **reproduzir na semente 42, `POS 806.4,905.9`, INSIDE FLOOR 0, 15:19** (captura do usuário em 2026-10-04, olhando para o corredor que sai para a rua); (2) **a luz e as sombras de fora não entram pela porta nem pela janela:** o chão do lado de dentro não recebe os postes (nem a sombra do poste), porque a célula da porta pula o `lightAt` (`!doorway` em `wallCell`) e o `roomLit` só tem as lâmpadas da sala, o ambiente e o `dayIn`. Fazer o `lightAt` no ponto do raio dentro da sala, só perto das aberturas (as paredes não bloqueiam o `lightAt`), igual visto de dentro e de fora; o sol entrando pela janela com a sombra da moldura junto.
  - **Testes do usuário:** grupo A = 13.10a–b (testado em 2026-10-04; o retorno foi para a b2, feita em parte, e para a d), grupo B = c–e, grupo C = f–h.
- **13.11 ✅ (2026-10-04) Pessoas de perto:** (a) a skin estável; (b) o desvio perto do jogador (`avoid` em `sim/peds.ts`, 160 m: passo para o lado, mais devagar atrás de quem é lento, contorna o jogador); (c) os membros em duas peças giradas nas articulações (`swing`/`pivX`/`pivZ` em `Part`, girados no shader em `objectsOver`; 8 quadros por passada; as sombras e os reflexos ainda usam a caixa sem giro); (e) a aparência na simulação (`sim/looks.ts`: tom de pele pela família, cabelo pela idade e pelo tom, barba e cabelo comprido pelo gênero, roupa); (f) o guarda-chuva. Falta: óculos (precisa de um bit no `mcSkin`), a descrição em palavras para as missões (quando vierem) e a exceção de quem está trabalhando ao parar.
- **13.12 ✅ (2026-10-04)** estado de interface: com a mochila, o balcão ou a lista de direções abertos, o jogador não anda nem gira (`uiBusy` em `main.ts`; o diálogo da etapa 14 entra nela).
- **13.14 Pessoas: retoques (retorno do usuário em 2026-10-04; depois da 13.10):** (a) a animação de segurar o celular foi feita para o modelo antigo e ficou irreal: refazer com os braços articulados da 13.11; (b) a barba esconde a boca: deixar a boca à mostra, tirar um pixel dos cantos de cima (para não ser um quadrado) e preencher um pouco mais as laterais da cabeça (`mcSkin`); (c) as pessoas ainda se atravessam na faixa de pedestres (`avoid` em `sim/peds.ts`); (d) virar suave: interpolar o rumo como os carros, em vez de virar na hora (ainda parecem andar em trilhos).
- **13.13 ✅ (2026-10-04)** opções unificadas: SOUND, STYLE (HIGH DEFINITION: 200 linhas, nitidez SOFT; CLASSIC: 120, SHARPER), SHARPNESS (SOFT = fusão dos glifos de longe; SHARP, o padrão), DEBUG LINES. Fundo 0,24 e ASCII fixos; as opções salvas antigas (`tc.opts`) foram apagadas, as novas ficam em `tc.opts2`.

### Etapa 14: Diálogo com os NPCs (antes "13c")
- **Assunto + tom** (decidido em 2026-10-04): escolhe o assunto (preço, quem trabalha aqui, viu algo ontem?), depois o jeito de perguntar (educado, insistente, mentira); o tom pesa conforme a personalidade de quem ouve. As falas pela gramática e pela vida de cada um (`locale/text/`, `voice.ts`), com relacionamentos.
- **Texto livre, estilo Façade (pedido do usuário em 2026-10-04; viável):** além das falas prontas, uma caixa onde o jogador digita em inglês, e o NPC reconhece **sem IA**, por palavras-chave com peso: cada intenção tem um léxico (`where` 3, `get to` 3…), marcas de pergunta (`?`, começar com do/can/where…), negação que inverte, e um eixo de tom (please/thanks contra "hey you"); os lugares, pessoas e ruas que existem são reconhecidos na frase (o mesmo índice da busca do Maps) e viram as lacunas da resposta. Escolhe a intenção com mais pontos; abaixo de um mínimo, "não entendi" (o próprio NPC estranha, o que é diegético). Responde pela gramática (`reply.<intent>.<tom>`, com a voz da pessoa). **Por que é viável:** o mundo fechado ajuda (poucas intenções, nomes conhecidos), o custo é de microssegundos, e é determinístico. **Riscos:** frases fora do léxico (mitigar com "não entendi" bem escrito e sugestões de assunto na tela), digitação ruim (tolerar erros de 1 letra nos nomes), e o jogador testando os limites (respostas para grosseria e absurdo). **Leitura antes de enviar (ideia do usuário, 2026-10-04):** enquanto o jogador digita, uma linha acima da caixa mostra o que o jogo entendeu: a intenção ("Question about a place's location") e o tom ("Tone: Respectful"); "Unrecognized" quando não reconhece (erros demais) e "Banter" quando não há intenção séria. Assim o jogador corrige a frase antes de enviar e o NPC nunca reage de um jeito inesperado; resolve o maior risco do texto livre. **Ordem:** primeiro o diálogo por assunto + tom (as escolhas), depois a caixa de texto por cima da mesma máquina de intenções (as escolhas viram atalhos de intenção). Briefings para as outras IAs: `docs/tarefas/07-intencoes-texto-livre.md` (o léxico) e `08-respostas-por-intencao.md` (as respostas, depois da 07).
- Troca o balcão provisório da F.9 e os pedidos de comida pela conversa com o vendedor.
- **Pedir direção pela caixa de texto livre** (pedido do usuário em 2026-10-04): a mesma máquina de intenções responde "where is …?".
- Falar com as pessoas na rua e ao telefone; base da engenharia social; **a ligação do contratante** (canal decidido nas "Decisões": vem com o diálogo).
- **A mesma leitura de texto livre para todo SMS** (pedido do usuário em 2026-10-04): mandar um SMS a qualquer NPC é lido pela máquina de intenções. Aceitar ou recusar um trabalho também passa por ela: a parte do contratante é `[HACKING]` (um agente `hacking` confere que aceitar/recusar continua funcionando).
- **Medidor de tom em dois eixos (ideia do usuário em 2026-10-04):** em vez da palavra "Tone: Respectful", um plano pequeno com a frase como um ponto que anda enquanto se digita. Eixo X: **respeitoso ↔ rude**. Eixo Y (sugestão do Claude, no lugar de engraçado ↔ sério, que é difícil de medir por palavras): **calmo ↔ pressionando** (urgência e insistência: "now", "right away", "I need", "!", maiúsculas, repetição), que é mensurável e é a alavanca clássica da engenharia social. O humor vira a marca "Banter". O fundo do plano é a mistura das cores dos quatro polos.
- **Fingir ser alguém (engenharia social, ideia do usuário em 2026-10-04):** o parser reconhece quando o jogador se apresenta como outra pessoa ("I'm officer…", "engineer from GRIDLINK"). A reação depende de a pessoa **existir** na simulação e de quanto o NPC a conhece: não conhece → a personalidade decide (confia, desconfia, pede um documento, que o jogador pode ter ou não); ouviu falar mas não sabe a aparência → um nome real que ele já ouviu convence; conhece de vista → desmascara. Usa as relações que já existem (colegas, família, `sim/citizens.ts`).

### Etapa 15: Web e celular (o resto da antiga etapa 12)
- **Sites das empresas** gerados da simulação (horário, endereço, o que vendem pela tabela da 13.1, quem trabalha lá), no notebook; alguns com versão para celular.
- **Portal de notícias e busca:** as manchetes da fila de eventos; uma busca que acha empresas, pessoas e lugares.
- **Fotos apontadas para o que importa (retorno do usuário em 2026-10-04),** nas notícias e no Streetwire: na batida, enquadrar a frente ou a traseira de um dos carros envolvidos (registrar os carros no evento, se ainda não estiverem; procurar o outro carro na frente dele se não for caro); no engarrafamento, do ângulo do semáforo mirando um carro parado naquela via (hoje às vezes mira o próprio semáforo); para os posts do Streetwire, o Claude faz um plano.
- **O resto da rede social:** respostas, compartilhamentos, assuntos em alta, o site do Streetwire no notebook, o jogador postar.
- **Registros dos cidadãos** (identidade e documentos): **Opus 4.8** (pode acionar o classificador).
- **E-mail** (canal do contratante para contratos longos e do mistério de fundo; veja "Canais do contratante").
- **Mais destinos do dinheiro:** lojas online, serviços, assinaturas, hardware pelo correio.
- **Tocador de música no celular:** músicas inclusas e lidas de uma pasta do computador do jogador (no Electron, uma pasta fixa ao lado do jogo; no navegador, escolhida); tocar, pausar, pular, volume; continua tocando com o celular abaixado. Se for para a grade principal, juntar o discador e os contatos num app só (os contatos numa aba) para abrir a vaga.
- **Maps:** o modo escuro (pedido de novo em 2026-10-04; pode vir antes, junto da lista de retoques); buscar ruas e esquinas ("5th Ave & 12th St").
- **App de mensagens cifradas** (o canal dos hackers, decidido em 2026-10-04; veja "O jogador é o número dele"): nome fictício, ligado ao número; o contratante passa a escrever por ele em vez do SMS comum.

### Etapa 16: Os NPCs usando a cidade e reagindo ao jogador (antes "13b" e parte da "13c")
- Usam a cidade: compram nas lojas, sentam nos bancos e nas mesas, esperam no ponto, usam os orelhões, entram nos cafés para fugir da chuva, reagem a apagões, batidas e sirenes (param, olham, fotografam), abrem guarda-chuvas, pegam táxi.
- **Pessoas dentro dos prédios** (a simulação ainda não põe ninguém dentro) e as portas de rua abrindo vistas de fora.
- Reagem ao jogador: desviam, olham, estranham alguém mexendo num poste, chamam a polícia.
- **O elevador com NPCs** (pedido do usuário em 2026-10-04): quem está dentro do prédio usa a cabine (`sim/lifts.ts`) e a move; **o jogador sempre tem prioridade**: se a cabine está ocupada quando ele chama, quem está nela vai direto para o andar dele (teleportado) e a cabine desce para o jogador.
- **Refinamento da polícia** (pedido em 2026-10-03): como ela procura, o que a atrai, como se despista. **Luz deixada acesa como rastro** (ideia do Claude aceita pelo usuário em 2026-10-04, mas só quando as missões e a investigação chegarem a esse ponto): precisa dos interruptores (13.10g) e de uma polícia mais madura; não fazer antes. Easter egg: música tocando no celular chama a atenção quando o jogador se esconde.

### Etapa 17: Economia (antes "13")
- Empresas, preços, estoques e salários interligados (a tabela da 13.1 é a base); bolsa de valores com app e site; banco de dados de empresas com endereço físico; os fabricantes da cidade dando a marca dos celulares **e dos chips**; comprar pacote de dados com dinheiro de verdade.
- **Hackear o banco e os sistemas das empresas** é `[HACKING]` (Trilha de hacking).

### Etapa 18: Transporte e carros dos cidadãos (antes "12b" e "12c")
- **Antes, refazer os carros** (retorno do usuário em 2026-10-04): não dá para entrar num táxi que é uma caixa; os ocupantes ainda são o modelo antigo de pedestre com o material metálico do carro.
- **Direção dos carros (retorno do usuário em 2026-10-04):** depois da curva eles corrigem demais para pegar a faixa mais à direita (fica agressivo): suavizar o ângulo da correção ou preferir a faixa mais à esquerda do sentido em que já estão; freiam na hora diante de pedestres (sem atropelamento no jogo, mas a freada deve ser progressiva); conferir quando um carro batido some, para não ficar parado para sempre causando engarrafamento; **batidas frequentes demais** (veio de "Bugs conhecidos": contar por `w.events.list` com `kind === 'crash'` por minuto de simulação, antes e depois; diagnóstico nas "Lições da 10.10").
- **Efeitos dos carros:** fumaça do escapamento (simples, sem ser volumétrica); fumaça volumétrica dos pneus nas freadas fortes.
- Táxi (pedido por telefone ou sinal, destino dado ao motorista, que é um cidadão), monotrilho com estações e trens, interiores dos veículos (carros ocos por dentro). Transporte aéreo: talvez um helicóptero de passeio, a confirmar.
- Carros ligados às pessoas: estacionamentos, placa e registro com dono, os carros saem e voltam com as rotinas (se cada pedestre perto do jogador tivesse carro, seriam ~600 carros a mais).
- **Reavaliar o ritmo do tempo** depois disso: medir de novo a discrepância entre os planos e a viagem de verdade e decidir com o usuário se o dia pode ser mais longo.

### Etapa 19: `[HACKING]` Hacking completo (antes "14"; Opus 4.8, avisar o usuário)
- Computadores virtuais, redes, cybercafés com Wi-Fi por distância, portas físicas, apps de hacker instalados por cabo, impacto sistêmico; o modelo completo de "Design: pacotes de rede simulados"; o celular como modem do notebook (tethering) e talvez um cartão SD compartilhado. Detalhes na "Trilha de hacking".

### Etapa 20: Refinamento e variedade (antes "15")
- **Perguntar no começo:** as opiniões do usuário sobre a etapa 6 (interiores).
- Fachadas mais complexas (cornijas, arcos, pilastras, bases, coroas; referências 28–30 e 32); muito mais letreiros e publicidade (34, 35), outdoors de empresas que existem e mudam com a simulação; topos acesos à noite (36); contornos de neon; distrito estilo Times Square; detalhes de telhado e *greebles*; chaminés industriais com fumaça; cabine telefônica fechada (23); transmissor de rádio como treliça vazada e mais marcos; mais modelos de celular e capinhas, formatos BlackBerry e flip; uma passada nos ícones; carros menos arcaicos (rodas girando, pessoas visíveis, modelos variados); animais (bichos nos apartamentos, cachorros com os donos, gatos de rua, pombos; `Household.pet` já existe).
- **Pessoas no formato do Minecraft:** subiu para a 13.8.
- **Efeitos da surge (retorno do usuário em 2026-10-04):** como os telões que dão tela azul, durante a surge os aparelhos falham: alguns postes apagam soltando faíscas, letreiros e placas de publicidade também, e luzes de janelas se apagam (`render/power.ts`, `SURGE`).
- **Distrito de entretenimento** (decidido em 2026-10-03): o Theater District com a densidade de Kamurocho (letreiros perpendiculares densos com moldura de lâmpadas, letreiros-caixa, lixo, ar-condicionado, fios, cavaletes acesos, máquinas de venda, cones, bicicletas), sem portal; o portal aceso num distrito de periferia com um quarteirão de ruelas só a pé. Base: `docs/tarefas/retorno/05-distrito-entretenimento.json`.
- **Render:** telas em perspectiva no mundo (a tela do aparelho como textura amostrada pelo shader, ao tirar/guardar e de longe); o notebook com teclas e botão de ligar como peças do modelo (investigar o custo); letreiros de lâmpadas como esferas de perto e uma fonte de pontos 3×5 no meio do caminho (recalibrar as trocas pelo tamanho em células); paredes finas sem relevo (decidir com o usuário); o modo de blocos nas paredes e objetos cúbicos; o interior falso nas janelas (*interior mapping*) para os prédios distantes.
- **Materiais** (pedido em 2026-10-03, "o jogo precisa de mais voxels"): tijolo com relevo (mapa normal com paralaxe) e, se der certo, cantaria, calçadas de vários tipos pelo distrito (das limpas às com ladrilhos faltando), paralelepípedos, concreto com juntas, chapas onduladas, portas de enrolar, asfalto rachado da zona de fogo, grades de ventilação. Volume de verdade (sacadas, ar-condicionado, cornijas salientes) é geometria.
- **Clima, segunda passada (depois dos materiais; retorno do usuário em 2026-10-04):** a chuva **volumétrica em volta do jogador** (hoje é um arco preso à câmera, que aparece ao olhar bem para cima ou para baixo; limitar o ângulo da câmera foi descartado porque quebraria com um FOV ajustável); os blocos grandes de chuva que acendem e apagam no chão; a neve no mesmo modelo; **relâmpagos localizados**, com forma de raio e *god rays*, como no GTA V. A chuva nas paredes internas fica para depois do rework dos interiores.
- **Geração do mundo animada no carregamento** (pedido em 2026-10-03, como a caixa de status do Minecraft): distritos, ruas, prédios subindo, a rede elétrica, as antenas, a população; mais curta com o cache.
- **A borda e o Sarcófago (retorno do usuário em 2026-10-04):** uma **luz vermelha de aviação** piscando no guindaste mais alto, visível de toda a cidade (um ponto vermelho onde não há prédio); o vento uivando na treliça (sintetizado); a fumaça da zona de fogo mais densa e concentrada, se o custo deixar, pelo mesmo sistema das nuvens volumétricas. **Do alto de um prédio, o mundo fora da cidade é uniforme demais e o contraste com a borda grita:** dar uma passada (variação do terreno queimado, transição).
- **Nome da engine** (pedido do usuário em 2026-10-04): o Claude dá um nome ao motor próprio, e a abertura mostra "Powered by <nome>".
- As anotações de "Refinamento: anotações" e os defeitos visuais das notas técnicas.

### Etapa 21: Sound design (antes "15b")
- **Referência para o que for musical ou sintetizado de propósito: chiptune** (dito pelo usuário em 2026-10-04).
- **Interferência GSM no notebook:** antes de uma ligação chegar, as caixas de som do notebook fazem o "tu-tu tu-tu… brrrr" de 2008. Pode vir antes, é pequeno.
- **Análise por síntese (o usuário não está satisfeito com parte dos sons; pode vir antes, numa sessão curta para testar o método com o pior som):** o usuário baixa um som de referência (de preferência CC0) e o põe numa pasta ignorada pelo Git (`referencias/sons/`); o Claude mede o arquivo em Python (espectrograma, envelope, frequências principais, ruído), escreve a receita de síntese, renderiza a receita fora do jogo e compara os espectrogramas por número, repetindo até ficar perto; o usuário só ouve o resultado final. O jogo fica sem o arquivo (regra "Tudo é código"). Fontes: Freesound (filtrar por CC0), Kenney (CC0), OpenGameArt (filtrar CC0), os pacotes da Sonniss para a GDC (royalty-free) e Pixabay (licença própria, ler antes).
- Mixagem entre as fontes, reverb por lugar (rua, saguão, apartamento, túnel), variação dos sons repetidos, e a revisão de ouvido com o usuário dos sons sintetizados.

### Etapa 22: Vida do personagem (antes "16")
- **App de fitness (pedido do usuário em 2026-10-04; as barras do relógio foram para a lista de correções):** um app de fitness no celular com os detalhes: fome, sede, batimentos (o fôlego da corrida), sono (quanto falta dormir) e uma ficha (nome, idade, altura), guardada no save e definida depois pelo editor de personagem.
- **Dormir antes do apartamento:** nos motéis (o tipo já existe, 13.1): pagar a noite no balcão e pular o tempo. Pode vir antes, com a fome e a bateria.
- **Comprar um apartamento e mobiliar (ideia do usuário em 2026-10-04):** colocar e mover móveis e itens. Viável com o gerador atual como caso especial: o apartamento do jogador pula a mobília de `furnish` e lê a lista de móveis dele do save (posição, rotação, tipo), editada no jogo pegando e soltando (a mesma mão da mochila e das prateleiras).
- Apartamento próprio (dormir, guardar hardware, o mural de pistas), stats, necessidades (a **temperatura**, que vem do clima, molha e esfria, e aparece no termômetro do relógio; o **cansaço**, pago dormindo num lugar seguro), customização pela lore. Efeitos leves, nunca morte.

### Marco: a demo para amigos (adiada pelo usuário em 2026-10-04)
> Quando houver mais missões e etapas prontas: (1) caber em **8 storage buffers** (hoje o shader do mundo usa 16; num PC com 8–10 a tela fica preta: juntar as listas das luzes dinâmicas, `subs` com `lampCol`, o que couber no `fx`) ou ao menos avisar com o limite do adaptador; (2) o **save** com o hash do código e o aviso de versão, guardar o `rng`, vários slots, salvar dormindo; (3) a **primeira mensagem do celular como tutorial** (ensina o celular e a tirar o notebook; o do notebook já existe, `~/start-here.txt`) e um tutorial em texto; (4) os retoques de luz que se veem no primeiro minuto; (5) o **`.exe`** do Electron (electron-builder; **sem a pasta `easter eggs/`**).

> **Os storage buffers e o desempenho em PCs fracos ficam com o Claude** (o usuário deixou a solução técnica com ele em 2026-10-04): planejar antes do marco, sem pressa.

### Lista fixa: correções pequenas (Sonnet)
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
- **Barras de fome e cansaço no relógio** (pedido do usuário em 2026-10-04, as duas já existem: `sim/needs.ts`, o estômago e o fôlego): duas barrinhas no topo do visor, uma de cada lado (`watch.ts`).
- **Barra de batimentos no centro do relógio** (pedido do usuário em 2026-10-04): a terceira barrinha, no meio do topo do visor; quanto mais alto o batimento, menos fôlego.
- **O relógio acende a luz** quando sobe sozinho com o sinal de hora ou o alarme (`watch.ts`).
- **Linha de debug:** reorganizar e enxugar (as teclas que saíram já foram tiradas na 13.13).
- **Notícias dominadas por batidas e apagões (retorno do usuário em 2026-10-04):** um limite de manchetes por assunto numa janela de tempo (`locale/news.ts`/`sim/events.ts`); junto, a notícia do apagão só depois que a luz volta (veio de "Bugs conhecidos").

### Lista fixa: retoques de luz (Opus)
- **Cores:** o usuário julga as paletas com a **F4**; falta a saturação da noite (perguntar: forte demais ou fraca?). **Saturação demais** (faixas roxas no vidro, saguão verde-água): pedir capturas com a posição (`POS`).
- **A tela do celular clara demais** (reforçado pelo usuário em 2026-10-04): as telas muito brancas do celular com um fundo um pouco mais escuro, **dependente do tema** (um branco gelo, um cinza claro), o que também tira o bloom excessivo; depois, se ainda precisar, o bloom e a adaptação do olho (`render/eye.ts`, `EYE.k`/`pageDim`, e o bloom em `gpu/shader.ts`).
- **O bloom do relógio parece falso** (retorno do usuário em 2026-10-04): muito bloom na borda e quase nenhum dentro do visor; os dígitos pretos não são cobertos pelo brilho. O halo da luz azul deve passar também por cima dos dígitos e do papel do visor (`watch.ts`, `WATCH_LCD`, `HALO_TINT` em `gpu/compositor.ts`).
- **A lâmpada das marquises verdes** sem a emissão nova: dar `gEm` como os letreiros.
- **Placas retrorrefletivas:** as placas de rua e de direção viradas contra o sol ficam escuras; dar um brilho leve de retrorrefletor (o Claude decide como, retorno do usuário em 2026-10-04).
- **Chão na chuva com ladrilhos clareando e escurecendo:** código antigo de chão molhado; achar e tirar.
- **Blackout de noite claro demais:** a luz que sobra com `cityLit` = 0 (céu, `cityAmb`, névoa, lua); depois `ADAPT_DARK`.
- **Nuvens e raios, se ainda incomodarem:** os degraus dos 12 passos (um deslocamento por célula pequeno e estável, ou um desfoque leve); um desfoque 3×3 nos raios.
- **Se o usuário quiser:** cones de luz nos holofotes das fachadas e nos faróis; a névoa laranja da cidade com luz de baixo para cima nas fachadas perto do centro.
- **Ainda não feito na luz:** a sala vista de fora sem o rebote; os painéis, os faróis e os letreiros não fazem sombra; os prédios não fazem sombra da luz dos postes; os objetos atrás do jogador não fazem sombra dos postes à noite. A grade de luz em voxels (a L.5 adiada, e as 16 direções do céu calculadas uma vez por lugar) só se o escuro das sombras incomodar.
- **Ajustes, para achar rápido:** `LAMP_SH_FAR`, `MOON_SHADE`, `CONE_K`/`CONE_FAR`/`CONE_DRY`/`CONE_WET`, `SKY_DIRS`, `REFL_OBJ_FAR`, `SIGN_EMIT`, `SCREEN_EMIT`, `SIGN_GLOW`, `SIGN_FILL`, `SIGN_EYE`, `BOUNCE_SUN`/`BOUNCE_SKY`, `DAYLIGHT_WIN`/`DAYLIGHT_FALL` em `gpu/shader.ts`/`gpu/objects.ts`; `SIGN_LIGHT`, `SCREEN_LIGHT`, `SCREEN_DAY`, `SIGN_DAY` em `raycaster.ts`; `ADAPT_DARK` em `gpu/world.ts`; `SURGE`/`SURGE_K`/`EYE_DARK_S`/`EYE_BRIGHT_S`/`EYE_PUSH_*` em `render/power.ts`. Os sons de apagão gravados do usuário ficam só no desenvolvimento (`EGG_SOUNDS`; **nunca empacotar `easter eggs/` no `.exe`**).

## Agradecimentos (easter eggs)

Pedido do usuário em 2026-10-01: amigos dele que aparecem no jogo como agradecimento. **Cada nome aparece exatamente uma vez em toda cidade gerada, num lugar diferente conforme a semente:** numa semente é o nome de uma empresa, em outra um cidadão, uma rua, um marco, uma manchete, um contato no celular etc. A escolha do lugar sai da semente (determinística). Os nomes são escritos exatamente como abaixo, sem tradução.
Os nomes estão como Nome Sobrenome; **onde só o sobrenome soar mais natural (o nome de uma empresa, por exemplo), pode usar só o sobrenome** (dito pelo usuário em 2026-10-03; ajuste na Sessão C).

- Léo Fennix
- Masotan Braun

**Implementado na 9.2:** a lista fica em `src/locale/thanks.json` e o sorteio em `thanks()` (`names.ts`). Hoje os lugares são loja, avenida ou rua larga, marco com nome e distrito. **Cada lugar novo das etapas seguintes (cidadão, contato, post, manchete) deve entrar no sorteio de `thanks()`.** Nunca dois nomes no mesmo lugar, e cada nome uma vez só.

## Design: rede social da cidade (proposta, 2026-09-30)

Ideia do usuário: uma rede social interna em que os cidadãos da simulação publicam sobre o dia a dia, inclusive coisas banais, e sobre o que acontece na cidade (uma batida, um apagão), às vezes com foto. É um jeito de **ver as consequências** do que o jogador faz, mesmo longe do lugar. A análise abaixo mostra que é viável e combina com a arquitetura.

**Como funciona**
- **Fila de eventos da simulação.** A simulação publica fatos estruturados: `{tipo, lugar, hora, gravidade, envolvidos}`. Exemplos: batida, engarrafamento, apagão, preço que subiu, chuva forte, semáforo quebrado. Os posts **nunca são inventados à parte**: cada um aponta para um evento real ou para um estado real da rotina de alguém. É a mesma regra de "os dados da simulação são a matéria do hacking".
- **Quem publica.** Depois de um evento, os cidadãos que o testemunharam (estavam perto, acordados, com celular) ou que foram afetados (ficaram presos no trânsito, perderam a luz, pagaram mais caro) *podem* publicar. A chance e o atraso dependem da personalidade de cada um: uns falam muito, outros nada, alguns só reclamam. Também há posts de rotina ("indo pro trabalho", "almoço", "que chuva"), para a rede não existir só por causa do jogador.
- **Fotos.** O render é uma função pura: `renderWorld(grid, world, view)`. Então a foto é um render pequeno (~48×20 células), feito da posição e da direção do cidadão **no momento do evento**, e congelado como dados de glifos (alguns KB). O custo é de um render minúsculo por foto. Em 2008, a baixa resolução passa por câmera de celular da época. Só tira foto quem estava lá e tinha um celular com câmera.
- **Texto.** Modelos com lacunas e uma gramática gerativa (no estilo Tracery), com a "voz" de cada pessoa: gírias, maiúsculas, erros de digitação, emojis da época. Tudo com semente: mesma semente e mesmas ações geram o mesmo feed. Nada de LLM, para funcionar offline e manter o determinismo.
- **Reações.** Respostas, compartilhamentos e assuntos em alta. Um evento grande vira uma onda de posts, que funciona como um "medidor de consequência" diegético.
- **Nível de detalhe.** Cidadãos longe do jogador não andam de verdade. As testemunhas saem da posição dada pela rotina ("às 14h está no trabalho, a 2 quarteirões"). Texto e foto são gerados no momento do evento, mas limitados por hora, para não pesar.

**Onde se acessa:**
- No celular, como app, pelos dados móveis (3G/EDGE lento, que depende do sinal das antenas) ou por Wi-Fi.
- No notebook, pelo site, que precisa de internet (num cybercafé, por exemplo).

É diegético, como todo o resto.

**Por que é bom para o hacking**
- **OSINT:** posts revelam rotinas, check-ins, nomes de bichos e datas, que são pistas de senha, e mostram quem mora onde.
- **A rede é um sistema da cidade:** tem servidor, contas, senhas, mensagens privadas e logs de acesso. O jogador pode invadir, ler mensagens diretas e apagar provas.
- **Notícia falsa com efeito sistêmico:** um post plantado ("o banco X vai quebrar") que os cidadãos leem e ao qual reagem, com saques, pânico e preços mudando. É o impacto no estilo Else Heart.Break() passando pela população.

**Riscos:**
- **Repetição de texto:** exige muitas variações de modelo e personalidades bem distintas.
- **Volume:** precisa de um limite de posts por hora e de uma priorização por relevância.
- **Coerência:** uma testemunha só fala do que podia ver.

**O que preparar antes:** a fila de eventos pode nascer já na etapa 7 (trânsito), com as batidas e os engarrafamentos, mesmo sem ninguém lendo. Assim a rede social, as notícias e os logs de câmera consomem a mesma fonte depois.

## `[HACKING]` Design: pacotes de rede simulados (pedido do usuário, 2026-10-01)
*(seção de hacking — pular fora de uma sessão de hacking; fazer na trilha de hacking, com o Opus 4.8)*

O usuário quer que toda rede do jogo (Wi-Fi, EDGE, 3G e qualquer serviço) funcione **por pacotes de verdade**, para que um capturador de pacotes no estilo do Wireshark (com outro nome, mas o mesmo programa na prática) mostre tudo de forma realista e funcional: handshakes, conexões TCP, perda de pacotes e retransmissão.
- **Quando:** no começo de uma etapa de rede, antes do hacking (14), como fundação dela. Na etapa de bugfix só o Wi-Fi inicial, com o modelo de "fluxo" (KB por segundo).
- **Arquitetura proposta, para manter o desempenho:** a simulação continua com fluxos (sessões: quem fala com quem, quantos bytes, quando). Os pacotes são **materializados de forma determinística a partir das sessões só quando algo está capturando** (o capturador, um log, um IDS de alguma empresa). Sem captura, nada é gerado. Com captura, os pacotes daquela rede aparecem com tudo coerente:
  - 802.11: beacons, probe, autenticação, associação, o handshake de 4 vias do WPA (EAPOL), dados cifrados (WEP/WPA) e em claro nas redes abertas;
  - IP: DHCP, ARP, DNS, TCP (SYN, SYN-ACK, ACK, seq/ack, janela, FIN), HTTP da época;
  - perdas pelo sinal (o mesmo dBm do rádio), com retransmissões e tempos que batem com a vazão do fluxo.
- **O passo da simulação** (granularidade dos pacotes, quantos se guardam) é ajustável, para equilibrar fidelidade e desempenho.
- Nomes de programas fictícios e parecidos (veja "Conteúdo seguro").

## Design: celular e apps (proposta, 2026-09-30)

Ideia do usuário: o celular do jogador tem vários apps com funções reais e uma loja de apps. A época de 2008 (primeiro iPhone e primeira loja de apps) resolve o dilema "a loja não existia nos anos 2000" e deixa a rede social funcionar no celular.

**O aparelho**
- **É um computador virtual como os outros:** CPU, memória, armazenamento, rádio (EDGE/3G, Wi-Fi, Bluetooth), câmera de poucos megapixels e bateria. Esses limites são reais: um app que não cabe na memória não roda, e o armazenamento enche.
- **É um objeto físico:** o jogador tira o celular do bolso, e ele aparece na mão, ocupando parte da tela. A tela é uma região da própria grade de caracteres (`Lcd` em `src/phone/lcd.ts`), desenhada depois do mundo. Os botões fazem som, e o texto é composto aos poucos, como nos terminais. *(Feito na etapa 8.)*

**Conectividade (é daqui que vem a jogabilidade)**
- **Dados móveis:** vêm das antenas da cidade, que existem na simulação. O sinal depende da distância e dos prédios no caminho. São lentos e custam dinheiro do jogo: há um plano de dados com franquia em MB, e quando acaba é preciso comprar outro pacote (veja "Pedidos atendidos" em `docs/historico.md`).
- **Wi-Fi:** em cybercafés e outros lugares com senha, com alcance físico.
- **Downloads grandes só por Wi-Fi.** Em 2008, a loja real limitava os downloads por rede celular a ~10 MB. Assim, os apps pequenos baixam na rua, e os grandes exigem ir a um cybercafé. A rede social funciona no celular pelos dados móveis, e ir ao cybercafé continua tendo motivo.

**A loja de apps**
- É uma empresa da cidade, com servidores reais na simulação, e portanto pode ser hackeada.
- Há apps pagos com dinheiro do jogo.

**Apps com função real,** cada um ligado a um sistema da simulação. Cada um nasce na etapa do sistema a que pertence:
- **Etapa 9:** discador, SMS e câmera. A foto é um render pequeno e pode ser postada.
- **Etapa 5:** clima, que lê o estado real do clima.
- **Etapa 8:** mapa e GPS, com a posição dada pelas antenas ou pelo GPS.
- **Etapa 18 (transporte):** táxi, que liga para a central, e horários do monotrilho, com os horários reais dos trens.
- **Nome do jogo:** o usuário quer um termo técnico direto, que se entenda sem pensar (como Uplink e Defcon). BACKDOOR não (conotação); WIRETAP mais ou menos; **GRID DOWN foi o que mais agradou**: buscar nessa linha (sugestões no chat de 2026-10-04).
- **Etapa 12:** rede social.
- **Etapa 13:** banco, com o saldo real; notícias; tocador de música.

**Apps de hacker não estão na loja.** São instalados por fora, pelo cabo do notebook (um "desbloqueio", como o jailbreak da época). Exemplos: scanner de Wi-Fi, farejador de Bluetooth e captura de pacotes, todos limitados pelo hardware fraco do celular. O notebook continua sendo a ferramenta principal.

**Os celulares dos cidadãos também existem:** modelo, apps instalados, contatos e mensagens são dados hackeáveis. Um app falso publicado na loja pode se espalhar pelos celulares da população, o que é um impacto sistêmico.

## Estado atual

### Resumo para começar uma sessão (atualizado em 2026-10-02)

> **⚠️ LEIA ISTO PRIMEIRO — regra do classificador de segurança.** Qualquer coisa que **se pareça com cibersegurança** (hacking, redes, portas, varredura, senhas, captura de pacotes, invasão, consoles remotos), mesmo no contexto de game dev, **pode ser bloqueada pelo classificador de segurança** no meio da resposta. O **Sonnet 5.5** bloqueou; o **Opus 4.8** (menos safeguards) fez sem bloqueio. Por isso:
> - **Esse trabalho é separado numa trilha própria** (veja "Trilha de hacking" no Roteiro). Ao começar uma sessão dessa trilha, **avise o usuário para trocar para o Opus 4.8 antes de prosseguir.**
> - **Quando a etapa atual NÃO for de hacking, não abra os arquivos de hacking nem leia as entradas de hacking** deste documento. Só de ter esse conteúdo na resposta pode disparar o classificador e travar o trabalho. **Arquivos de hacking:** `src/sim/network.ts`, `src/sim/packets.ts`, a parte de hacking de `src/laptop/shell.ts` (os comandos `mmap`/`bruter`/`tdump`/`tnet`/`mbus`, o builtin `job` que lê o contrato, e a sessão remota `conn`/`remote`, inclusive o comando `log` do host `omc` da operadora), o tutorial `home["start-here.txt"]` de `src/locale/laptop.en.json` (o resto do arquivo é a interface do shell e pode ficar nas sessões normais), os campos `util` e `omc` de `src/sim/wifi.ts` (e `cellLog`/`mastNear` das redes da operadora, em `network.ts`/`telco.ts`), **`src/sim/jobs.ts` e `src/locale/jobs.ts`** (o contratante/jobs; as linhas `[HACKING]` de `src/sim/gear.ts` são só o efeito do chip no calor; as poucas linhas `[HACKING]` em `src/sim/world.ts` e `src/phone/phone.ts` só chamam essa API e podem ficar como estão), **`src/sim/heat.ts`** (o calor e a polícia da fatia vertical; o `recordAct` em `world.ts` e o HUD de calor/prisão em `main.ts` só a chamam), e o manual `docs/manual-hacking.html`/`.pdf`. **As manchetes e os posts da investigação** (`manhunt`/`bust` em `news.ts`, `social.ts` e os `locale/text/*`) são texto de jornal/feed limpo e **não** são `[HACKING]`: podem ficar com as sessões normais, como já ficavam os posts de blackout. **Seções deste doc marcadas `[HACKING]`:** a 10.6 no Histórico, as "Lições da etapa 10" (em `docs/licoes.md`), "Design: pacotes de rede simulados", os itens `[HACKING]` do Roteiro e a subseção "Feedback para o Opus 4.8" (na seção de feedback).
> - Se, mesmo fora de uma etapa de hacking, você **precisar** mexer num desses arquivos (um bug de build, por exemplo), avise o usuário e peça para ele confirmar o modelo antes.

- **Onde estamos (2026-10-04):** etapas 1 a 11, a R (render na GPU), a parte da 12 feita no celular (12.1–12.13), a iluminação (sessões A/B/L) e a fatia vertical (F.1–F.9: contratante, três trabalhos, banco, calor e polícia, relógio, salvamento, balcão) estão feitas; várias esperam o teste do usuário (lista no topo do Plano). **Agora: a etapa 13 (Lugares e lojas), com 13.1–13.13 e 13.10a–c feitas; a próxima é a 13.10d (portas 3D).** Veja **"Plano: etapas 13 a 22"** (renumerado em 2026-10-04: só etapas e subetapas numeradas, sem letras de sessão).
- **Na Trilha de hacking** a etapa 10 está fechada (10.6 e 10.11, Opus 4.8); o que falta dela está no Roteiro. O retorno do usuário sobre a 9 B/C, a 10 (grupo C, 10.7–10.11) e o manual de hacking (`docs/manual-hacking.pdf`) pode chegar a qualquer momento.
- **A nota "perguntar sobre a etapa 6"** é para o começo da etapa 20.
- **Antes de começar qualquer etapa, leia a seção "Lições da etapa N" do sistema em `docs/licoes.md`** (índice nas notas técnicas): são o conhecimento acumulado das sessões anteriores (a 7 tem como testar a simulação sem o jogador; a 8, como testar o celular).
- **Caches (A.3):** o Electron serve sempre na porta 47180 (a mesma origem, então o Chromium guarda os shaders compilados e o `localStorage`; o shader só recompila quando o texto muda, sem flag). A população de cada semente fica em IndexedDB (`src/popCache.ts`), com a chave pelo hash do código que a gera (`?raw` de `city`, `citizens`, `telco`, `power`, `interior`, `device`, `rng`, `world`); `?fresh` força gerar de novo. Se a população passar a depender de outro arquivo, acrescentá-lo à lista. O navegador do app (painel do Claude) não guarda o cache de shaders em disco: lá cada carregamento compila de novo (~6 s).
- **Rodar:** `iniciar.bat` ou `npm run dev` (porta 5173, a do usuário); **`jogar-electron.bat`** (ou `npm run electron`) faz o build e abre em tela cheia no Electron, que é como o usuário testa ao dar retorno (R.37). O Claude usa a configuração `claude-dev` (5180) ou `vite-auto`. `?seed=42` fixa a cidade; `?mute` começa sem som. **Precisa de WebGPU** (Chromium/Electron): o mundo inteiro é desenhado na GPU desde a R.17.
- **Teclas:**
  - jogo: WASD, mouse, Shift corre, Q/E (e as setas laterais) giram; **F** na frente de um orelhão tira o fone (e desliga); **F** mirando um produto numa prateleira o põe na mochila (sem pagar), e no caixa abre o balcão (←/→ dinheiro ou cartão); **B** abre a mochila (arrastar, R gira, E come, botão direito devolve/joga fora); no balcão de quem serve comida, Tab alterna comer aqui / para viagem; **N** tira o notebook onde dá para sentar ou apoiar, **Esc** fecha; **Esc** sem nada nas mãos pausa (menu com salvar, opções e debug); relógio de pulso: **I** abaixa/ergue, e os três botões **J** modo (hora, alarme, cronômetro), **K** start/stop (no modo alarme alterna alarme e sinal de hora; segurado acerta o alarme ou zera o cronômetro), **L** luz; com o notebook aberto, **Insert** ergue/abaixa o celular (usado pelo mouse);
  - celular (como no GTA IV): **seta para cima**, **P** ou o **botão do meio** tiram; **P** ou o botão do meio abaixam (a tela e o estado ficam); na tela inicial, o botão do meio (ou a seta para cima) abre o discador; a seta para baixo na tela inicial limpa as notificações; no discador vazio, as setas escolhem uma chamada recente e a tecla verde liga; a tecla 1 tem os símbolos (`. , ? ! ' - @ _ : / & ( ) " # $ %`); com o notebook aberto, o celular continua clicável (o teclado vai para o notebook); com ele fora, o ponteiro do sistema fica livre e clica nas teclas (segurar o botão direito olha em volta; a roda anda pelo menu e pelas listas); com ele fora, setas = d-pad, Enter ou botão esquerdo = OK, Backspace ou botão direito = Voltar (na tela inicial, guarda), dígitos = teclado, + = \*, − ou . = #, **Space** = tecla verde (abre o discador, liga), **Delete** = tecla vermelha (volta à tela inicial); no menu (grade 4×4), 1–9 e 0 abrem os dez primeiros apps; na câmera, setas para cima e para baixo dão zoom, esquerda liga e desliga o flash; no mapa, 1–4, \*/# ou a roda do mouse = zoom, OK = lista de lugares (ou centralizar);
  - visual: **só no menu de opções** (13.13): som, STYLE (HIGH DEFINITION ou CLASSIC), SHARPNESS (SOFT ou SHARP: a fusão dos glifos distantes) e as linhas de debug; as câmeras de CCTV têm a resolução própria do modelo (`camRows`); a interface não muda de tamanho (10.9). **F3** esconde e mostra as linhas de debug. As opções ficam em `localStorage` (`tc.opts2`), separadas do save (IndexedDB);
  - interiores: entrar pela porta; subir de elevador (as escadas internas saíram por enquanto): mirar na botoeira e clicar (botão esquerdo); escadas de incêndio dos prédios de tijolo andando pela borda de fora do patamar;
  - debug: **F4** mostra a mesma vista ao meio-dia, no pôr do sol e à noite, lado a lado (para decidir as cores); **T** e Shift+T mudam a hora em ±1 h (o trânsito e os pedestres seguem a hora); **Y** percorre os climas fixos e volta ao automático; **F6** liga e desliga a subestação mais próxima (era o K até a F.7; a linha de debug acima do relógio diz qual, a que distância e para onde); **C** olha pela câmera de segurança mais próxima (C ou Esc sai); no jornal do celular, as setas escolhem a manchete, OK abre a matéria, a tecla esquerda atualiza; **Shift+F6** liga e desliga a cidade toda; **PageUp/PageDown** sobem e descem um andar dentro de um prédio (até existirem escadas e elevadores).
  - A linha de status mostra semente, posição, `DRAW x ms (MAX y)` e os modos. A linha de cima dela mostra data, hora, clima e `POWER x/y`.
- **Desempenho:** no PC do usuário (monitor de 180 Hz; ele nota quedas). Desde a R.17 o mundo é desenhado só na GPU (compute shader, um raio 3D por célula); o `DRAW` da linha de status é o tempo da fila da GPU (`onSubmittedWorkDone`, ~3 ms aqui, contando a espera). O thread principal ainda prepara as listas do quadro (luzes, objetos: ~1 ms). Toda novidade deve ser medida antes e depois.
- **Mapa dos módulos:** em `docs/mapa.md` (o que está em cada arquivo). Ler só a parte da pasta em que se vai mexer.
- **Ordem do quadro:** `main` em `gpu/shader.ts`, por célula: o andar em volta (`roomWalk` com `inView`), a cidade (`cityCell`: céu, Sarcófago, chão, paredes, telhados, cerca), fumaça, objetos, o vidro visto de dentro, `finish`, e por fim chuva e neve (`fallOver`).
- **Bugs registrados para depois:** veja "Bugs conhecidos".

### Histórico

O registro detalhado de tudo o que foi feito, etapa por etapa (com nomes de funções, medições e o retorno do usuário), fica em **`docs/historico.md`** (movido em 2026-10-02 para o CLAUDE.md pesar menos em cada mensagem). Ler só a parte da etapa em que se está trabalhando. Lá também estão o plano da etapa 10, a preparação da etapa 6 e os designs já implementados (rede elétrica e blackout, física dos carros). **Ao fechar uma subetapa, a entrada nova do Histórico vai para lá** (no topo), e aqui só o Resumo é atualizado. As entradas `[HACKING]` de lá seguem a mesma regra: não ler fora da Trilha de hacking.

## Bugs conhecidos (para uma etapa de correção mais adiante)

Pedido do usuário em 2026-09-30: registrar os bugs sem perder tempo com eles agora; haverá uma etapa de correção de bugs mais para frente.

- Os bugs abertos agora estão no **Plano** (nas etapas e nas listas fixas). Bugs novos entram aqui até a próxima organização.
- **Travada à meia-noite (retorno do usuário em 2026-10-04):** a simulação recalcula muita coisa na virada do dia e o jogo trava um instante. Espalhar esse trabalho por vários quadros (como o carregamento do começo), em vez de um fade com barra (que atrapalharia numa perseguição). Achar o que roda na virada (provavelmente as rotinas do dia em `sim/citizens.ts`/`world.ts`).
- **`isOpen` não sabe o dia da semana (2026-10-04, visto na 13.3):** os bancos aparecem abertos no fim de semana sem ninguém no caixa (`sim/telco.ts`); dar os dias à tabela de `placeTypes.ts`.
- **A lua parece se esconder de noite (retorno do usuário em 2026-10-04):** conferir a trajetória (`sim/clock.ts`, o nascer e o pôr, e o desenho em `sky.ts`); pode ser só a fase (lua nova ou nascendo de madrugada) ou um erro de sinal na altura.
- **Fachada que muda bruscamente ao se aproximar:** a faixa de transição foi alongada na R.34 (esperando o teste do usuário). Se ainda aparecer, comparar as cores do visual de longe (`cF` em `wallCell`) com a média do detalhado: o de longe parece mais claro (parede marrom) que o de perto (vidros escuros).
- **Semáforo reverte / "pouco tempo antes de ser pego" (retorno do usuário em 2026-10-03):** no trabalho 2 o usuário sentiu que "não consegui deixar o semáforo por tempo suficiente" e anotou "o semáforo volta ao normal". Investigar (a) se algo zera `S.sig` sozinho (o trabalho fecha no instante em que fica fora do normal, então reverter não falha o trabalho, mas confunde); (b) se a pressão da polícia (F.2, `heat.ts`) chega rápido demais no trabalho 2 — talvez a janela/escala precise de folga. Diagnóstico de batidas nas "Lições da 10.10".

## Refinamento: anotações (para a etapa 20)

Ajustes que o usuário pediu para deixar para a etapa de refinamento e variedade (não são bugs):
- **Opiniões sobre a etapa 6:** o usuário testou e tem opiniões; perguntar no começo da etapa 20.
- **Carros ocos por dentro:** a carroceria é um bloco sólido; pelo vidro se veem o motorista e os passageiros, mas cortados pela caixa do corpo (só o que fica acima de 0,95 m aparece). Fazer o interior oco (laterais, piso, painel) para ver as pessoas inteiras.
- **Dois cones de farol:** hoje cada carro tem um só cone de luz. Devem ser dois, um por farol, com o da direita mais longo (o facho assimétrico de verdade).
- **A praça do X do theater district** e o X em geral: mais decoração (veja a 7.5 e a 7.6).

## Notas técnicas (para as próximas sessões)

### Lições aprendidas: índice (o texto está em `docs/licoes.md`)

Antes de mexer num sistema, ler só a seção dele em `docs/licoes.md` (`grep -n "^### " docs/licoes.md` dá as linhas). A seção `[HACKING]` só na Trilha de hacking.

- `[HACKING]` Lições da etapa 10 (notebook e hacking), para não repetir
- Lições da F.6 (salvamento e menu), para não repetir
- Lições da reescrita da luz (L), para não repetir
- Lições da etapa R (render na GPU), para não repetir
- Lições da 11.5 (gerador de textos e apps), para não repetir
- Lições da etapa 11 (cidadãos, rotinas e rede social), para não repetir
- Lições da 10.10 (direção sem trilhos), para não repetir
- Lições da segunda parte do bugfix, para não repetir
- Lições da primeira parte do bugfix, para não repetir
- Lições da etapa 9 (rede de telefones e celular), para não repetir
- Lições da etapa 8 (navegação e celular), para não repetir
- Lições da etapa 7 (trânsito), para não repetir

- **Regras da arquitetura:**
  - `src/sim/` nunca importa nada de `src/render/` nem do DOM. O render só lê o estado da simulação.
  - Toda aleatoriedade da simulação vem de `world.rng`, nunca de `Math.random`, para manter o determinismo.
  - Detalhes só visuais (textura do chão, janelas acesas) saem de `hash3` da posição. São fixos e não piscam.
  - A geração da cidade é a exceção a `world.rng`: a grade usa `mulberry32(seed)` e cada quarteirão usa `mulberry32(hash3(seed, i, j))`. Continua determinística, e cada prédio tem identidade pela posição.
- **Interpolação:** tudo o que se move na simulação guarda a posição do tick anterior (`px`, `py`), e o render interpola com `alpha`. Qualquer entidade nova que se mova deve seguir esse padrão, senão treme.
- **Projeção:**
  - O FOV é fixado na **vertical** (`VFOV = 60°`), e o horizontal segue a proporção da janela (~92° em 16:9). Antes era fixado na horizontal (72°), o que deixava só ~44° na vertical, e o usuário achou apertado ao olhar para cima e para baixo.
  - `scale = (rows/2) / tan(VFOV/2)` = linhas por unidade de altura à distância 1.
  - `plane = (cols/2) * cellAspect / scale` = tan(FOV horizontal / 2).
  - Olhar para cima e para baixo: desde a R.17, a câmera 3D de verdade da GPU (os raios giram pelo `pitch`), com o limite em ~77° (`Camera.MAX_PITCH = 1.35`). Antes era *y-shearing* no raycaster por coluna, limitado a ~40° pela distorção.
  - **Decidido na etapa 2: fica o raio por coluna.** A câmera com giro vertical de verdade volta a ser avaliada na etapa 6 (interiores: vista de andares altos, elevadores de vidro) ou na 10 (voo). O usuário decidiu esperar por ela para olhar mais para cima. A ideia original era: lançando um raio 3D por célula (ou fazendo o raycast no shader do GPU) em vez de um raio por coluna. As verticais passariam a convergir ao olhar para cima, e isso destravaria vistas do alto, voo e janelas de andares altos. O custo em JS é da ordem de 20 mil raios por frame, cada um com vários passos de DDA; no GPU seria trivial. Decidir junto com a reescrita do render para a cidade grande e o horizonte distante.
  - Uma célula pertence a uma parede ou sprite quando o *centro* dela está dentro do intervalo projetado (`Math.ceil(y - 0.5)`).
- **Unidades:** 1 unidade = 1 metro desde a etapa 2. As medidas estão em `city.ts` (`FLOOR_H`, `SIDEWALK`, `LANE_W`).
- **Atlas de glifos:** o índice do glifo é o próprio código do caractere (ASCII 33–126). Os blocos e as linhas de caixa estão nas posições 128+ (`BLOCK` em `atlas.ts`, usados pela tecla U). Um glifo novo precisa de uma posição livre do atlas.
- **`CharGrid`** usa `Uint8ClampedArray`: as cores saturam sozinhas em 0–255, então não precisa limitar valores antes do `put`.
- **Onde mexer na variedade:**
  - A geometria fica na simulação (`Building` em `city.ts`: caixa, cilindro ou caixa cortada (`cut`), altura, `style`, cores, `lit`, `shop`, `biz`, `feat`, `flood`). A aparência fica no render, em `wallColumn` (`raycaster.ts`), que recebe o prédio, a distância, o lado (0/1 = faces da caixa, 2 = cilindro, 3 = face cortada), a face (`faceSpan`), a luz da face e o ponto `along` onde o raio bateu (no cilindro, metros de arco).
  - Um estilo novo é um valor a mais em `Facade` e um ramo a mais em `wallColumn`. Todo estilo precisa funcionar nos dois níveis: o detalhado e o distante (`!detailed`), senão treme ao longe.
  - Formas que não partem do chão ainda não existem; tudo é caixa ou cilindro do chão até `h`, e as peças de telhado ficam escondidas dentro do prédio de baixo. Telhados inclinados ou formas flutuantes exigiriam um `z0` no teste de raio.
  - Postes, árvores, carros, holofotes e mobiliário são objetos com volume (`objects.ts` e `models.ts`, desde a etapa 4b). Um objeto novo é uma lista de peças `part(...)` em `models.ts` e um ramo em `collectObjects`. A fumaça tem passe próprio (`drawSmoke`) porque é vista até 2,5 km.
  - `burnGround`, `fenceColumn` e `drawSmoke` em `raycaster.ts` desenham a borda.
- **Defeitos visuais conhecidos, ainda não resolvidos:**
  - O letreiro de loja (faixa `=` a 2,7–3,3 m) vira uma listra diagonal larga quando visto de lado, porque é contínuo ao longo do prédio inteiro.
  - O nível de detalhe da fachada ignora a obliquidade da face, então fachadas vistas muito de lado usam o modo detalhado e as janelas se misturam.
  - O jogador não sai da cidade (`isSolid` é verdadeiro fora dela). A zona de fogo existe só no visual; o medidor de CO e as patrulhas ainda não.
  - Da rua, a zona de fogo aparece quase só como a faixa perto do horizonte, a fumaça e o céu. Deve ficar mais bonita vista do alto (com a câmera 3D).
  - O dia ainda é o "visual de serviço" provisório: a cidade fica escura contra o céu claro (o usuário viu e não pediu mudança por enquanto).
  - Os objetos (postes, bancos, caçambas) ainda não são sólidos: o jogador os atravessa.
  - As faixas acesas das coroas e as costuras do cilindro (onde o ângulo dá a volta) podem tremer ao longe.
- **Textos dentro do jogo:** os nomes de lugares já vêm de `src/locale/en.json`. A tela de título e a linha de status ainda têm textos fixos em inglês no código.

## Como testar no navegador do app

- O painel tem só ~800×450, então as células ficam com ~3×5 px e o texto da linha de status é ilegível nas capturas. Serve para ver a composição, não para ler detalhes.
- **O pointer lock não funciona no painel** (`WrongDocumentError`); é esperado. Para testar:
  - Em modo dev, `window.world` e `window.camera` ficam expostos. Por exemplo: `camera.look(0, 2)` olha para cima, `world.player` mostra a posição.
  - Para posicionar: mudar `world.player.x/y` **e** `px/py` (senão a interpolação desliza), e `camera.yaw`/`targetYaw`, `pitch`/`targetPitch`.
  - `gridText(x0, y0, x1, y1)` devolve os caracteres de uma região da tela como texto. As capturas são pequenas demais para ver detalhes de fachada; isso resolve. Troque `\0` por outro caractere antes de imprimir e mantenha a região pequena (~90×40), senão a saída estoura o limite.
  - O zoom de captura não funciona no painel.
  - Teclas se simulam com `dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW'}))` e o `keyup` correspondente.
- O laço de quadros só roda com o painel visível. Se `world.tick` não sobe, tire uma captura de tela antes de medir.
- **Portas (pedido do usuário em 2026-09-30):** a **5173** é do usuário, que joga pelo `iniciar.bat` enquanto o Claude programa. O Claude testa sempre pela configuração **`claude-dev`** (porta **5180**). Se ela estiver ocupada por outra conversa, use a configuração `vite-auto` do `.claude/launch.json` (porta livre via `PORT`, lida no `vite.config.ts`); `vite-5174` e `vite-5175` também existem.
- Cada recarga (inclusive a do HMR) sorteia uma semente nova, **a não ser que haja um save** (desde a F.6, sem `?seed` a cidade do título é a do save; `?new` sorteia outra). Use `?seed=42` para comparar sempre a mesma cidade. O botão do título agora é **NEW GAME** (ou CONTINUE), não mais "ENTER THE CITY"; com save, NEW GAME pede um segundo clique.
- **Testar sem som (pedido do usuário em 2026-10-01):** o usuário acompanha os testes no navegador do app e ouve o som. Abrir sempre com `?mute` (por exemplo `http://localhost:5180/?seed=42&mute`).
- Para criar arquivos, use a ferramenta Write. Um heredoc grande pelo Bash falhou com erro de aspas nesta máquina. Para edições grandes em lote, grave um script Python no scratchpad com Write e rode-o.
- A pasta `referencias/` está no `.gitignore` (são quadros do vídeo de outra pessoa) e existe só no disco.
- **Lições desta máquina (2026-09-30):**
  - **O Vite às vezes serve um módulo velho** depois de edições por script (aparecem erros como "does not provide an export" ou funções com a assinatura antiga). Rodar `touch` nos arquivos editados e navegar de novo para a URL. Para conferir, `fetch('/src/...ts')` mostra o que está sendo servido.
  - **Esconder o overlay à mão** (`#overlay.hidden = true`) deixa o jogo no modo título, em que a câmera gira sozinha devagar. Reposicione a câmera logo antes de cada captura, ou entre de verdade: `find` em "ENTER THE CITY" e um clique (isso também cria o som).
  - **Uma edição de código faz o HMR recarregar a página** e perder o estado (posição, hora, clima). Reaplique depois de cada build.
  - **Painel oculto:** o laço para e a captura mostra um quadro velho; tire uma captura antes, para acordar o laço.
  - **Testes isolados:** dá para importar módulos direto no console (`await import('/src/render/objects.ts')`) e desenhar numa `CharGrid` própria. Foi assim que apareceu o erro de projeção dos objetos.
  - **Limite de 5 servidores de preview por pasta,** contando as outras conversas; reaproveite o que já está rodando (`preview_list`).
  - **Nunca use `git checkout <arquivo>` para desfazer uma linha de debug:** isso apaga também o trabalho não commitado do arquivo (aconteceu com o `main.ts`). Desfaça a linha com uma edição.
  - **Barra invertida em scripts Python que geram TypeScript:** `C('\\')` sai errado com facilidade; para strings com `\`, use a ferramenta Edit.

## Como trabalhar neste projeto

- **Uma sessão por etapa ou funcionalidade.** Ler só os arquivos e as imagens de referência daquela etapa.
- **Bugs simples pelo agente `bugfix` (regra do usuário em 2026-10-04; substitui as sessões com o Sonnet):** as correções da "Lista fixa: correções pequenas" vão para o agente `bugfix` (Sonnet 5.5, esforço médio), chamado de dentro da sessão, em lote. O agente `hacking` roda no Opus 4.8 com esforço médio (`effort` no cabeçalho de `.claude/agents/*.md`). O que é de projeto (render, simulação, sistemas novos) fica com o Opus.
- **Olhar o limite de 5 h (regra do usuário em 2026-10-04):** no começo e de tempos em tempos, ler o uso (`get_usage`: limite de 5 h e semanal) e planejar a sessão pelo que sobra. Um agente custa pelo menos ~5% do limite por uso (ele relê o contexto): só chamar quando valer.
- **Testar sem o navegador sempre que der (pedido do usuário em 2026-10-04):** uma pasta `tests/` com scripts que rodam a simulação no Node (empacotados com `npx rolldown`, como nas "Lições da 11.5"): comprar, pagar, furtar, fome, bateria, pedir direção, trabalhos, save. O navegador fica para o que é visual. **Quando for preciso medir desempenho, avisar o usuário antes para ele abrir o painel**, em vez de perder tempo com o laço parado. A pasta existe desde a 13.10a (como rodar em `docs/mapa.md`; uma semente por execução).
- **Opinar sempre (pedido do usuário em 2026-10-03; regra atualizada em 2026-10-04):** dar sugestões técnicas e criativas ao longo do trabalho, **a cada etapa**. O feedback vai para **`docs/feedback-claude.md`** (datado, o mais novo em cima), e **todo feedback escrito lá também é mandado no chat**, para o usuário não precisar procurar. A seção "Opiniões e sugestões do Claude" do CLAUDE.md fica como histórico; o novo vai para o arquivo.
- **Reunião no fim do limite (regra do usuário em 2026-10-04):** os últimos ~10% de cada janela de 5 h ficam para uma conversa sobre o estado do jogo (de preferência num chat novo, que gasta pouco): o que foi feito, o que vem, o que mudar. O Claude olha o `get_usage` e, perto de 90%, para o trabalho e propõe a reunião. **Exceção decidida pelo usuário em 2026-10-04:** naquela janela o resto do limite foi para a 13.10d, e a reunião ficou para a janela seguinte (ainda em 2026-10-04), porque o limite semanal está perto do fim.
- **Ouvir o agente `hacking` sobre ideias (pedido do usuário em 2026-10-04):** de vez em quando, perguntar a ele que missões e sistemas de hacking fariam sentido com o que já existe (ele conhece o que o Claude não lê), ou propor ao usuário uma sessão com ele. Pesar o custo (~5% por chamada).
- **O agente `bugfix` só com a lista cheia (pedido do usuário em 2026-10-04):** esperar acumular muitas correções e mandar todas de uma vez; cada chamada custa ~5% do limite.
- **Separar o hacking (classificador de segurança):** veja a regra no topo de "Estado atual". Trabalho de cibersegurança vai para a "Trilha de hacking" do Roteiro, com o Opus 4.8 e aviso ao usuário no começo. **Fora de uma sessão dessa trilha, não abra os arquivos de hacking nem leia as entradas `[HACKING]`**, para não travar a resposta no classificador.
- **Delegar a Trilha de hacking ao agente `hacking` no mesmo chat (regra do usuário; teste passou em 2026-10-03):** o agente `.claude/agents/` roda no Opus 4.8 e escreveu conteúdo de hacking (as dicas da tela de carregamento em `src/locale/tips.json`) sem bloqueio. Fica a critério do Opus 5.5 o que delegar e quando, pesando se vale gastar os tokens do agente (ele começa sem contexto) em vez de abrir um chat novo com o Opus 4.8: tarefas pequenas e bem cercadas vão para o agente; sessões grandes da trilha continuam num chat próprio. O Opus 5.5 não lê o que o agente escreveu de hacking além do relatório dele.
- **Registrar o hacking a CADA subetapa (regra do usuário em 2026-10-03):** sempre que uma subetapa criar ou tocar conteúdo que **se pareça** com cibersegurança (um arquivo, uma função, uma seção), marcar **no código** (comentário `[HACKING]` no topo do arquivo e nas linhas) **e no documento** (a lista "Arquivos de hacking" e, se for o caso, uma entrada `[HACKING]`), para as sessões normais (Opus 5.5) não abrirem e travarem no classificador. **O próprio contratante/jobs aciona o classificador** (contratar um apagão lê como ataque real), por isso ele é Trilha de hacking mesmo sendo "sessão normal" no plano.
- **Agrupar subetapas e pedir retorno só no fim do grupo (regra do usuário em 2026-10-03; TEM PRIORIDADE sobre as outras regras de ritmo):** conforme o tamanho, o Claude junta várias subetapas num grupo e faz tudo de uma vez, sem perguntar no meio, e só pede o retorno no fim do grupo. Cada subetapa continua com o próprio commit. A leitura da caixa de feedback, a limpeza do documento e o aviso de chat novo acontecem **no começo e no fim do grupo**, não a cada subetapa (quando outra regra diz "a cada subetapa", vale "a cada grupo"). Isso evita perguntas, economiza contexto e diminui os chats novos.
- **Testes agrupados (pedido do usuário em 2026-09-30):** cada etapa tem **2 ou 3 rodadas de teste**, cada uma cobrindo um grupo de subetapas (por exemplo, 4a–4c e depois 4d–4f). Cada subetapa tem o próprio commit. Ao fim de cada grupo, pedir que o usuário teste, e só seguir para o próximo grupo depois da aprovação dele.
- **Ao terminar uma etapa (regra obrigatória, pedida pelo usuário em 2026-10-01; não esperar que ele peça):**
  1. **Anotar as lições aprendidas** numa seção "Lições da etapa N" em `docs/licoes.md` (e uma linha no índice das notas técnicas): os bugs que apareceram e a causa, o que travou, como testar aquele sistema, armadilhas do código e da máquina, o que mediu caro. É a base para as próximas sessões resolverem problemas mais rápido.
  2. **Reler o documento inteiro** e corrigir o que ficou desatualizado pelas decisões da sessão atual ou de sessões anteriores (resumo, estado de testes, roteiro, perguntas em aberto, bugs já corrigidos, nomes de funções que mudaram). Refinar o texto onde estiver confuso.
  3. Atualizar "Estado atual" e o "Roteiro", e fazer um commit no Git.
- **Testar de verdade:** abrir o jogo no navegador do app com `preview_start` (configuração `claude-dev`, porta 5180, em `.claude/launch.json`) para ver funcionando, em vez de só checar a sintaxe. Rodar `npm run build`, que também checa os tipos. Medir com `bench` antes e depois de mudanças no render. Veja "Como testar no navegador do app".
- **Som:** o Claude não ouve o áudio. Ao criar ou mudar sons, dizer ao usuário que o teste de ouvido é dele, e descrever o que esperar.
- **Depois do retorno do usuário, seguir sem pedir confirmação (regra pedida pelo usuário em 2026-10-01):** quando ele dá o retorno de um grupo e pede ajustes, fazer os ajustes e **seguir direto para o próximo grupo**, sem parar para pedir que ele confirme os ajustes. Se algo nos ajustes não agradou, ele diz no retorno seguinte. Só parar antes de seguir se ele pedir explicitamente para ver o resultado primeiro. No fim do próximo grupo, pedir o retorno normalmente (cobrindo também os ajustes).
- **Quando o usuário pede para seguir sozinho** ("não precisa pedir teste"), continuar pelos grupos seguintes e juntar o teste no fim. Sem isso, vale a regra dos testes agrupados.
- **Explicar ao usuário como rodar:** o comando do servidor de desenvolvimento, e de preferência um atalho `.bat` para iniciar com duplo clique.
- **Arquivos internos do notebook (aviso do usuário, 2026-10-02):** o shell do notebook (`src/laptop/shell.ts`) tem muito código de hacking. Fora do Opus 4.8, ler e editar só os trechos necessários, com cuidado. Se isso começar a dar problema (o classificador travando), pedir ao Opus 4.8 um **arquivo de mapeamento** com as linhas sensíveis de cada arquivo, atualizado (com as linhas recalculadas) toda vez que um desses arquivos for editado.
- **Electron (desde a R.37):** o Claude continua testando no Vite (`claude-dev`, recarga na hora); o usuário testa os retornos pelo `jogar-electron.bat` (tela cheia, resolução fixa, build em segundos). Para conferir o Electron sem abrir janela: `TC_CHECK=1 npx electron electron/main.cjs` (depois de `npm run build`) imprime se o isolamento e o WebGPU funcionam. O `.exe` só é gerado para mandar a amigos, ao fechar uma etapa.
- **Contexto da conversa (pedido em 2026-10-02; reforçado em 2026-10-03, depois de o Claude não avisar):** este documento sozinho já é grande e é lido em toda sessão. Ler só os trechos da etapa atual. **Ao fechar cada subetapa, avaliar o tamanho da conversa e, se já houve duas ou mais subetapas ou muitas leituras grandes, dizer ao usuário com todas as letras que é hora de abrir um chat novo** (o documento já fica atualizado no commit). Não esperar que ele perceba.
- **Limpar o documento ao fim de cada subetapa (pedido do usuário em 2026-10-02):** junto com o Histórico, tirar do CLAUDE.md o que a subetapa atendeu ou tornou irrelevante (pedidos feitos, filas já organizadas, "esperando teste" já aprovado, planos já cumpridos) e levar o texto para `docs/historico.md` ("Pedidos atendidos", no topo). Aqui fica só o que ainda está aberto, em "Plano: etapas 13 a 22". O que está no Git e no Histórico não precisa estar aqui.
- **O Claude abre o navegador sozinho (regra do usuário em 2026-10-03; substitui o aviso de 2026-10-02):** o laço do jogo só roda com o painel do navegador do app visível. Antes de medir ou testar, o Claude abre o painel ele mesmo (`preview_start` com `claude-dev`) e confere com `tabs_context` se está visível. Só pede ajuda ao usuário se o painel continuar oculto (o `world.tick` não sobe), em vez de lembrá-lo sempre.
- **Log de atualizações (pedido em 2026-10-02):** fica em `CHANGELOG.md` (fora daqui para não pesar no contexto de toda sessão). Cada subetapa com commit ganha uma linha de patch notes na versão da etapa (versão `0.ETAPA.SUB`, por exemplo `0.12.4`), escrita para quem joga. Entradas da Trilha de hacking são escritas por uma sessão com o Opus 4.8; fora dela, só "(entrada da Trilha de hacking)".

## Roteiro

A ordem segue a evolução do ASCII City até o Update 4, porque cada etapa depende da anterior. Depois vêm as camadas próprias deste jogo.

1. ✅ **Motor:** Git, Vite + TypeScript, grade de ~180×80 caracteres, raycaster com perspectiva correta, câmera suave (o mouse move um alvo que a câmera segue), sem tremor, desenho final via WebGL com atlas de glifos. Simulação separada da renderização desde o início.
2. ✅ **Cidade grande:** mundo enorme com uma janela deslizante em volta do jogador, prédios com identidade fixa pela posição, horizonte distante barato, prédios altos visíveis atrás de outros.
3. ✅ **Estrutura e variedade da cidade:**
   - setores, distritos e quarteirões com nomes;
   - tipos de distrito que mudam a geração (centro financeiro, comercial, residencial, histórico, industrial com pátios ferroviários; sem porto, porque não há água);
   - **estilos de fachada** por tipo de distrito: torre de vidro, prédio histórico ornamentado, tijolo, residencial, galpão (referências 18, 19 e 22);
   - variedade de forma: topos de torre, pontas, cúpulas;
   - parques variados e marcos da cidade (referências 17, 20, 21 e 26);
   - a borda: zona de fogo subterrâneo com o cordão (veja as decisões). Nesta etapa, a geometria e o visual do horizonte; o medidor de CO e as patrulhas vêm depois;
   - nomes em inglês já lidos de um arquivo de locale.
4. ✅ **Visual sólido:** fundo colorido atrás dos glifos (alternável) e paleta final. Objetos pseudo-volumétricos montados com várias faces (carros, árvores, bancos, postes, cabines) no lugar dos billboards atuais. Entulho e mobiliário urbano espalhados. Letreiros nas fachadas com luzes que piscam e fazem efeitos. Base da iluminação dinâmica (postes que iluminam o que passa perto).
5. ✅ **Clima e céu** (o grupo 5.1–5.3 trouxe antes a avenida diagonal, as placas perpendiculares e os holofotes de fachada): chuva (fraca e forte), neve e outros efeitos atmosféricos, com partículas que caem e **batem no chão** (respingos na chuva, marcas ou acúmulo na neve). Lua com **fases** visíveis no céu. O horizonte atual agradou ao usuário e deve ser mantido. Curvatura leve do horizonte e a megaestrutura da zona de fogo, visível só perto da borda (veja as inspirações).
5b. ✅ **Rede elétrica e blackout** (veja "Design: rede elétrica e blackout" em `docs/historico.md`): subestações na simulação, prédios, postes e letreiros ligados a elas, apagão e volta progressivos com som, luar iluminando a cidade apagada. Acionado por uma tecla de debug até o hacking existir.
6. ✅ **Interiores** *(feita em 2026-09-30 e 2026-10-01, grupos A–F; testada pelo usuário, que tem opiniões para a etapa 20; os bugs estão em "Bugs conhecidos")* (trocada com o trânsito a pedido do usuário em 2026-09-30: dá exploração e gameplay já, e permite medir cedo o custo de ter interiores na cidade inteira). Todos os prédios devem ter interior, inclusive os cortados pela diagonal.
   - **Decidir no início:** interiores no mesmo espaço físico da cidade (o pedido original: atravessar a porta, sem carregamento nem teleporte) ou com carregamento, conforme o desempenho medido; e se a câmera 3D de verdade entra agora.
   - Cômodos coloridos vistos de fora pelas janelas (referência 16), janelas que mostram a cidade real, andares altos com vista de cima, vitrines com o interior das lojas.
   - Elevadores que sobem de verdade, alguns com vidro. Escadas de incêndio em que se sobe.
   - As janelas iluminando a fachada (como os letreiros), a chuva abafada do lado de dentro e a luz interna ligada à rede elétrica.
   - Veja "Preparação da etapa 6" no Estado atual.
7. ✅ **Trânsito** *(feita em 2026-10-01, grupos A, B e C; veja o Histórico)*: avenidas, coletoras e calçadões; semáforos; filas; tipos de veículo; ciclistas; pedestres. Sem carros voadores, porque não combinam com 2008. Criar aqui a fila de eventos da simulação (batidas, engarrafamentos, e também os apagões da rede elétrica). Carros na avenida diagonal, semáforos ligados à rede elétrica, e o conserto das calçadas da diagonal (veja "Bugs conhecidos").
8. ✅ **Navegação** *(feita em 2026-10-01, grupos A, B e C; veja "Etapa 8" no Histórico)*: o celular como painel diegético com terminal progressivo, mapas em 4 níveis e de interior, marcos, os limites do GPS de 2008, e a grade de apps com os que não dependem da rede funcionando. (O passeio automático e o modo cidade vazia do ASCII City saíram: o usuário não quer no nosso jogo, decidido em 2026-10-01.)
9. ✅ **Rede de telefones e celular** *(feita em 2026-10-01; veja 9.1–9.11 no Histórico)*: orelhões; antenas e sinal (a barra "Yx" do celular passa a mostrar o sinal de verdade); loja de apps; discador, SMS e câmera funcionando (as telas já existem desde a 8.7); os limites do hardware valendo; a abertura do jogo. O celular como objeto na mão já existe (etapa 8). Veja "Design: celular e apps". Também os pedidos do começo da etapa: o celular subindo para digitar, o botão do meio do mouse, as teclas clicáveis, o plano de dados com franquia e vários modelos de aparelho (veja "Pedidos atendidos" em `docs/historico.md`).
9b. ✅ **Luz do sol** *(2026-10-01; aprovada pelo usuário)*: faces ao sol e na sombra, chão, telhados, objetos e Sarcófago de dia; superfícies grandes e distantes em blocos; opção de resolução.
10. ✅ **Notebook e primeiro hacking** *(grupos A, B e C feitos em 2026-10-01/02; depois, na mesma etapa, BIOS, bateria e editor, os workers do render, a interface em camada própria e a direção sem trilhos: veja 10.1–10.10 no Histórico. O que sobrou é da Trilha de hacking.)*: o notebook como objeto, o computador virtual, a rede do notebook, e os primeiros alvos (subestação e semáforos, por `tnet`). **Trilha de hacking, feito em 2026-10-02 (10.11), fechando a etapa 10:** os pacotes materializados (`sim/packets.ts`, o `tdump` lê deles), o 502/modbus com função (`mbus`) e a senha da BIOS. O modelo completo de pacotes de "Design: pacotes de rede simulados" (captura em qualquer rede/serviço, passo ajustável) fica para a etapa 14.
11. ✅ **Cidadãos e rotinas** *(feita em 2026-10-02, grupos A, B e C; o C espera o teste do usuário; veja 11.1–11.4 no Histórico)*: casa, trabalho, relações e horários, com nível de detalhe da simulação; os pedestres são os cidadãos; ligações e SMS por engano; a primeira rede social (Streetwire).
12. **Web dinâmica** (a próxima etapa; reorganizado pelo usuário em 2026-10-02: a web é quase uma etapa por si só e aproveita a base que já existe, cidadãos, empresas, eventos e o gerador de textos). Grupos sugeridos, a confirmar no começo:
   - ✅ **Grupo A, o celular redesenhado** (12.1): tela inicial, menu, discador, mensagens e mapa; modelos visuais e capinhas; apps de fábrica e a pasta; câmera em blocos; 60 mil pessoas.
   - ✅ **Antes do grupo B: 12.4–12.6** (celular, notebook, camada HD, sistema de arquivos do celular).
   - ✅ **Grupo B (12.7–12.13, aprovado em 2026-10-03):** câmeras de segurança e o modo CCTV, pedestres usando o celular, sons de ambiente (carros e sirenes distantes, o celular de quem passa), manchetes clicáveis com texto e foto, e o bug dos pedestres na diagonal (veja "Plano das próximas sessões").
   - **O que falta da web foi para a etapa 15** (renumerada em 2026-10-04).
13–22. **O que falta, renumerado em 2026-10-04:** veja "Plano: etapas 13 a 22" (13 Lugares e lojas, 14 Diálogo, 15 Web e celular, 16 NPCs usando a cidade, 17 Economia, 18 Transporte e carros, 19 Hacking completo, 20 Refinamento e variedade, 21 Sound design, 22 Vida do personagem). Os números antigos (12b, 12c, 13, 13b, 13c, 14, 15, 15b, 16) aparecem no histórico e em comentários do código com o sentido antigo.

### Trilha de hacking (criada em 2026-10-02)

Tudo que **se parece com cibersegurança** fica aqui, em sessões próprias, por causa do classificador de segurança (veja a regra no topo de "Estado atual"). **Regras da trilha:**
- No começo de uma sessão desta trilha, **avisar o usuário para trocar para o Opus 4.8** (menos safeguards) antes de prosseguir.
- **Fora da trilha, não abrir** os arquivos de hacking (`src/sim/network.ts`, os comandos `mmap`/`bruter`/`tdump`/`tnet` e `conn`/`remote` de `src/laptop/shell.ts`, o `util` de `src/sim/wifi.ts`) **nem ler** as entradas `[HACKING]` deste documento.
- **O que já foi feito na trilha:** a etapa 10 grupo C (10.6) e os pacotes/modbus/senha de BIOS (10.11); no celular, os códigos secretos (9.4) e o Wi-Fi do aparelho (9.3/bugfix) — já no disco, não remexer sem necessidade. **Com a 10.11, a etapa 10 está fechada por inteiro.** **F.1 (2026-10-03):** o contratante por SMS, o estado do trabalho conferido pela rede elétrica, o pagamento no banco (`sim/jobs.ts`, `locale/jobs.ts`). **F.2 (2026-10-03):** o calor por rastros, a polícia em escada e a prisão sem game over (`sim/heat.ts`), com as notícias e o Streetwire reagindo (eventos `manhunt`/`bust`).
- **F.3 (2026-10-03):** o tutorial dentro do notebook (`src/locale/laptop.en.json` → `home["start-here.txt"]`) e o comando `job` (builtin em `src/laptop/shell.ts`, lê `world.jobs`), que mostra o contrato em que o jogador está.
- **F.4b (2026-10-03):** o trabalho 2, travar um cruzamento de semáforos dentro de uma janela de 1–2 h (`sim/jobs.ts` virou dois tipos pela mesma estrutura; `setSignals` em `sim/network.ts` passou a deixar rastro como `setBreaker`; textos em `locale/jobs.ts`; o `job` do shell descreve os dois tipos). Ver historico.md.
- **F.5 (2026-10-03):** o trabalho 3, seguir uma linha (autocontido, só antena). `JobKind` ganhou `'trace'` (`sim/jobs.ts`), o alvo é resolvido na oferta (`resolveTrace`, hora recente), `answerTrace` confere a resposta por SMS; o OMC da operadora é o alvo (`HostKind 'omc'`, host `omc-r`, `cellLog` em `sim/network.ts`; o AP `omc` em `wifi.ts`, SSID `<Operadora>-OMC`); `mastNear` passou a ser exportado de `telco.ts` e é compartilhado. O comando `log <número>` do console remoto e o gancho de resposta no celular (`parseDistrict` em `phone.ts`). Ver historico.md. **Decisão aberta:** puxar o log não gera calor por ora (leitura passiva) — dá para ligar depois.
- **F.10 (proposta, a próxima da trilha):** o SMS de balanço depois do serviço (o que a cidade sabe: "a câmera da 5th com a 12th te pegou"); conferir se os trabalhos se renovam depois do terceiro (se não, repetir os três tipos com alvos novos e pagamento subindo com a reputação).
- **Batidas → calor (decidido pelo usuário em 2026-10-03: NÃO ligar por hora; revisitar):** só somaria calor por batida que o jogador claramente causou, nunca pelas batidas de fundo (`traffic.ts` + `heat.ts`).
- **O que falta na trilha:** a intrusão da rede social (etapa 15); o banco e os sistemas das empresas (17); a etapa 19 inteira (que amplia os pacotes do `tdump` para o modelo completo de "Design: pacotes de rede simulados" — hoje a 10.11 já materializa os pacotes, mas de forma mais enxuta —, instala as ferramentas por cabo e traz o Wi-Fi dos cybercafés); e as câmeras invadidas do "Modo CCTV" (Ideias futuras), se virarem jogabilidade.
- **Missões com prazo longo (pedido do usuário em 2026-10-04):** as missões, sobretudo as primeiras, dão de 18 h a 1 dia de jogo, para o jogador cuidar de outras coisas, apreciar a cidade ou aprender a hackear (prazos e janelas em `sim/jobs.ts`).
- **A reputação presa ao número (decidido em 2026-10-04; veja "O jogador é o número dele"):** trocar o chip zera não só o calor mas também a reputação com o contratante (trabalhos melhores, pagamento maior); o fórum de trabalhos, se vier, entra pelo número com SMS de confirmação.
- **Bugs/pedidos `[HACKING]` do retorno de 2026-10-03 (para a sessão de correções da trilha, Opus 4.8):**
  - **No `tnet`, preso no prompt de login:** quem não sabe o login não consegue sair — Ctrl+C e `exit`/`quit` não funcionam no estágio login/senha de `conn` (`remote()` em `shell.ts`). Deixar Ctrl+C e `exit` fecharem a conexão também antes do shell.
  - **O notebook não desconecta da subestação pela distância:** ao se afastar da antena de manutenção, a placa (`Shell.net`) devia cair pelo sinal; o usuário viu que não cai sozinha. Conferir o reateamento por posição real (lição da 10.x diz que deveria cair).
  - **(etapa 19) Flag de nomes reais:** uma flag que troca os nomes fictícios dos comandos/programas pelos reais, com uma versão fictícia para ligar/desligar conforme o contexto.
  - **(etapa 19) `tdump` contínuo:** capturar pacotes continuamente até o usuário segurar Ctrl+C, em vez de uma janela fixa.

R. ✅ **Render na GPU (WebGPU)** *(R.1–R.28, 2026-10-02/03; detalhes em `docs/historico.md`)*: o mundo inteiro desenhado num compute shader, um raio 3D por célula (a câmera 3D de verdade), sem o render da CPU (apagado na R.17); depois a luz nova (sol e sombras, emissão e bloom, materiais, reflexos). **O que sobra está na "Lista fixa: retoques de luz"** do Plano.

**Correção de bugs e otimização:** feita em 2026-10-01 (duas partes) e na etapa R (a queda de FPS era o render da CPU); os bugs abertos estão nas listas fixas do Plano e em "Bugs conhecidos".

**O sistema de notícias com telões** entra na etapa 15 (portal de notícias).

**Transversal, em todas as etapas: som.** O retorno sonoro é prioridade do usuário e não pode ficar para o fim. Cada etapa traz os sons do que cria:
- chuva, trovão e blackout na etapa 5 (feitos; falta o vento);
- portas, passos e ambiente interno na 6;
- motores e buzinas na 7;
- teclas do celular, boot, tons DTMF e chamada falhando na 8 (feitos);
- toques de chamada, tons de ligação, voz sem palavras, SMS, moedas e orelhões, obturador e a abertura na 9 (feitos).

O módulo de áudio já existe (`src/audio/`, Web Audio, tudo sintetizado, sem arquivos).

## Perguntas em aberto

Consolidadas aqui para não se perderem. Pergunte ao usuário quando a etapa correspondente chegar.
- **Etapa 5 (respondido em 2026-09-30, implementado na 5.5):** um dia do jogo dura **48 minutos reais**, como no GTA IV, mas numa variável fácil de mudar. O jogador **pode dormir e pular o tempo**.
- **Etapa 6 (respondido em 2026-09-30):** interiores no espaço físico; câmera 3D depois; começar por residencial e escritório.
- **Etapa 8 (respondido em 2026-10-01):** o painel é o celular, não pausa, GPS exato primeiro e os limites de 2008 no grupo 8C.
- **Etapa 18 (transporte):** o usuário ainda não sabe se quer transporte aéreo. Se houver, será um helicóptero de passeio, e não um táxi aéreo.

## Ideias futuras (não decididas)

- **Modo CCTV (pedido do usuário em 2026-10-01; o ASCII City tem algo parecido, e a regra de originalidade vale: a técnica sim, o visual e os nomes não):** uma opção na tela de título ao lado de "ENTER THE CITY": a vista de uma câmera de vigilância presa num poste, girando devagar de um lado para o outro, com efeito de tela de CCTV (linhas de varredura, ruído, data e hora e o nome da câmera no canto, talvez em preto e branco ou monocromático), trocando de câmera de tempos em tempos. Combina com o hacking: as câmeras podem ser objetos da simulação, e o mesmo efeito serve depois para o jogador ver câmeras invadidas no notebook. O modo CCTV da tela de título em si (sem invasão) é visual e pode ser feito em sessão normal; as **câmeras invadidas** são `[HACKING]` (Trilha de hacking).
- Rede da cidade como dado do jogo: nós (telefones, câmeras, semáforos, prédios) com endereços e níveis de acesso.
- Notebook do hacker como objeto físico no jogo, com teclado, tela de terminal e sons.
- Transmissão ao vivo determinística (como o "ASCII City Live"): a mesma semente e a mesma hora mostram a mesma cena.

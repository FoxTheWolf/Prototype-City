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
> - **É uma caixa de entrada, não um lugar para guardar.** A cada sessão e a cada subetapa, ler os itens abaixo deste bloco, levar cada um para o lugar certo do documento ("Pedidos em aberto", o Roteiro, "Bugs conhecidos", "Como trabalhar" ou a Trilha de hacking) e **apagar daqui o que foi levado**. Fila vazia = tudo já organizado.
> - Itens marcados `[HACKING]` (ou que são só para o Opus 4.8) não são apagados nem resumidos: vão, com o texto inteiro, para a subseção "Feedback para o Opus 4.8" logo abaixo.
> - Ao terminar, dizer ao usuário em poucas linhas o que entra agora e o que fica para depois.
> - Aviso: O notebook contém bastante código relacionado a hacking na shell, então, tomar cuidado ao ler e editar os arquivos do sistema interno dele quando não for o Opus 4.8. Se isso começar a causar problemas, deixar aqui pra pedir ao Opus 4.8 para criar um arquivo separado de mapeamento que deve indicar quais as linhas potencialmente perigosas de se mexer fora do modelo Opus 4.8. Esse arquivo deve ser atualizado toda vez que um dos arquivos for editado, para recalculo do numero das linhas correspondentes.



*(fila vazia: organizada em 2026-10-02, veja "Pedidos em aberto")*

### Feedback para o Opus 4.8

> Itens que só uma sessão com o Opus 4.8 deve ler e organizar (os `[HACKING]`). As outras sessões **não leem esta subseção** e só acrescentam aqui, sem apagar. O Opus 4.8 organiza na Trilha de hacking e apaga daqui o que organizou.

- [HACKING] **O nome do sistema do notebook vem das empresas da cidade (pedido em 2026-10-02):** hoje "Osprey/UX" está fixo (aparece no boot: `Loading Osprey/UX 4.2 2.6.24-19`, `builder@osprey`). Deve sair de uma empresa de software que existe na simulação, como a marca do celular. O usuário pediu ao Opus 4.8 porque o nome mora no shell (`src/laptop/shell.ts`); avaliar antes se isso atrapalha o hacking (comandos, caminhos, banners que outros hosts mostram), e só fazer se não atrapalhar.
- [HACKING] Adicionar modo recovery para fazer root no celular. (Isso era uma coisa em 2008? Senão, usar uma alternativa. Eu imagino o celular como um hibrido de iphone com blackberry, mas com form factor de celular comum. Inclusive, mais pra frente, uma versão com form factor e teclado de blackberry pro celular seria prudente, e quem sabe uma versão flip igual o notebook). Seria necessário para instalar aplicações de hacking. *(A parte dos formatos BlackBerry e flip já foi para a etapa 15.)*


## Opiniões e sugestões do Claude (pedido do usuário em 2026-10-02)

> O usuário pediu opinião de verdade: criativa, de gameplay e de rumo, não só técnica. Esta seção é minha (do Claude), para ele considerar; nada aqui está decidido. Quando ele decidir algo, o item vai para "Decisões tomadas" ou para o Roteiro, e aqui fica marcado. Sessões futuras podem acrescentar opiniões, sempre datadas.

### O que eu acho do rumo (2026-10-02)

- **A cidade está ficando impressionante, e o jogo ainda não existe.** Já temos trânsito com física, 100 mil pessoas com rotina, rede elétrica, telefonia, Wi-Fi, câmeras, rede social, notícias. O que ainda não existe é um motivo para o jogador fazer alguma coisa numa noite qualquer. Meu maior medo pelo projeto é virar um simulador lindo em que se passeia e não se joga. **A minha sugestão mais forte: antes de mais largura (web inteira, economia completa), fazer uma "fatia vertical" de uma noite de trabalho**, do começo ao fim, com o que já existe: alguém pede um serviço → o jogador investiga → vai até o lugar → invade → a cidade reage → ele é pago (ou pego). Tudo o que vier depois fica mais fácil de decidir quando essa noite for divertida.
- **O realismo é a identidade do jogo, mas atrito só é bom quando vira decisão.** A partida a frio do GPS, a franquia de dados, a bateria do notebook, sentar para usar: tudo ótimo **se** em algum momento o jogador tiver que escolher por causa disso (ir pelo Wi-Fi do café e ser visto, ou pelo 3G caro e lento; comprar um receptor GPS melhor). Atrito que nunca vira escolha vira só espera. Sugiro sempre perguntar, para cada limite realista: "qual escolha ele cria?" e, se nenhuma, deixá-lo leve.
- **A cidade tem as mesmas ferramentas que o jogador — use isso contra ele.** É a ideia que mais me empolga. Câmeras, logs de telefone, posts com foto, testemunhas, registros de acesso Wi-Fi: o jogador usa tudo isso para hackear; a polícia (e quem ele prejudicou) deveria usar exatamente os mesmos dados para chegar nele. Isso transforma a simulação inteira em jogabilidade sem inventar nada: apagar o log, evitar a câmera da esquina, ligar do orelhão em vez do celular, não postar perto do crime, trocar de Wi-Fi. É o Shadows of Doubt ao contrário: você é o caso.

### Sugestões de jogabilidade

- **Trabalhos que nascem da simulação (o laço principal).** Um "contratante" (fixer) que liga para o orelhão ou manda SMS de número desconhecido, e mais tarde um fórum na web. Os pedidos saem do que existe: o dono de um bar quer o concorrente sem luz na sexta à noite; uma seguradora quer saber se um cidadão foi mesmo ao trabalho no dia do acidente (os dados de câmera e de antena dizem); alguém quer apagar uma multa; um jornalista quer a telemetria do Sarcófago. Pagamento em dinheiro do jogo → hardware melhor (notebook, antena direcional, celular com Wi-Fi melhor, receptor GPS) → alvos mais difíceis.
- **Calor (heat) e investigação.** Cada ação deixa rastros na simulação (log no roteador, você numa câmera, sua linha na antena, uma testemunha que postou). Um detetive/NPC da polícia junta os rastros com o tempo; a investigação aparece nas notícias e no Streetwire ("polícia procura homem de casaco perto da subestação"). O jogador vê o cerco se fechar pelos mesmos canais que usa.
- **A lenda urbana.** Se o jogador causa apagões repetidos, a cidade lhe dá um apelido no Streetwire e nas manchetes ("o Fantasma da Rede"), teorias, posts de fãs e de quem odeia. É feedback diegético de "reputação" e de graça para quem gosta de ver as consequências.
- **Conhecimento como progressão (estilo Hacknet/Outer Wilds).** Mais do que upgrades, o jogador progride por saber coisas: o código secreto do celular achado numa oficina, a senha num post-it de um escritório, a chave do Wi-Fi escrita no quadro do café, o horário em que o técnico loga. Um **mural de pistas** no apartamento (ou no notebook) para ligar fatos ajudaria muito.
- **Coisas físicas de 2008 que são ótimas de jogar:** fuçar o lixo atrás de um prédio (recibos, papéis com senhas); grampear um orelhão; ligar para um ramal e enganar a recepcionista (engenharia social com escolhas de fala, pelo sistema de diálogo da 13c); um cartão de crachá clonado; a impressora de rede de um escritório imprimindo coisas.
- **O apagão como ferramenta, não só como espetáculo.** Sem luz, as câmeras com bateria duram pouco, as portas magnéticas abrem (ou trancam, pelo modelo), o trânsito para, as testemunhas olham para o céu. Planejar um serviço em volta de um apagão programado deveria ser uma das jogadas mais satisfatórias do jogo.
- **Um mistério de fundo, pouco e bom.** As histórias emergentes carregam o jogo, mas um fio autoral discreto dá direção: o Sarcófago parado, a empresa que o construía, a agência da zona de fogo, a telemetria que ainda transmite. Pistas espalhadas nos sistemas (e-mails, manchetes antigas, logs) para quem quiser seguir, sem obrigar.
- **Uma estação de números** (rádio de ondas curtas lendo números à noite) é perfeita para o tom noir de 2008 e pode ser a porta do mistério.
- **O apartamento do jogador como base:** onde ele dorme (pular o tempo), carrega tudo, guarda hardware, e onde o mural de pistas fica. Um lugar que vai ficando "dele".

### Sugestões de rumo e ordem

- Depois do grupo B: **a fatia vertical de uma noite** (um contrato, investigação, invasão, reação, pagamento ou calor), antes da web completa e da economia completa. Ela vai mostrar quais partes da web e da economia são necessárias primeiro.
- **Salvar o jogo cedo.** Hoje nada persiste. O plano "semente + mudanças" está nas decisões; quanto antes existir, mais barato (cada sistema novo já nasce salvável).
- **Lugares com tipo de verdade** (o pedido do usuário sobre o Maps): concordo que é fundação. Um catálogo pequeno de tipos de lugar com interior coerente vale mais que muitos tipos sem interior.
- **Ritmo do tempo:** acho que o dia de 2 h está bom para jogar; com trabalhos, a noite vira o "turno" do jogador, e pular o dia dormindo resolve o resto.

### Opiniões técnicas (o usuário liberou em 2026-10-02: podem ser numerosas e longas, é onde o Claude mais ajuda)

- O render em workers aguentou bem o crescimento; o próximo gargalo é a simulação no thread principal (carros: ~1,9 ms por 1000 carros por passo). Se a cidade crescer, a simulação de trânsito é a primeira candidata a ir para um worker.
- Um **console de debug** dentro do jogo (teletransporte para um lugar, ver um cidadão, forçar um evento) economizaria muito tempo de teste dos dois lados.

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
- `28-v2-fachadas-arvore`: fachadas variadas de perto, com padrões ricos (`@ 8 # o`), letreiros e uma árvore grande (fachadas, etapa 15)
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
- **Delegar a outras IAs (combinado em 2026-10-02, para economizar o limite do usuário):** o usuário tem o Gemini (pago) e o ChatGPT (grátis). Delegar só o que não depende do código: textos da gramática (com um briefing do formato e das regras), pesquisa (referências de 2008, receitas de som) e segundas opiniões de arquitetura. Os briefings ficam em `docs/tarefas/`, um por tarefa, curtos (nunca o CLAUDE.md inteiro). O resultado volta para o Claude conferir (de preferência por script).
- **Toda frase do jogo pela gramática (pedido do usuário na 11.5):** com pesos de idade, gênero e contexto, para cada pessoa soar única. Vale para tudo o que vier (taxistas, posts, sites, notícias): **todo texto novo entra como peças em `locale/text/` e passa por `expand` com a `Sel` de quem fala.**
- **Os dados da simulação são a matéria do hacking:** registros de moradores e funcionários, logs de telefone, câmeras, controle de portas e semáforos vêm da simulação e não são inventados à parte.
- **Clima e céu (pedido em 2026-09-30):** o usuário quer chuva, garoa, neve e afins, com partículas que caem de verdade e respingam no chão, além das fases da lua. A divisão pretendida:
  - O *estado* do clima (se chove, a intensidade, o vento), a data e a hora ficam na simulação, com semente, porque um dia vão afetar as pessoas e o trânsito.
  - As partículas são só render.
- **Ciclo de dia e noite, com calendário (decidido em 2026-09-30, com ressalva de estética):** o usuário tende a querer, porque as rotinas dos cidadãos, as estações, a passagem do ano e as fases da lua dependem disso. A preocupação dele é o dia estragar o clima de hacker. Proposta para preservar a estética (a validar quando for implementada):
  - **A noite continua sendo o visual principal.** O dia é enevoado e nublado, com céu claro e dessaturado, glifos mais apagados e janelas e postes apagados. É o "visual de serviço". O entardecer e o amanhecer têm céu colorido e são os momentos bonitos da transição.
  - **O dia e a noite mudam o jogo, não só a cor.** De dia, as ruas ficam cheias, há mais testemunhas, os escritórios estão ocupados e o trânsito é pesado. De noite, os sistemas estão menos vigiados, há menos gente e os plantões são curtos. O hacker tem motivo para preferir a noite, mas o dia tem alvos próprios, como as rotinas e as pessoas no trabalho.
  - **Relógio e calendário na simulação:** hora, dia, estação e ano. A duração do dia varia com a estação, a lua segue o ciclo real de ~29,5 dias, e a probabilidade de chuva e neve depende da estação. **Decidido:** um dia dura 48 minutos reais e o jogador pode dormir e pular o tempo (feito na 5.5; o dia ainda é um visual provisório).

- **Decisões da etapa 4 (2026-09-30):**
  - **Paleta: sódio âmbar (escolhida pelo usuário em 2026-09-30,** depois de comparar com neon noir e verde terminal). As outras foram removidas.
  - **Fundo colorido:** o usuário gosta das duas versões, com e sem fundo. A tecla **B** passa por estágios: **0,24 da cor do glifo (o padrão, o "1/3" escolhido pelo usuário em 2026-10-01)**, 0,16, 0,08 e desligado (`SOLID` em `main.ts`). Antes era 0,36, que ele achou claro e sólido demais.
  - **Caracteres:** o usuário prefere **ASCII**, que é o padrão. Os blocos Unicode (`░▒▓█─│┌`) ficam como opção na tecla **U**, enquanto não atrapalharem o desenvolvimento.
  - **Som:** o módulo de áudio (Web Audio, sintetizado, sem arquivos) nasce na etapa 4, com os sons de ambiente: zumbido de neon que falha junto com o letreiro, zumbido de poste de sódio, cidade distante e tom grave perto da zona de fogo.

## Pedidos em aberto (consolidado em 2026-10-02)

> Só o que **ainda não foi feito**. Ao fechar uma subetapa, o que ela atendeu sai daqui e vai para `docs/historico.md` ("Pedidos atendidos"). O texto original dos pedidos antigos está lá.

- **Etapa R (agora):** render do mundo na GPU (veja a etapa R no Roteiro e a medição abaixo).
- **Logo depois, Maps com categorias e rotas:** os marcos viram uma categoria; as outras listam os lugares por tipo (cafés, restaurantes, bares, farmácias, mercados…), do mais perto; escolher um traça a rota até ele. O mapa ganha um modo escuro.
- **Fundação a planejar com o usuário: tipos de lugar com interior coerente** e **prédios modulares** (antes da economia, 13). O que o Maps mostra é o que o letreiro diz e é o que o interior é, e depois os produtos que a loja vende; o cybercafé precisa existir como tipo (hoje só há cafés com Wi-Fi); o cinema fica para depois. Cada cômodo com um uso definido pela simulação (o escritório de uma empresa, o apartamento de uma família), planta e móveis seguindo o uso; mais escritórios perto do centro, e a renda dos moradores segue o lugar. Liga com `homeUnit` (ainda não existe) em `sim/citizens.ts` e com `furnish` em `sim/interior.ts`.
- **Fatia vertical de uma noite de trabalho** (aprovada em princípio): separar o que é sessão normal (contratante, pagamento, calor, polícia, notícias) do que é Trilha de hacking, e avisar quando for prudente usar o Opus 4.8. **Polícia que escala** (aceito): primeiro só testemunhas e a viatura que passa; depois câmeras da rua e registros do lugar; no topo ("caso federal"), logs de telefone, antenas, Wi-Fi e posts.
- **Câmeras:** confirmar com o usuário se as câmeras 3D de hoje (poste e fachada, até 140 m) bastam, ou se faltam dentro das lojas, mais longe, mais visíveis.
- **Rede social:** espaçar posts com o mesmo motivo (ele viu três ou quatro seguidos de gente dizendo que precisa acordar às seis). Guardar os assuntos recentes em `sim/social.ts` e evitar repeti-los por um tempo.
- **Bug: semáforo no meio da rua no X do theater district.** E repensar o triângulo da diagonal: um quarteirão comum na essência (com calçada própria), ou um prédio estilo Flatiron com uma pracinha e uma praça de pedestres do lado. Decidir com o usuário.
- **Interiores:** pessoas dentro dos prédios; interior falso nas janelas (*interior mapping*, por tipo de prédio) para os prédios distantes e enquanto os móveis não aparecem de fora.
- **Etapa 13 (economia):** sistema de ações (bolsa), com app e site; banco de dados de empresas, cada uma com endereço físico e escritório do tipo certo; os fabricantes da cidade dão a marca dos celulares **e dos chips** de dentro (CPU, rádio); comprar pacote de dados com dinheiro de verdade.
- **Celular e notebook juntos:** o celular como modem/hotspot do notebook (tethering) e talvez um cartão SD compartilhado (etapa 14; o cabo USB já existe, 12.6).
- **Relógio de pulso** (estilo Casio, um pouco mais moderno): hora, data, temperatura, alarme e luz, sem tirar o celular (12b, 15 ou antes se pedido).
- **Visual:** estender o modo de blocos às paredes e aos objetos cúbicos (rever a intensidade com o usuário, talvez um estágio novo).
- **Etapa 15 (variedade):** fachadas mais complexas (cornijas em vários níveis, arcos, pilastras, bases diferentes do corpo, coroas; referências 28–30 e 32); muito mais letreiros e publicidade (referências 34 e 35), outdoors de empresas e produtos que existem e que mudam com a simulação (liquidação, lançamento, falência e outdoor rasgado); topos e coroas acesos à noite (referência 36); contornos de neon e faixas acesas; distrito estilo Times Square; detalhes nos telhados de perto, *greebles* nas fachadas e topos; chaminés industriais com fumaça; cabine telefônica fechada (referência 23, protege da chuva) ao lado do orelhão atual; mais modelos de celular e capinhas, com variações de cor; formatos BlackBerry e flip; uma passada nos ícones (glifos desenhados no atlas, como os de `SHAPE`).
- **Sombras:** a luz do sol existe (9b); falta o mapa de sombras (prédios fazendo sombra uns nos outros e no chão). Veja "Para avaliar" no Roteiro.

### R.1, primeira medição (2026-10-02, máquina do Claude, 16 threads, 6 workers, theater district, girando 0,03 rad por quadro)

| Linhas | Grade | Worker mais lento (mediana) | Quadro do mundo, mediana / p95 | Thread principal por quadro |
|---|---|---|---|---|
| 120 | 356×120 | 4,6 ms | 5,1 / 6,9 ms | 0,46 ms |
| 160 | 475×160 | 6,3 ms | 7,0 / 9,7 ms | 0,49 ms |
| 200 | 594×200 | 8,0–9,0 ms | 8,6–9,7 / 11,7–13,6 ms | 0,50–0,59 ms |

- O custo cresce quase linear com as células, e o desequilíbrio entre os workers é ~1,2× (o mais lento contra a média).
- **Aqui, 200 linhas dão ~110 quadros do mundo por segundo.** O "quase injogável" do usuário deve vir de outra coisa: (a) a CPU dele ter menos núcleos (os workers disputam com o thread principal e a simulação, ~3,6 ms por passo no pico); (b) **judder**: o mundo a ~90–110 quadros por segundo num monitor de 180 Hz é mostrado num ritmo irregular (2, 1, 2 atualizações por quadro), o que se vê como engasgo mesmo com FPS alto, e o pipeline soma um quadro de atraso. A GPU resolve as duas coisas (o mundo desenhado no mesmo quadro, em <1 ms).
- **No PC do usuário (2026-10-02):** o FPS fica travado em 180 a 200 linhas, mas o `DRAW` passa de 70 ms às vezes, principalmente ao girar a câmera e ao andar, e a imagem engasga muito; o FPS não muda quando o `DRAW` sobe. Ou seja, o laço da tela segue a 180 Hz enquanto o mundo chega atrasado e irregular dos workers (um worker atrasado segura o quadro inteiro). É o motivo de seguir para a GPU (R.2).
- O laço do jogo não roda com o painel do navegador oculto: para medir o jogo de verdade, **pedir ao usuário que deixe o navegador do app aberto** (veja "Como trabalhar"). `lookNow()` dá o `look` atual no console.


### R.2, o protótipo na GPU (2026-10-02, máquina do Claude, mesma sessão, 594×200, girando 0,03 rad por quadro)

`src/render/gpu/world.ts` (`GpuWorld`, tecla **J**, `gpuNow()` no console): a cidade sobe uma vez como listas (limites das ruas, quarteirões, prédios); um compute shader lança **um raio 3D por célula** pela mesma grade de ruas da CPU (caixas, cilindros e cortes da diagonal, telhados, curvatura) e faz o chão (ruas, faixas, calçadas, praças, parques), as fachadas com janelas acesas pelo mesmo `hash3`, e o céu. As células voltam para a grade do mundo (`mapAsync`) e o compositor de hoje desenha (um quadro de atraso, como os workers). Ainda **sem** luzes, objetos, carros, pessoas, letreiros, interiores, nuvens, chuva nem os estilos de fachada.

| | Quadro do mundo, mediana / p95 / pior | Quadros do mundo por segundo (tela a 180) |
|---|---|---|
| 6 workers (CPU, completo) | 7,5 / 10,7 / 16,9 ms | 77 |
| GPU R.2 (incompleto, contando a volta para a CPU) | 3,1 / 4,1 / 4,7 ms | 164 |

- O tempo da GPU inclui mandar, esperar e ler de volta ~1 MB; o cálculo em si é menor. Quando o compositor também estiver na GPU, a volta some e o mundo sai no mesmo quadro da tela (sem o *judder* nem o quadro de atraso).
- O que falta pesa na GPU muito menos que na CPU (é o mesmo trabalho por célula, em milhares de núcleos); o risco está no volume de código a portar, não no desempenho.

### R.3, o compositor na GPU (2026-10-02, máquina do Claude, 594×200, girando)

`GpuCompositor` (`src/render/gpu/compositor.ts`) é o `glRenderer.ts` em WGSL, num canvas próprio por cima do WebGL (`pointer-events: none`, os cliques continuam indo para o canvas de baixo). Num só envio: o compute do mundo e a composição (mundo lido direto do buffer, HD, tela do notebook, interface). O modo CCTV e a abertura ainda passam pela CPU. **Medido:** 180 quadros do mundo por segundo com a tela a 180 (antes, 77 com os workers e 164 no R.2); a GPU termina o quadro em ~3 ms (pelo `onSubmittedWorkDone`, que conta também a espera). No PC do usuário, o R.2 já "diminuiu muito" os engasgos sem acabar com eles; o que sobrar agora deve estar no thread principal (a simulação, ~3,6 ms por passo no pico, e vários passos num quadro depois de um atraso), a medir lá.

**Faltando no modo GPU:** `VIEW_LIGHT`/`VIEW_GLINT` não são atualizados (a luz no celular e no notebook fica parada), e os modos visuais B/U/V/G só aplicam o fundo sólido.

## Agradecimentos (easter eggs)

Pedido do usuário em 2026-10-01: amigos dele que aparecem no jogo como agradecimento. **Cada nome aparece exatamente uma vez em toda cidade gerada, num lugar diferente conforme a semente:** numa semente é o nome de uma empresa, em outra um cidadão, uma rua, um marco, uma manchete, um contato no celular etc. A escolha do lugar sai da semente (determinística). Os nomes são escritos exatamente como abaixo, sem tradução.

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
- **Etapa 12b (transporte):** táxi, que liga para a central, e horários do monotrilho, com os horários reais dos trens.
- **Etapa 12:** rede social.
- **Etapa 13:** banco, com o saldo real; notícias; tocador de música.

**Apps de hacker não estão na loja.** São instalados por fora, pelo cabo do notebook (um "desbloqueio", como o jailbreak da época). Exemplos: scanner de Wi-Fi, farejador de Bluetooth e captura de pacotes, todos limitados pelo hardware fraco do celular. O notebook continua sendo a ferramenta principal.

**Os celulares dos cidadãos também existem:** modelo, apps instalados, contatos e mensagens são dados hackeáveis. Um app falso publicado na loja pode se espalhar pelos celulares da população, o que é um impacto sistêmico.

## Estado atual

### Resumo para começar uma sessão (atualizado em 2026-10-02)

> **⚠️ LEIA ISTO PRIMEIRO — regra do classificador de segurança.** Qualquer coisa que **se pareça com cibersegurança** (hacking, redes, portas, varredura, senhas, captura de pacotes, invasão, consoles remotos), mesmo no contexto de game dev, **pode ser bloqueada pelo classificador de segurança** no meio da resposta. O **Sonnet 5.5** bloqueou; o **Opus 4.8** (menos safeguards) fez sem bloqueio. Por isso:
> - **Esse trabalho é separado numa trilha própria** (veja "Trilha de hacking" no Roteiro). Ao começar uma sessão dessa trilha, **avise o usuário para trocar para o Opus 4.8 antes de prosseguir.**
> - **Quando a etapa atual NÃO for de hacking, não abra os arquivos de hacking nem leia as entradas de hacking** deste documento. Só de ter esse conteúdo na resposta pode disparar o classificador e travar o trabalho. **Arquivos de hacking:** `src/sim/network.ts`, `src/sim/packets.ts`, a parte de hacking de `src/laptop/shell.ts` (os comandos `mmap`/`bruter`/`tdump`/`tnet`/`mbus` e a sessão remota `conn`/`remote`), o campo `util` de `src/sim/wifi.ts`, e o manual `docs/manual-hacking.html`/`.pdf`. **Seções deste doc marcadas `[HACKING]`:** a 10.6 no Histórico, as "Lições da etapa 10", "Design: pacotes de rede simulados", os itens `[HACKING]` do Roteiro e a subseção "Feedback para o Opus 4.8" (na seção de feedback).
> - Se, mesmo fora de uma etapa de hacking, você **precisar** mexer num desses arquivos (um bug de build, por exemplo), avise o usuário e peça para ele confirmar o modelo antes.

- **Agora (2026-10-02): o grupo B da etapa 12 está feito (12.7–12.13), esperando o teste do usuário.** Câmeras e modo CCTV, pedestres usando o celular, sons distantes, manchetes clicáveis com foto, pedestres na diagonal, e os ajustes do feedback (12.11). **Agora: a etapa R (render do mundo na GPU),** depois o Maps com categorias e rotas (veja "Pedidos em aberto") e a conversa com o usuário sobre a seção "Opiniões e sugestões do Claude" (a fatia vertical de uma noite de trabalho). População de 100 mil e 2000 carros no pico.
- **Etapas 1 a 9 (e 5b) concluídas.** A 9 (rede de telefones e celular) fechou em 2026-10-01: o grupo A foi testado e ajustado (9.4); B e C foram feitos sem rodada de teste, a pedido do usuário ("pode prosseguir, não precisa pedir meu feedback de novo"), então **o retorno dele sobre ligações, SMS, orelhões, câmera, loja e abertura pode chegar no começo da próxima sessão.** O que ele achou de errado nas etapas 6–9 está em "Bugs conhecidos", "Refinamento: anotações" e "Pedidos em aberto". A nota "perguntar sobre a etapa 6" é para o **começo da etapa 15**.
- **Em andamento: a etapa de bugfix e otimização.** A primeira parte foi feita em 2026-10-01, com o Wi-Fi inicial e o T9; a segunda parte também (portas entre cômodos, chuva que invertia, reflexo do vidro, faixas da diagonal, pingos do andaime, cache de luz), junto com o **modo visual suave** (tecla V) e os ajustes do celular (veja o Histórico). O usuário aprovou (2026-10-01). O que sobrou da triagem está em "Bugs conhecidos".
- **9b, luz do sol (2026-10-01, antes da 10, a pedido do usuário):** feita e aprovada; os pendentes anotados por ele (letreiros, interface desatrelada da resolução, mais colunas) estão no Histórico.
- **Etapa 10 (notebook e primeiro hacking) concluída (grupos A, B e C), 2026-10-01/02.** A (notebook), B (a rede do notebook) e C (os primeiros alvos de hacking: `mmap`/`tdump`/`bruter`/`tnet`, subestação e semáforos) feitas; detalhes na 10.1–10.6 (a 10.6 é `[HACKING]`). **O retorno do usuário sobre o grupo C pode chegar no começo da próxima sessão** (foi feito sem rodada de teste).
- **Etapa 10 fechada por inteiro (2026-10-02).** O que faltava da trilha de hacking foi feito nesta sessão (10.11, com o Opus 4.8): os **pacotes de rede materializados**, o **502/modbus com função** (`mbus`) e a **senha da BIOS**. **O retorno do usuário sobre a 10.11 pode chegar no começo da próxima sessão.** Também foi feito, a pedido do usuário, um **manual fora do jogo** em `docs/manual-hacking.pdf` (fonte `docs/manual-hacking.html`): conceitos, as ferramentas do notebook e do celular, e tutoriais passo a passo.
  - **Feito em 2026-10-02 (sessão normal):** BIOS SETUP, menu de boot, bateria e editor (10.7), os workers do render (10.8) e a interface numa camada própria (10.9). **O retorno do usuário sobre os três pode chegar no começo da próxima sessão.**
  - **Não é hacking:** a IA de direção sem trilhos foi feita na 10.10 (com setas, sinal de luz e dois faróis), testada e aprovada pelo usuário em 2026-10-02. **Do que não é hacking, a etapa 10 está fechada (2026-10-02).**
- **Etapa 11 (cidadãos, rotinas, Streetwire) e a 11.5 (gerador de textos) concluídas e aprovadas; a etapa 12 seguiu pelo celular (12.1–12.6, aprovadas) e pelo grupo B (12.7–12.13, esperando o teste).** População de 100 mil (`PEOPLE` em `sim/citizens.ts`). O roteiro foi reorganizado pelo usuário em 2026-10-02 (transporte é a 12b, carros dos cidadãos a 12c, animais na 15).
  - **`[HACKING]` Feito nesta sessão (10.11, Opus 4.8):** os **pacotes de rede materializados de verdade** (o `tdump` agora lê `sim/packets.ts`, com handshake WPA, perdas e retransmissões pelo dBm), o **502/modbus com função** (a ferramenta `mbus`, ler telemetria e escrever o coil do disjuntor sem senha) e a **senha da BIOS** (aba Security da SETUP, gate no POST). O que resta de rede/intrusão (etapas 12, 13 e 14) segue na Trilha de hacking.
- **Antes de começar qualquer etapa, leia as seções "Lições da etapa N"** nas notas técnicas: são o conhecimento acumulado das sessões anteriores (a 7 tem como testar a simulação sem o jogador; a 8, como testar o celular).
- **Rodar:** `iniciar.bat` ou `npm run dev` (porta 5173, a do usuário). O Claude usa a configuração `claude-dev` (5180) ou `vite-auto`. `?seed=42` fixa a cidade; `?mute` começa sem som; `?workers=N` escolhe quantos workers desenham o mundo (`?workers=0`: o thread principal, como antes). **Depois de mexer no `vite.config.ts`, reiniciar o servidor** (os cabeçalhos de isolamento só valem assim).
- **Teclas:**
  - jogo: WASD, mouse, Shift corre, Q/E (e as setas laterais) giram; **F** na frente de um orelhão tira o fone (e desliga); **N** tira o notebook onde dá para sentar ou apoiar, **Esc** fecha;
  - celular (como no GTA IV): **seta para cima**, **P** ou o **botão do meio** tiram; **P** ou o botão do meio abaixam (a tela e o estado ficam); na tela inicial, o botão do meio (ou a seta para cima) abre o discador; a seta para baixo na tela inicial limpa as notificações; no discador vazio, as setas escolhem uma chamada recente e a tecla verde liga; a tecla 1 tem os símbolos (`. , ? ! ' - @ _ : / & ( ) " # $ %`); com o notebook aberto, o celular continua clicável (o teclado vai para o notebook); com ele fora, o ponteiro do sistema fica livre e clica nas teclas (segurar o botão direito olha em volta; a roda anda pelo menu e pelas listas); com ele fora, setas = d-pad, Enter ou botão esquerdo = OK, Backspace ou botão direito = Voltar (na tela inicial, guarda), dígitos = teclado, + = \*, − ou . = #, **Space** = tecla verde (abre o discador, liga), **Delete** = tecla vermelha (volta à tela inicial); no menu (grade 4×4), 1–9 e 0 abrem os dez primeiros apps; na câmera, setas para cima e para baixo dão zoom, esquerda liga e desliga o flash; no relógio, as setas acertam o alarme e 1 liga e desliga; no mapa, 1–4, \*/# ou a roda do mouse = zoom, OK = lista de lugares (ou centralizar);
  - visual: **B** fundo sólido (4 estágios), **U** glifos de bloco, **V** quanto os glifos aparecem (SOFT, o padrão, SHARP, SHARPER, SHARPEST; veja o Histórico), **G** a fusão dos glifos distantes nos blocos contra o serrilhado (desligada por padrão), **J** o desenho do mundo: CPU, GPU, GPU com câmera 3D (etapa R; a GPU ainda sem objetos (nem placas perpendiculares e outdoors), carros, pessoas e interiores), **R** a resolução do mundo (80, 100, 120, 160 ou 200 linhas; 120 é o padrão com os workers, 100 sem; 160 e 200 são opcionais e custam na proporção das células; a interface não muda de tamanho, veja 10.9), **M** som;
  - interiores: entrar pela porta; subir de elevador (as escadas internas saíram por enquanto): mirar na botoeira e clicar (botão esquerdo); escadas de incêndio dos prédios de tijolo andando pela borda de fora do patamar;
  - debug: **T** e Shift+T mudam a hora em ±1 h (o trânsito e os pedestres seguem a hora); **Y** percorre os climas fixos e volta ao automático; **K** liga e desliga a subestação mais próxima (a linha de debug acima do relógio diz qual, a que distância e para onde); **C** olha pela câmera de segurança mais próxima (C ou Esc sai); no jornal do celular, as setas escolhem a manchete, OK abre a matéria, a tecla esquerda atualiza; **Shift+K** liga e desliga a cidade toda; **PageUp/PageDown** sobem e descem um andar dentro de um prédio (até existirem escadas e elevadores).
  - A linha de status mostra semente, posição, `DRAW x ms (MAX y)` e os modos. A linha de cima dela mostra data, hora, clima e `POWER x/y`.
- **Desempenho:** no PC do usuário (monitor de 180 Hz; ele nota quedas). Desde a 10.8 o mundo é desenhado por **6 workers** em paralelo: no theater district, em 356×120 e girando a câmera, o quadro leva ~5,7 ms na mediana e ~8,6 ms no pior caso, contra 14–17 ms num thread só (medido na máquina do Claude, 16 threads). O `DRAW` da linha de status é o tempo do worker mais lento. `bench(n)` ainda mede a vista num thread só, numa grade 256×80; para o pool, veja "Lições da 10.8". Toda novidade deve ser medida antes e depois.
- **Mapa dos módulos** (o que está em cada arquivo):
  - **`src/sim/`** (nunca importa `render` nem o DOM):
    - `city.ts`: grade, quarteirões, prédios (caixas, cilindros e caixas cortadas pela diagonal), empresas, props, marcos, borda e Sarcófago.
    - `world.ts`: o passo fixo de 60 Hz e as teclas de debug.
    - `traffic.ts`: trânsito por faixas (IDM), curvas nos cruzamentos, semáforos (`signal`, `zoneSignal`), paradas obrigatórias, a diagonal (`diagRoad`, zonas), filas (`queues`).
    - `events.ts`: a fila de eventos (apagão, energia de volta, engarrafamento; batidas na 7B).
    - `clock.ts`: tempo, calendário, sol e lua.
    - `weather.ts`: previsão pura, chão molhado e neve.
    - `power.ts`: subestações, geradores e quem alimenta o quê.
    - `telco.ts`: antenas (cell sites), a energia e a bateria delas, a linha pré-paga do jogador (crédito, pacote de dados), os números (código de área, empresas, orelhões, residenciais que existem, 911/411/611), horários das empresas e `lookup` (quem um número alcança).
    - `wifi.ts`: os roteadores Wi-Fi das lojas e casas (nome, segurança, chave, canal) e os Wi-Fi de manutenção das subestações (`util`, WEP, nome `GRIDLINK-nn`).
    - `computer.ts`: o computador virtual (hardware, disco em árvore `FsNode`, processos, `workS`, bateria/temperatura, `BiosConfig` com relógio, rádio, ordem de boot e a senha de supervisor `supervisorPass`/`bootPass`); `playerLaptop(seed)`.
    - `network.ts`: os hosts por rede Wi-Fi (`lanHosts`: roteador, PCs; nas de manutenção o bridge, a RTU da subestação e o armário de semáforos ATC), as portas e serviços, a lista de senhas fracas (`WORDS`), `setBreaker`/`setSignals` (os efeitos no mundo), `modbusRegs` (a telemetria da RTU lida da rede elétrica, para o `mbus`) e `techOnline` (quando um técnico está logado em claro, para o `tdump` capturar).
    - `packets.ts` **`[HACKING]`**: `capture(...)`, o gerador puro e determinístico de pacotes de uma rede Wi-Fi, materializados só quando o `tdump` captura (handshake, ARP/DHCP/DNS/TCP/HTTP, cifra pela segurança, perdas pelo dBm).
    - `citizens.ts`: a população (lares nos apartamentos, empregos nas lojas, escritórios e galpões, famílias, amigos, celulares e linhas fixas), o plano do dia de cada um (`dayPlan`) e `whereIs`, onde cada um está a uma hora (funções puras).
    - `peds.ts`: os cidadãos caminhando perto do jogador, da porta de um prédio à porta do outro.
    - `social.ts`: a rede social (posts de rotina e de testemunhas dos eventos, curtidas).
    - `device.ts`: os modelos de celular dos fabricantes da cidade (`phoneModel`, `playerPhone`).
    - `interior.ts`: plantas dos andares (sob demanda, em cache), portas de rua (a principal e as das lojas), móveis, escadas de incêndio (as internas saíram; o código delas ficou), elevadores (de vidro também) e a colisão de tudo isso.
  - **`src/render/`:**
    - `raycaster.ts`: a ordem do quadro; `wallColumn` desenha as fachadas.
    - `pool.ts` e `worker.ts`: o desenho do mundo em vários workers (10.8).
    - `glRenderer.ts`: a composição na GPU da grade do mundo e da grade da interface (10.9).
    - `sky.ts`: gradiente, nuvens, lua e sol.
    - `precip.ts`: chuva e neve.
    - `sarcophagus.ts`: a cúpula e a constante `CURVE_R`.
    - `objects.ts` e `models.ts`: objetos com volume (inclusive semáforos e placas de PARE, `signalModel`, `signalFarModel`).
    - `signs.ts`: letreiros, lâmpadas e símbolos.
    - `lights.ts`: luzes dinâmicas.
    - `lightmap.ts`: poças de luz dos postes.
    - `lamps.ts`: falhas e fotocélula.
    - `power.ts`: o efeito do blackout, uma função pura.
    - `interior.ts`: o andar em volta do jogador (paredes, piso, teto, lâmpadas, degraus, botoeira do elevador, janelas e vidro) e os interiores vistos de fora pelas janelas (`peekInto`/`peekCell`).
  - **`src/phone/`** (a interface do celular, como o `main.ts`: lê a simulação, não é lida por ela): `phone.ts` (estado, teclas e a lógica dos apps; os apps de fábrica e a pasta), `shells.ts` (os modelos visuais e as capinhas), `ui.ts` (as peças da interface: caixas arredondadas, degradês, fotos com iniciais, papéis de parede, a barra de título), `wire.ts` (o Streetwire: feed, post com foto e comentários, perfil, curtidas), `calendar.ts` (o calendário: mês, dia, feriados, eventos da cidade, lembretes), `skins.ts` (o visual próprio da previsão do tempo e do jornal), `draw.ts` (o aparelho na mão, a luz nele, o boot, o mapa da cidade e o de interior, a lista de lugares), `apps.ts` (o menu em grade e as telas dos outros apps), `lcd.ts` (a tela: tamanho, cores, texto digitando, barra de status, teclas laterais, letras grandes), `gps.ts` (o receptor com os limites de 2008), `radio.ts` (o rádio GSM/EDGE: sinal, barras, registro, dados), `call.ts` (a ligação: quem atende, o roteiro de falas, o menu por teclas, a cobrança), `ussd.ts` (o menu `*100#` da operadora e os cartões de recarga), `codes.ts` (os códigos secretos por semente), `camera.ts` (visor e fotos), `store.ts` (os apps da loja: Snake, conversor), `payphone.ts` (o orelhão), `wifi.ts` (o Wi-Fi do aparelho), `textinput.ts` (o editor Abc/T9/123), `mapdata.ts` (o raster da cidade para o mapa). O hardware do aparelho fica em `sim/device.ts`. A luz nas mãos (`VIEW_LIGHT`, `VIEW_GLINT`) vem do fim de `renderWorld`.
  - **`src/laptop/`** (a interface do notebook, como o celular: lê a simulação): `bios.ts` (a SETUP com as abas Main/Advanced/Boot/Security/Exit, o menu de boot, o diálogo de senha de supervisor e a tela de desbloqueio `unlock` no POST), `editor.ts` (o `nano`), `screen.ts` (telas cheias em células), `laptop.ts` (o objeto, tirar/guardar, achar onde sentar, a tampa, a bateria), `draw.ts` (o aparelho, a tela 80×22, o teclado, a BIOS, o painel de status, a máscara da senha `S.mask`), `shell.ts` (o shell tipo Unix: comandos, boot, o ritmo do trabalho real, a placa Wi-Fi `Shell.net`, os comandos de hacking `mmap`/`bruter`/`tdump`/`tnet`/`mbus` e a sessão remota `conn`/`remote`; o gate de senha no boot/SETUP). O hardware é um `Computer` de `sim/computer.ts`; os hosts e efeitos vêm de `sim/network.ts`.
  - **`src/audio/`:** `sound.ts` (ambiente, chuva, trovão, zumbidos) e `blackout.ts` (o som do apagão, versão A).
  - **`src/locale/`:** `en.json`, `names.ts` (nomes, operadora, fabricantes de celular, cidadãos com o primeiro nome pela geração e pelo gênero, bichos, firmas e os agradecimentos), `news.ts` (o letreiro; `madeHeadline`, as manchetes da gramática), `calls.json` (as falas das ligações, agora peças da gramática), `people.en.json` (firmas, papéis), `social.en.json` e `social.ts` (posts, comentários e perfis do Streetwire), `sms.ts` (os SMS dos cidadãos e das lojas), `thanks.json` (os nomes dos amigos), e:
    - `gen.ts`: o gerador de textos (gramática com `#símbolo#`, pesos `3|`, condições `[old evening]`, `{slots}`, persona e a memória `Fresh` contra repetição);
    - `voice.ts`: a voz de cada cidadão (as condições de quem fala e do momento, os nomes da vida dele em `lifeCtx`, e o jeito de digitar em `voice`);
    - `text/`: os arquivos da gramática, juntados por `text/index.ts` (`TEXT`): `words`, `words-more`, `memes`, `sms`, `news`, `news2008`, `calendar`, `comments`, `profiles`, `names` (nomes por gênero e geração, sobrenomes, bichos), `promo` (as ofertas das lojas por SMS) e `posts/` (formas, emoções e assuntos).
  - **`src/render/intro.ts`:** a abertura (terminal no preto, depois a cidade em blocos que se desfazem em glifos).
- **Ordem do quadro** (`renderWorld`):
  1. Por coluna: dentro de um prédio, primeiro o andar (`interiorColumn`), que ocupa as células e a profundidade e deixa livres só as janelas; depois céu (`skyColumn`, que pula células ocupadas) e Sarcófago, chão (com a curvatura e testando a profundidade), paredes (DDA na grade; telhados quando o olho está acima deles) e cerca.
  2. Depois: fumaça, guindastes, objetos, `glassPass` (o vidro das janelas por cima da cidade: escurece, reflete a lâmpada, gotas de chuva) e `finish` (fundo sólido, névoa do dia, luar, glifos de bloco).
  3. Por fim: chuva e neve, que vêm depois do `finish` para manter o fundo do que está atrás.
- **Flags para religar depois:** `SEAM_LIGHTS_CLOUDS` (`sky.ts`), as brasas iluminando as nuvens, para religar com a câmera 3D.
- **Bugs registrados para depois:** veja "Bugs conhecidos".

### Histórico

O registro detalhado de tudo o que foi feito, etapa por etapa (com nomes de funções, medições e o retorno do usuário), fica em **`docs/historico.md`** (movido em 2026-10-02 para o CLAUDE.md pesar menos em cada mensagem). Ler só a parte da etapa em que se está trabalhando. Lá também estão o plano da etapa 10, a preparação da etapa 6 e os designs já implementados (rede elétrica e blackout, física dos carros). **Ao fechar uma subetapa, a entrada nova do Histórico vai para lá** (no topo), e aqui só o Resumo é atualizado. As entradas `[HACKING]` de lá seguem a mesma regra: não ler fora da Trilha de hacking.

## Bugs conhecidos (para uma etapa de correção mais adiante)

Pedido do usuário em 2026-09-30: registrar os bugs sem perder tempo com eles agora; haverá uma etapa de correção de bugs mais para frente.

**Triagem da segunda parte (2026-10-01):** feitos as portas dos cômodos, a chuva que invertia, o reflexo pintado no vidro, as faixas da diagonal, os pingos do andaime e mais desempenho (veja o Histórico). O chão invisível do elevador saiu da lista: o usuário disse que o elevador está funcionando. **Ficam para depois:** móveis invisíveis de fora ou o interior falso nas janelas (etapa própria de otimização, ou a 15); pessoas dentro dos prédios (etapa 11); relevo nas teclas da botoeira do elevador (pedido do usuário, "pode ficar para depois"); desempenho dos objetos e das paredes; picos de tempo.

**Triagem da primeira parte da etapa de bugfix (2026-10-01):** foram corrigidos a porta de rua invisível por dentro (com as placas EXIT), os móveis na frente das portas, o desenho das escadas (rework, esperando o teste do usuário), as escadas de incêndio na frente de portas, o som do blackout geral somando, os faróis estourando a luz, o poste dentro do semáforo e parte do desempenho (theater district 24 → 16 ms no `bench`). **Ficam para a segunda parte**, nesta ordem de prioridade: portas nos cômodos com animação; chão invisível na cabine do elevador; desempenho (paredes e chão ainda ~11 ms no theater district; picos de tempo); faixas de pedestre da diagonal; chuva que inverte; reflexo pintado no vidro das fachadas; móveis invisíveis de fora (ou o interior falso nas janelas); pessoas dentro dos prédios; pingos no meio do andaime.

- **Retorno do usuário no começo da etapa 10 (2026-10-01, com capturas; para uma etapa própria de cor e luz, não agora):**
  - **O Sarcófago parece de vidro:** visto de dentro de um prédio, pela janela, a lua e outras coisas aparecem por trás da cúpula (ela fica transparente). Investigar se acontece só pelo vidro (`glassPass`) ou também na rua (ordem do céu/lua contra os blocos da cúpula, `KIND.block` no `finish`).
  - **O dia continua ruim:** cinzento, com visual estourado, e ainda há manchas amarelas. O usuário quer investigar o espaço de cores (talvez a paleta e a correção de cor no shader limitem) e **talvez repensar o modo diurno** inteiro.
  - **Saturação demais em alguns lugares, mesmo de noite:** por exemplo, as faixas diagonais roxas no vidro de uma torre e as paredes verde-água de um saguão.
- **Stutter leve com os workers (relatado pelo usuário em 2026-10-02, "nada alarmante"):** de vez em quando o tempo de desenho tem picos e a imagem engasga. Suspeitas a medir: a coleta de lixo nos workers (o JSON do snapshot a cada quadro), as plantas de interiores geradas na hora (até 4 por quadro em cada worker) e o pipeline perdendo um quadro quando um worker atrasa. Ver na etapa de otimização.
- **O transmissor de rádio (marco) parece uma torre maciça:** devia ser uma treliça vazada, uma antena gigante em que se vê a cidade e o céu pelos vãos. Pedido do usuário em 2026-10-01; ele também quer mais tipos de marco na etapa de variedade (15).
- **O FPS cai sem a CPU nem a GPU chegarem ao máximo (pergunta do usuário em 2026-10-01):** o motivo é que todo o desenho por coluna roda numa única thread de JavaScript, ou seja, num núcleo só, que num processador de 8 a 16 threads aparece como ~6–12% de uso total. A GPU só monta os glifos, quase sem trabalho. **O Electron não resolve:** é o mesmo Chromium e o mesmo V8, com a mesma thread única. **Plano de mitigação, para a etapa de otimização:**
  1. **Web Workers em paralelo:** o raycaster por coluna se divide naturalmente em faixas de colunas. N workers (um por núcleo, menos um) desenham numa `CharGrid` sobre `SharedArrayBuffer` (o Vite precisa dos cabeçalhos COOP/COEP). A cidade é só leitura; o que muda por quadro (carros, pedestres, luzes) vai como snapshot. Ganho esperado de 3–6× no `DRAW`. É o caminho que mais rende e respeita a regra "simulação separada da renderização".
  2. **Raycast no shader (WebGL2):** a grade da cidade como textura, um raio por célula no fragment shader. Ganho enorme e já abre a câmera 3D de verdade, mas é uma reescrita grande do render.
  3. **WASM (Rust):** 1,5–3× por núcleo; vale combinado com o item 1, não sozinho.
- **Postes do andaime e dos pontos de ônibus não são sólidos.**
- **Desempenho caindo (relatado em 2026-10-01):** no PC do usuário, o jogo começou preso em 180 FPS e hoje, nas mesmas situações, chega perto de 60 FPS. Fazer uma **etapa de otimização junto com a de bugfix**: perfilar o quadro (`wallColumn`, interiores vistos de fora, objetos, luzes dinâmicas), medir com `bench` e considerar mover partes para Workers ou para o GPU.
- **Fachada fictícia "brigando" com os interiores vistos de fora (relatado em 2026-10-01, com captura):** numa torre perto, as janelas alternam entre o cômodo de verdade (`peekCell`) e a janela desenhada (`pane`, padrão `@@`), e a troca muda com a vista, parecendo z-fighting. Suspeitas, a confirmar: `peekFor` falha em algumas colunas e cai no desenho antigo (o `peekInto` não acha a entrada do raio na planta perto das bordas dos vãos ou da caixa, ou `P.box !== id` em torres com recuo, já que `peeks[1]` guarda um resultado só para todos os andares de cima da coluna), ou o orçamento de plantas (`PLANS_PER_FRAME`) e o descarte do cache (`PLAN_KEEP`) fazem a mesma janela alternar entre quadros. Para depurar: congelar a câmera diante da torre, contar por coluna quantas janelas caíram em `pane` e por quê.
- **Picos de tempo de desenho:** o `MAX` da linha de status chega a ~20–55 ms às vezes perto de prédios novos (provavelmente a geração das plantas, até 4 por quadro, ~0,2 ms cada, mais os móveis); medir com o perfilador antes de mexer.
- **Móveis invisíveis de fora (relatado em 2026-10-01):** os interiores vistos pelas janelas (`peekCell`) mostram parede, piso e teto, mas não os móveis. O usuário achou esquisito; fica para a etapa de bugfix.

## Refinamento: anotações (para a etapa 15)

Ajustes que o usuário pediu para deixar para a etapa de refinamento e variedade (não são bugs):
- **Opiniões sobre a etapa 6:** o usuário testou e tem opiniões; perguntar no começo da etapa 15.
- **Carros ocos por dentro:** a carroceria é um bloco sólido; pelo vidro se veem o motorista e os passageiros, mas cortados pela caixa do corpo (só o que fica acima de 0,95 m aparece). Fazer o interior oco (laterais, piso, painel) para ver as pessoas inteiras.
- **Dois cones de farol:** hoje cada carro tem um só cone de luz. Devem ser dois, um por farol, com o da direita mais longo (o facho assimétrico de verdade).
- **A praça do X do theater district** e o X em geral: mais decoração (veja a 7.5 e a 7.6).

## Notas técnicas (para as próximas sessões)

### `[HACKING]` Lições da etapa 10 (notebook e hacking), para não repetir
*(pular esta seção fora de uma sessão de hacking; as lições não-hacking do notebook, como testar o shell e a máscara de senha, estão resumidas aqui mas o grosso é de rede)*

- **Testar o shell sem a mão no jogo:** construir um `Computer` (`playerLaptop(seed)`), `install(pc, world.time)`, `new Shell(pc, world)`, `sh.boot(now)` e bombear `sh.update(now)` em passos de 0,05 s. O gate `Shell.ready` usa **`performance.now()`**, não o `now` falso, então depois do boot é preciso forçar `sh.busyUntil = 0` antes de cada linha digitada; aí `type()` funciona (`sh.key(ch, false, now)` por caractere + `Enter`). Digitar é ignorado enquanto `state !== 'ready'` e enquanto a fila não esvazia.
- **A placa Wi-Fi se reateia sozinha:** `Shell.net.update()` roda a cada quadro e recalcula o sinal pela posição **real** do jogador (`world.player`). Forçar `net.state='up'` à mão não adianta: no quadro seguinte ele cai, porque a antena de manutenção fica longe. Para testar, mover `world.player.x/y/px/py` para o ponto da antena (e `inside=-1`), conectar pelo fluxo real (`iwconfig essid "GRIDLINK-nn" key <WEP>`, `dhclient`) e **restaurar o jogador no fim**.
- **Senha mascarada num terminal:** não dá para mascarar só no `draw` sem o shell saber. O `Shell.mask` liga por uma linha (o estágio de senha), o `draw` mostra `*` no lugar do input e o `run()` ecoa `*` em vez do texto; o `run()` desliga `mask` depois de ler a linha.
- **Sessão remota num shell de uma linha por comando:** em vez de um comando de uma tacada, um estado `conn` (host, estágio login/pass/shell) e o `run()` roteando a linha para `remote()` enquanto a conexão está aberta; o `prompt` muda para o host. `boot()` e `logout()` zeram `conn` e `mask`.
- **`~/bin` não está no PATH do shell:** o `run()` e o Tab só varrem `['/bin','/usr/bin','/sbin']`. As ferramentas de hacker em `~/bin` precisaram ser acrescentadas à busca à mão (`[...PATH, '/home/<user>/bin']`); o `.profile` não é lido.
- **Segurança do modelo:** o sistema de hacking do jogo (hosts, portas, senhas, captura) pode acionar o classificador de segurança no Sonnet 5.5 e bloquear a resposta no meio. O Opus 4.8 fez o grupo C inteiro sem bloqueio. Se o Sonnet bloquear, trocar para o Opus. O conteúdo é sempre fictício e só na simulação (veja "Conteúdo seguro").
- **(10.11) Dirigir o `Shell` logo depois de um `navigate` falha:** o gate `ready` usa `performance.now()`, mas `boot`/`load`/`fwDone`/`shutdown` também usam `performance.now()` direto para agendar. Se você pumpa `sh.update(T)` com um `T` falso pequeno, as teclas são barradas (perf.now < busyUntil) ou a sequência pós-boot/desbloqueio nunca escoa (itens agendados em ~perf.now, bem além do seu `T`). **Semeie o relógio falso a partir do real** (`let T = performance.now()/1000 + 0.5`) e avance dali, para o seu `update` e o scheduler compartilharem o mesmo relógio. (Alternativa parcial: forçar `sh.busyUntil = 0` antes de cada linha, mas não resolve o boot/load.)
- **(10.11) Pacotes determinísticos:** `capture()` é puro e só roda na captura; chaveie pela semente e por `floor(atTime)` (mesmo instante → mesma cena; alguns segundos depois → outra). `sim/` não pode importar `locale`, então o `ssid` entra como parâmetro (o shell tem `wifiName`). Afine os beacons para a captura não virar um muro de beacons.
- **(10.11) Testar o `mbus`/telemetria sem a mão:** `modbusRegs(w,k)` é puro — chame com `subs[k].on` ligado e desligado e confira que os registradores zeram no disjuntor aberto. O `mbus write coil 0 0` chama `setBreaker`, então confirme pelo `w.power.subs[k].on` (true→false), não pela saída de texto.
- **(10.11) Senha de BIOS, caminhos a cobrir:** power-on (`supervisorPass && bootPass` → `openUnlock('boot')` no `postDone`), F2/menu (`requestSetup` → `openUnlock('setup')`), senha errada barra, Esc só pula a SETUP (no boot não há como pular). O F2 só é ouvido no POST (`inPost`); já ligado, F2 não faz nada — teste via `reboot`.
- **(10.11) HTML→PDF nesta máquina:** não há weasyprint/wkhtmltopdf/playwright/reportlab, mas há Chrome e Edge. `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="OUT.pdf" "file:///.../IN.html"` dá fidelidade total de CSS (fundo escuro com `print-color-adjust:exact`). `pip install pypdf` para conferir páginas; o console do Git Bash (cp1252) não imprime acento, use `sys.stdout.buffer.write(...encode('ascii','replace'))`.

### Lições da etapa R (render na GPU), para não repetir

- **Erros do WGSL não aparecem sozinhos:** a tela fica preta e o console mudo (o pipeline inválido só reclama ao ser usado). Conferir com `device.createShaderModule({code}).getCompilationInfo()` no console (cada mensagem tem linha e coluna) ou com `pushErrorScope('validation')` em volta de um `encode`.
- **`a < x … y > b` no WGSL vira template:** um identificador seguido de `<` com um `>` mais adiante na mesma expressão é lido como `tipo<…>`. Pôr cada comparação entre parênteses.
- **Mais de 8 storage buffers num estágio** precisa pedir o limite no `requestDevice` (`maxStorageBuffersPerShaderStage`); o shader do mundo usa 14.
- **O que é por quadro fica na CPU e sobe como lista** (lâmpadas com falhas e energia, luzes dinâmicas, números do céu: `gpuPrepare`); o que é por célula vai para o shader. A energia (`power`) é uma função pura e foi portada inteira, para cada janela apagar no seu tempo.
- **Comparar com a CPU célula por célula:** `gridText(...)` (CPU) e `await gpuText(...)` (GPU, J ligado) na mesma região e na mesma posição; pôr o jogador na rua (um ponto dentro de outro prédio faz a CPU desenhar o interior). Telões e letreiros animados mudam entre as duas leituras.
- **Palavras reservadas do WGSL** (`std`, entre outras) deixam o pipeline inválido sem erro no console; ver com `getCompilationInfo()`.
- **Medir pelo `onSubmittedWorkDone`** dá ~3 ms mesmo com pouco trabalho (é a espera da fila); serve para ver se cresce, não como o custo real do shader.

### Lições da 11.5 (gerador de textos e apps), para não repetir

- **Testar textos sem o navegador:** escrever um `src/_teste.ts` que cria o mundo (`createWorld(42)`), roda `stepWorld` e imprime posts, comentários, SMS e manchetes; empacotar com `npx rolldown src/_teste.ts --format esm --platform node -o <scratchpad>/t.mjs` e rodar com `node`. Mostra centenas de frases em segundos. **Apagar o arquivo antes do commit.**
- **Contar as combinações** com um script Python que lê os JSON, tira pesos e condições e multiplica os símbolos de cada peça (memoizado). Serve para saber se um arquivo precisa de mais peças.
- **Peças que começam com maiúscula no meio de um texto montado:** depois de um opener com vírgula ("Is it just me, or Heard…") a palavra seguinte vai para minúscula (`runOn` em `locale/social.ts`), menos "I" e os nomes do contexto. Pontuação dupla (".!", ",.") e espaço antes de smiley são tratados em `tidy`.
- **Uma frase de evento fora de um post de evento** ("hope nobody's hurt" num post de trabalho): marcar as peças com `[news]`/`[!news]`. Os memes também ficam fora dos posts de eventos.
- **`{símbolo}` vs `#símbolo#`:** `{x}` é um slot do contexto; `#x#` é uma lista da gramática. Trocar um pelo outro deixa o texto cru na tela (aconteceu com `{roleword}`). Procurar com `grep -oh "{[a-zA-Z0-9_]*}"` nos JSON.
- **Arquivo novo de gramática precisa entrar em `text/index.ts`**, senão `#símbolo#` some sem aviso (aconteceu com os eventos do calendário).
- **Não regravar o `en.json` com `json.dump`:** ele é formatado à mão (linhas compridas); editar como texto.
- **Python inline com `\b`:** dentro de um heredoc com aspas simples, `"\b"` do Python vira o caractere de backspace no arquivo; usar `chr(92)+'b'` ou um script gravado com Write.

### Lições da etapa 11 (cidadãos, rotinas e rede social), para não repetir

- **Medir a população com contas antes de escolher números:** os prédios cabiam ~58 mil apartamentos; com 20 mil pessoas, 85% vazios. Contar a capacidade (área das plantas de verdade, ~46 m² por unidade) antes de fixar o alvo.
- **Rotina como função pura do dia** (`dayPlan` em cache por pessoa e dia, `whereIs` lendo o dia e a véspera) deixa os 40 mil sem custo: só se calcula quem alguém pergunta. A varredura de pedestres olha 1/30 da população por tick.
- **Amostrar o plano em horas cheias engana:** os turnos começam na hora cheia, então a caminhada de ida termina logo antes dela e some de uma amostra feita às 8:00. Amostrar em minutos quebrados (8:37) ou dar uma folga individual (chegar até 20 min antes).
- **O relógio 30× mais rápido que a caminhada:** um pedestre real anda minutos, o plano dele dura segundos reais. Deixá-lo andar até a porta mesmo depois de o plano dizer que chegou; a rua fica mais cheia que a densidade do plano, o que ajuda.
- **Módulo duplicado pelo HMR:** um `static` de classe (`Call.calledUs`) importado no console não é o mesmo do jogo depois de uma edição (`call.ts?t=…`). Procurar a URL com `performance.getEntriesByType('resource')` e importar a mesma.
- **Uma regra de "quem pode atender" precisa de uma rede:** o orelhão atendido por quem passa lê `world.peds`, então só funciona perto do jogador, o que é o certo.
- **Eventos frequentes inundam um feed:** a cidade tem várias batidas por minuto; limitar o número de testemunhas por tipo e por peso, e dar menos peso aos posts "em casa".
- **Testar a rede social sem o celular:** `createWorld(42)`, avançar `stepWorld` alguns milhares de ticks, `togglePower(w, false)` no meio, e ler `w.feed.posts` com `postText` (de `locale/social.ts`) e `citizenName`.

### Lições da 10.10 (direção sem trilhos), para não repetir

- **Contar batidas pelos eventos do mundo** (`w.events.list` com `kind === 'crash'`) ou pelos carros que viraram `wreck`, e não importando `traffic.ts` no console: depois de uma edição, o `world.ts` usa `traffic.ts?t=…`, e o `crashes` importado à parte é outra instância (sempre vazio).
- **Diagnóstico que funcionou:** guardar a cada 12 ticks o estado dos carros livres numa fila curta e, quando surge um `wreck` novo perto do jogador, imprimir os últimos segundos dos dois (trilho/curva, `ts`, `v` do plano, `bv` do corpo, `seen`, faixa, `sig`). Cada causa apareceu assim: o corpo que não conseguia frear quando o plano parava de golpe, a previsão em linha reta que não via a curva, o alcance curto demais para carros lentos e a troca de faixa dentro do cruzamento.
- **Um plano que para de golpe** (o `gap < 0.3` do IDM) é invisível no trilho, mas um corpo com aderência real passa do ponto. Se o corpo bate, primeiro procurar por que o plano não freou antes.
- **O trilho escondia conflitos:** antes de culpar a física nova, medir o que o trilho puro faz (sobreposições por minuto com a física desligada).
- **Cuidado com scripts de edição que recortam por índice:** procurar o fim do bloco depois do começo, senão o trecho é duplicado. Numa cadeia `&&`, se um comando falha, os seguintes não rodam, mas uma linha nova depois do heredoc roda. Para refazer, `git checkout` do arquivo só quando todas as mudanças não commitadas dele são da tarefa atual.

### Lições da 10.8 (render em workers), para não repetir

- **Medir o pool sem o laço do jogo:** abrir com `?workers=0` (o jogo não cria pool), criar `new RenderPool(42, undefined, n)` no console, `pool.resize(356, 120)`, e disparar o quadro seguinte **de dentro do evento de pronto** (envolver `pool.done`; quando `pool.busy` chega a 0, chamar `pool.frame` de novo). Um laço que espera com `MessageChannel` atrasa a entrega das respostas dos workers e dá números falsos. `pool.ms` é o worker mais lento.
- **Aquecer os caches antes de medir:** um worker novo ainda não tem as plantas dos interiores vistos pelas janelas (até 4 por quadro); sem um giro completo de aquecimento, o pool parece 2,5× mais lento do que é. Medir girando a câmera (`yaw += 0,03` por quadro), não parado: parado esconde os custos de trocar de vista.
- **O que pesou, em ordem:** (1) clonar o snapshot para cada worker (~1 ms por worker no thread principal) → JSON escrito uma vez em memória compartilhada; (2) faixas desiguais ao girar → cortar pelo custo medido por coluna, deslocado pelo giro; (3) cada worker montava todos os objetos em 500 m → descartar os que não caem na sua faixa. Escrever em `SharedArrayBuffer` não custa nada a mais.
- **Mais de 6 workers não ganha:** cada um paga ~1,5 ms fixos por quadro (luzes, outdoors, objetos) e eles disputam núcleos e cache (cada um tem a sua cópia da cidade).
- **Uma exceção num worker trava o pool** (ele nunca responde): o `renderWorld` do worker fica num `try/catch`.
- `/// <reference lib="webworker" />` num arquivo do projeto muda os tipos globais do projeto inteiro (os eventos do DOM perdem `code`, `deltaY`…): não usar; fazer o cast de `self` para `Worker`.

### Lições da segunda parte do bugfix, para não repetir

- **Nada que se move pode ser `velocidade × tempo` se a velocidade muda:** com o tempo grande, uma queda pequena da velocidade faz a posição andar para trás (foi a chuva subindo). Integrar quadro a quadro, e cuidar para uma segunda vista no mesmo quadro (a câmera) não somar de novo.
- **Cache de luz por quadro:** a luz (`lightAt`, com as luzes dinâmicas) custa ~1 µs por amostra num lugar cheio de letreiros. Amostrar numa grade que engrossa com a distância e interpolar economizou mais que reaproveitar a última amostra da coluna, porque colunas vizinhas dividem as mesmas amostras. Uma tabela de espalhamento com carimbo de quadro dispensa limpar a memória a cada quadro.
- **Medir A/B no mesmo carregamento:** o `bench` varia muito entre carregamentos (10–17 ms na mesma vista). Uma flag em `globalThis` que liga e desliga a parte suspeita, alternada 2–3 vezes na mesma sessão, dá números confiáveis. Tirar as flags por edição antes do commit.
- **Saber o que desenhou cada célula** (`grid.kind`) é barato e abre efeitos por tipo de superfície no `finish` sem mexer em cada passe.
- **Uma folha de porta num raycaster por coluna** é um segmento: intersecção raio-segmento por coluna antes da caminhada, e o desenho dela quando a caminhada passa da distância; como só cobre até 2,2 m, o resto da coluna segue (as linhas já ocupadas não são redesenhadas).
- **Testar uma ligação entre os dois aparelhos sem esperar:** com o celular ligado e com serviço, `payphone.open(0)`, `payphone.press('ok', now)` duas vezes (moedas), os dígitos do número do jogador e `'send'`; depois de ~5 s, `phone.callIn` é verdadeiro e `phone.press('send', now)` atende.

### Lições da primeira parte do bugfix, para não repetir

- **Perfilar por fases:** medidores temporários em `renderWorld` acumulando `performance.now()` por fase num objeto posto em `globalThis` (o módulo importado no console não é a mesma instância que o jogo usa depois do HMR, porque o Vite acrescenta `?t=` às URLs). Rodar `bench` na pior direção e comparar. **Remover os medidores por edição antes do commit**, e não restaurando uma cópia antiga do arquivo, para não perder as mudanças feitas entre as medições.
- **Onde estava o tempo:** cada célula de um objeto testava todas as peças dele (um caminhão tem ~30) e amostrava a luz do zero. Selecionar as peças por coluna e reaproveitar a luz entre pontos próximos tirou ~70% do custo dos objetos sem mudar a imagem. A luz (`lightAt`, com as luzes dinâmicas) é cara: amostrar uma vez para pontos a menos de 0,3 m entre si quase não se nota e economiza muito.
- **Um efeito que vale dentro e fora** (a luz da mão) fica mais simples no espaço da tela, pela profundidade de cada célula, do que no mundo, porque os interiores têm iluminação própria.
- **Planos que dependem de outro cache** (as escadas de incêndio precisam das portas das lojas, que vêm com a planta do térreo): guardar o resultado sempre e refazê-lo quando a dependência aparece, em vez de não guardar (recalcular por coluna custaria caro).
- **Desenhar a escada** num raycaster por coluna: pensar nela como uma pilha que se repete a cada andar e procurar, em cada ponto do raio, a superfície logo abaixo e logo acima do olho; as paredes de quem não é o poço não podem ganhar a altura extra.

### Lições da etapa 9 (rede de telefones e celular), para não repetir

- **Textos do jogo podem ser sinalizados:** um arquivo grande de falas de NPC foi sinalizado ao ser escrito. O usuário pediu menos falas e bem genéricas. Escrever falas curtas, educadas e neutras, em arquivos pequenos (`calls.json`), e evitar temas pesados mesmo quando o tom é noir.
- **Chaves repetidas no `en.json`:** o JSON aceita a mesma chave duas vezes e fica com a última, e o TypeScript passa a ver o tipo errado (`camera`, `store` já existiam como listas de aviso). Antes de acrescentar uma chave, procurar se ela já existe no mesmo objeto.
- **O heredoc grande no Bash continua falhando** (aspas e crases); todas as edições em lote foram por scripts Python gravados no scratchpad com Write. Funciona bem; não precisa de nada do usuário.
- **Testar sistemas do celular sem esperar:** a ligação (`new Call(world, número, 0, false)`) roda em laço com um `now` falso, e o resultado (falas, sons pedidos, estado) se lê direto; o rádio também (`new Radio()`, `update` duas vezes com tempos falsos). Para a cidade inteira, sortear 300 pontos e montar o histograma de barras.
- **Calibrar com números, não no olho:** a primeira versão do sinal dava 4 barras em quase todo lugar, até dentro de prédios; o histograma mostrou, e a perda da rua foi ajustada até a rua dar 3–4 barras e o interior de 0 a 4.
- **Pointer lock:** o painel do app não tem pointer lock, então o clique nas teclas e o arrastar com o botão direito não puderam ser testados aqui; o teste é do usuário. `movementX/Y` chegam mesmo sem pointer lock, o que permite olhar em volta com o cursor livre.
- **Renderizar duas vezes por quadro funciona:** o visor da câmera chama `renderWorld` numa grade pequena depois do quadro principal, sem quebrar nada; custa ~2,4 ms, então roda só 15 vezes por segundo.

### Lições da etapa 8 (navegação e celular), para não repetir

- **Testar o celular no painel:** `phone` fica em `window` (dev). Depois de entrar ("ENTER THE CITY"), as teclas se simulam com `dispatchEvent(new KeyboardEvent('keydown', {code}))` e o `keyup`: `ArrowUp` tira o celular, e o boot leva ~5 s antes de aceitar Enter. A tela fica em `gridText(c0, oy + 4, c0 + 42, oy + 30)` com `c0 = cols − 56 + 4`, `oy = 34` (celular erguido); `cols = gridText().split('\n')[0].length`. **Não** passar coordenadas além da grade para `gridText` (ele lê lixo). Letras grandes (`bigText`) são células acesas sem glifo: não aparecem no texto; conferir o estado (`phone.calc.cur`, `phone.dial`) ou uma captura.
- **O HMR volta à tela de título:** toda edição de código recarrega a página, e o jogo fica parado (`running` falso): as teclas do celular são ignoradas até clicar em "ENTER THE CITY" de novo. Antes de cada teste depois de uma edição, navegar de novo e entrar.
- **Se `world.tick` não sobe, procurar um erro no console antes de achar que é o painel oculto:** uma exceção dentro do quadro derruba o `requestAnimationFrame` e o jogo congela sem aviso. Foi o que aconteceu com `'.'.repeat(-1)`: a hora do quadro (`now` do `requestAnimationFrame`) pode ser **anterior** à hora de uma tecla (`performance.now()` no evento), então `now - quandoApertou` pode dar negativo. Sempre limitar com `Math.max(0, ...)`.
- **Testar sistemas do celular sem esperar o tempo real:** criar uma instância própria (`new Gps()` importando `/src/phone/gps.ts?t=...`) e chamar `update` em laço com um `now` falso (60 passos por segundo simulado). Assim 2 minutos de GPS rodam em milissegundos, em vários pontos da cidade (mudar `world.player.x/y` e `inside` e restaurar depois).
- **O GPS realista demais trava o jogo:** a primeira versão exigia 4 satélites totalmente visíveis e no centro só via 3, então ficava procurando para sempre. Receptores de verdade usam sinais refletidos e difratados; aceitar satélites logo abaixo do horizonte, com mais erro, deixa realista sem travar. Medir sempre em céu aberto, no centro e dentro de prédio.
- **Sobreposição em desenho por camadas:** sombras de teclas (ou qualquer coisa que escurece vizinhos) precisam de duas passadas: primeiro todas as sombras, depois todas as peças por cima; senão a sombra de uma tecla escurece a seguinte, ou a seguinte apaga a sombra.
- **Efeitos de tela por coluna precisam respeitar a profundidade:** o vidro da janela (`glassPass`) era aplicado à coluna inteira e tingia os móveis na frente. Todo passe que pinta "por cima" deve conferir `grid.depth` da célula.
- **Rótulos de mapa:** sem controle de colisão, os nomes se atropelam nos zooms afastados. Um `Uint8Array` de células ocupadas, com prioridade para o que está mais perto do centro da vista, resolve barato.
- **Rua mais fina que a célula:** amostrar o chão pela maioria faz as ruas sumirem nos zooms afastados. Testar se a coluna ou a linha contém uma rua (`roadIn`) e desenhá-la como linha.
- **O heredoc grande no Bash continua falhando nesta máquina** (erro de aspas); scripts Python de edição vão para o scratchpad pela ferramenta Write e rodam com `python <arquivo>`. Heredocs pequenos às vezes passam.

### Lições da etapa 7 (trânsito), para não repetir

- **Testar a simulação sem o jogador**, no console do navegador do app, com um mundo próprio (não mexe no do jogo):
  ```js
  const W = await import('/src/sim/world.ts');
  const w = W.createWorld(42), inp = { forward: 0, strafe: 0, run: false, heading: 0 };
  w.player.x = w.player.px = -100; w.player.y = w.player.py = -100; // fora do caminho dos carros
  const st = new Map();
  for (let k = 0; k < 60 * 120; k++) { W.stepWorld(w, inp); for (const c of w.cars) st.set(c, c.v < 0.1 ? (st.get(c) ?? 0) + 1 : 0); }
  // a parada mais longa: se cresce sem parar ao longo de vários minutos, é impasse (bug); se estabiliza, é fila
  Math.max(...st.values()) / 60
  ```
  Cada chamada do `javascript_tool` tem limite de 45 s: rodar em blocos de 1–2 min de simulação, guardando o mundo em `window.__w` entre as chamadas. Testar sempre **várias sementes (42, 7, 123), com e sem energia** (`w.power.subs.forEach(s => s.on = false)`), porque o blackout transforma tudo em paradas obrigatórias e é onde os impasses aparecem. Congestionar no blackout é aceito pelo usuário; travar para sempre, não.
- **Impasses que já apareceram, e o porquê:**
  - A checagem de "faixa de saída cheia" contava os carros parados do **outro lado** do cruzamento, que ainda iam entrar, e as paradas se esperavam em círculo. Só conta quem já passou da saída ou está cruzando o mesmo cruzamento (`laneFree`).
  - O carro que começava a curva era projetado para trás na faixa de saída e "via" como carro da frente quem esperava na aproximação oposta. O líder de quem está na curva só pode estar além da saída ou na mesma curva.
  - **Registro de chegada velho:** um carro que passava uma parada obrigatória continuava como "primeiro da fila" dela, e ninguém mais ia. O registro cai assim que a próxima parada do carro muda (`c.gate !== G.key`).
  - **Paradas perto demais:** uma parada a 8–15 m de outra não deixa espaço para um carro entre elas; as duas se esperam. Paradas a menos de 15 m viram uma só (`MERGE`). O mesmo vale para o X: ele cobre também as travessias da diagonal com as ruas de dentro.
  - O carro parado esperando um cruzamento grande contava como "dentro" dele, e bloqueava a si mesmo.
- **Testar o blackout com a função de verdade** (`togglePower(world, true)`, o Shift+K). Marcar `changed` à mão com um tick negativo faz `power()` achar que a subestação nunca desligou.
- **Luzes e o blackout:** toda luz decorativa (letreiro, neon, telão, outdoor, placa, coroa, holofote, marquise) usa `signPower`/`adElec`, que ignoram o gerador; só a luz de dentro usa `buildingPower`/`elec`. Depois de criar uma luz nova, apagar a cidade (Shift+K) num lugar cheio dela e olhar o que sobra.
- **Referencial dos objetos:** +x é a frente e **+y é a direita** (o y do mundo cresce para o sul). O comentário antigo dizia "esquerda" e o motorista foi parar no banco do passageiro. O lado direito de um sentido `hd` é `(-dy, dx)` (`laneOff`).
- **Desempenho:** medir com `bench` antes e depois, na mesma vista (o `bench` varia ~1–2 ms entre medições; repetir 2–3 vezes). Para isolar o custo de uma mudança no render, `git stash`, recarregar, medir, `git stash pop` (cuidado: não usar `git checkout <arquivo>`). Muitos objetos pequenos e distantes custam mais do que poucos grandes: os semáforos distantes pesavam ~3,5 ms até virarem só a lâmpada acesa; o raio do círculo que envolve um objeto também pesa (o braço do semáforo foi separado do poste e centrado nele).
- **Movimento no tempo real, não no do jogo:** o relógio do jogo anda 30× mais rápido. O que o jogador vê acontecer (ciclo dos semáforos, ônibus no ponto, guincho) usa `tick / 60`.
- **Nada aparece nem some à vista:** carros e pedestres entram e saem a mais de 300 m / 150 m do jogador.
- **Medir na mesma hora do jogo:** ao comparar com `bench` antes e depois, não mexer em `world.time` só numa das medições (a hora muda luzes, trânsito e pedestres). A primeira chamada depois de recarregar sai ~3 ms mais alta; descartar.
- **Testar um objeto isolado** (um modelo ou material novo): importar `objects.ts`, `models.ts` e `grid.ts` no console, criar uma `CharGrid(180, 80)` com `depth.fill(1e9)`, uma `Cam` com `scale = 40 / tan(30°)`, `plane = 90 * 0.6 / scale`, `light` devolvendo um `Float32Array(3)` zerado e `hor` mirando o objeto, chamar `drawObjects` com a câmera a 4, 10, 20 e 30 m e imprimir os caracteres. Mostra como o objeto se lê a cada distância sem depender do painel pequeno. Para pegar o módulo editado, `import('/src/...ts?t=' + Date.now())`.
- **Um detalhe pequeno precisa caber nas células:** a 20 m uma célula cobre ~0,17 × 0,29 m. Um texto que deve ser lido de longe precisa de pelo menos uma coluna por letra e não pode perder células para moldura (foi o que travou o sinal de pedestre). Para o mesmo modelo virado para o +y de outro objeto, use `c' = -s, s' = c`.



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
  - Olhar para cima e para baixo é *y-shearing*: `horizonte = rows/2 + tan(pitch) * scale`. Um raycaster por coluna não consegue girar a câmera de verdade. O limite foi a 60° e o usuário mostrou a distorção: telhados viram "pirâmides" inclinadas ao olhar para cima e girar. Por isso o limite voltou para **~40°** (`Camera.MAX_PITCH = 0.7`), o que com o VFOV de 60° ainda mostra até ~70° acima do horizonte.
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
- Cada recarga (inclusive a do HMR) sorteia uma semente nova. Use `?seed=42` para comparar sempre a mesma cidade.
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
- **Separar o hacking (classificador de segurança):** veja a regra no topo de "Estado atual". Trabalho de cibersegurança vai para a "Trilha de hacking" do Roteiro, com o Opus 4.8 e aviso ao usuário no começo. **Fora de uma sessão dessa trilha, não abra os arquivos de hacking nem leia as entradas `[HACKING]`**, para não travar a resposta no classificador.
- **Testes agrupados (pedido do usuário em 2026-09-30):** cada etapa tem **2 ou 3 rodadas de teste**, cada uma cobrindo um grupo de subetapas (por exemplo, 4a–4c e depois 4d–4f). Cada subetapa tem o próprio commit. Ao fim de cada grupo, pedir que o usuário teste, e só seguir para o próximo grupo depois da aprovação dele.
- **Ao terminar uma etapa (regra obrigatória, pedida pelo usuário em 2026-10-01; não esperar que ele peça):**
  1. **Anotar as lições aprendidas** numa seção "Lições da etapa N" nas notas técnicas: os bugs que apareceram e a causa, o que travou, como testar aquele sistema, armadilhas do código e da máquina, o que mediu caro. É a base para as próximas sessões resolverem problemas mais rápido.
  2. **Reler o documento inteiro** e corrigir o que ficou desatualizado pelas decisões da sessão atual ou de sessões anteriores (resumo, estado de testes, roteiro, perguntas em aberto, bugs já corrigidos, nomes de funções que mudaram). Refinar o texto onde estiver confuso.
  3. Atualizar "Estado atual" e o "Roteiro", e fazer um commit no Git.
- **Testar de verdade:** abrir o jogo no navegador do app com `preview_start` (configuração `claude-dev`, porta 5180, em `.claude/launch.json`) para ver funcionando, em vez de só checar a sintaxe. Rodar `npm run build`, que também checa os tipos. Medir com `bench` antes e depois de mudanças no render. Veja "Como testar no navegador do app".
- **Som:** o Claude não ouve o áudio. Ao criar ou mudar sons, dizer ao usuário que o teste de ouvido é dele, e descrever o que esperar.
- **Depois do retorno do usuário, seguir sem pedir confirmação (regra pedida pelo usuário em 2026-10-01):** quando ele dá o retorno de um grupo e pede ajustes, fazer os ajustes e **seguir direto para o próximo grupo**, sem parar para pedir que ele confirme os ajustes. Se algo nos ajustes não agradou, ele diz no retorno seguinte. Só parar antes de seguir se ele pedir explicitamente para ver o resultado primeiro. No fim do próximo grupo, pedir o retorno normalmente (cobrindo também os ajustes).
- **Quando o usuário pede para seguir sozinho** ("não precisa pedir teste"), continuar pelos grupos seguintes e juntar o teste no fim. Sem isso, vale a regra dos testes agrupados.
- **Explicar ao usuário como rodar:** o comando do servidor de desenvolvimento, e de preferência um atalho `.bat` para iniciar com duplo clique.
- **Arquivos internos do notebook (aviso do usuário, 2026-10-02):** o shell do notebook (`src/laptop/shell.ts`) tem muito código de hacking. Fora do Opus 4.8, ler e editar só os trechos necessários, com cuidado. Se isso começar a dar problema (o classificador travando), pedir ao Opus 4.8 um **arquivo de mapeamento** com as linhas sensíveis de cada arquivo, atualizado (com as linhas recalculadas) toda vez que um desses arquivos for editado.
- **Electron (investigado em 2026-10-02):** o projeto ainda não tem Electron, então hoje não há compilação a esperar (o teste é no Vite, com recarga na hora). Se o Electron entrar, os testes continuam no Vite, e o pacote do Electron só é gerado **ao fechar cada etapa**, não a cada subetapa.
- **Contexto da conversa (pedido em 2026-10-02):** este documento sozinho já é grande e é lido em toda sessão. Ler só os trechos da etapa atual; quando a conversa ficar longa (muitas leituras de arquivo grandes, várias subetapas), recomendar ao usuário começar um chat novo no fim de um grupo, com o documento atualizado.
- **Limpar o documento ao fim de cada subetapa (pedido do usuário em 2026-10-02):** junto com o Histórico, tirar do CLAUDE.md o que a subetapa atendeu ou tornou irrelevante (pedidos feitos, filas já organizadas, "esperando teste" já aprovado, planos já cumpridos) e levar o texto para `docs/historico.md` ("Pedidos atendidos", no topo). Aqui fica só o que ainda está aberto, em "Pedidos em aberto". O que está no Git e no Histórico não precisa estar aqui.
- **Avisar antes de precisar do navegador (pedido do usuário em 2026-10-02):** o laço do jogo só roda com o navegador do app visível. Antes de uma tarefa que vai medir ou testar no jogo, dizer ao usuário logo no começo da resposta para deixar o navegador do app aberto.
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
6. ✅ **Interiores** *(feita em 2026-09-30 e 2026-10-01, grupos A–F; testada pelo usuário, que tem opiniões para a etapa 15; os bugs estão em "Bugs conhecidos")* (trocada com o trânsito a pedido do usuário em 2026-09-30: dá exploração e gameplay já, e permite medir cedo o custo de ter interiores na cidade inteira). Todos os prédios devem ter interior, inclusive os cortados pela diagonal.
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
   - ✅ **Grupo B (12.7–12.13, esperando o teste):** câmeras de segurança e o modo CCTV, pedestres usando o celular, sons de ambiente (carros e sirenes distantes, o celular de quem passa), manchetes clicáveis com texto e foto, e o bug dos pedestres na diagonal (veja "Pedidos em aberto").
   - **Sites das empresas:** gerados a partir da simulação (horário, endereço, o que vendem, quem trabalha lá), desenhados no notebook; alguns com versão para celular (sites leves de 2008).
   - **Portal de notícias e busca:** as manchetes vindas da fila de eventos, uma busca que acha empresas, pessoas e lugares que existem.
   - **O resto da rede social:** respostas, compartilhamentos, assuntos em alta, o site do Streetwire no notebook, o jogador postar.
   - **Registros dos cidadãos** (pedido do usuário: cada cidadão com identidade e documentos): **detalhar e fazer numa sessão com o Opus 4.8**, porque o assunto pode acionar o classificador de segurança.
12b. **Transporte** (etapa própria, decidido em 2026-10-02; antes era a 11b): **Reavaliar aqui o ritmo do tempo (pedido do usuário em 2026-10-02):** com metrô, táxi, ônibus e carros próprios, os cidadãos chegam mais rápido e não precisam andar a pé para todo lado, então talvez o dia não precise ser tão curto nem a sincronização fora de vista tão forte. Medir de novo a discrepância (planos contra a viagem de verdade) depois do transporte e dos carros dos cidadãos (12c) e decidir com o usuário. táxi (pedido por telefone ou sinal, destino dado ao motorista, que é um cidadão), monotrilho com estações e trens, e **interiores dos veículos bonitos** (carros ocos por dentro, veja "Refinamento: anotações"). Um táxi aéreo futurista não combina com 2008; a alternativa seria um helicóptero de passeio, ainda a confirmar.
12c. **Carros dos cidadãos** (pedido do usuário em 2026-10-02; pode vir antes ou depois da 12b): Exemplo do usuário: se cada pedestre que hoje anda em volta do jogador tivesse carro, seriam ~600 carros a mais na rua; parte deles deve ir de carro. Entra na reavaliação do ritmo do tempo da 12b. ligar os carros às pessoas. A cidade ganha estacionamentos (garagens, vagas na rua), cada carro tem placa e registro ligado a um dono específico, e os carros saem e voltam com as rotinas.
13. **Economia:** empresas, preços, estoques e salários interligados. Os fabricantes de eletrônicos e de chips da cidade dão a marca dos celulares e dos chips (pedido na etapa 8). **A parte de hackear o banco e os sistemas das empresas** é `[HACKING]` (Trilha de hacking).
13b. **Os NPCs interagindo com a cidade** (pedido do usuário em 2026-10-02): os cidadãos usam a cidade de verdade: compram nas lojas (com a economia), sentam nos bancos e nas mesas, esperam no ponto de ônibus, usam os orelhões, entram nos cafés para fugir da chuva, reagem a apagões, batidas e sirenes (param, olham, fotografam, vão embora), abrem guarda-chuvas, pegam táxi.
13c. **Os NPCs interagindo com o jogador** (pedido do usuário em 2026-10-02): reagem a ele (desviam, olham, estranham alguém mexendo num poste, chamam a polícia), e o **sistema de diálogo** (veja "Sistema de diálogo com os NPCs" nos pedidos da etapa 12): falar com as pessoas na rua e ao telefone, pelo gerador de textos e pela vida de cada um, com relacionamentos; base da engenharia social.
14. **`[HACKING]` Hacking completo** (a base nasce na 10; **usar Opus 4.8, avisar o usuário no começo**): computadores virtuais com hardware próprio, redes, cybercafés com Wi-Fi por distância, portas físicas, terminais progressivos, apps de hacker instalados por fora da loja, impacto sistêmico. Absorve os restos de hacking da etapa 10 (os pacotes materializados de verdade, o 502/modbus) e as partes `[HACKING]` das etapas 12 e 13.

### Trilha de hacking (criada em 2026-10-02)

Tudo que **se parece com cibersegurança** fica aqui, em sessões próprias, por causa do classificador de segurança (veja a regra no topo de "Estado atual"). **Regras da trilha:**
- No começo de uma sessão desta trilha, **avisar o usuário para trocar para o Opus 4.8** (menos safeguards) antes de prosseguir.
- **Fora da trilha, não abrir** os arquivos de hacking (`src/sim/network.ts`, os comandos `mmap`/`bruter`/`tdump`/`tnet` e `conn`/`remote` de `src/laptop/shell.ts`, o `util` de `src/sim/wifi.ts`) **nem ler** as entradas `[HACKING]` deste documento.
- **O que já foi feito na trilha:** a etapa 10 grupo C (10.6) e os pacotes/modbus/senha de BIOS (10.11); no celular, os códigos secretos (9.4) e o Wi-Fi do aparelho (9.3/bugfix) — já no disco, não remexer sem necessidade. **Com a 10.11, a etapa 10 está fechada por inteiro.**
- **O que falta na trilha:** a intrusão da rede social (12); o banco e os sistemas das empresas (13); a etapa 14 inteira (que amplia os pacotes do `tdump` para o modelo completo de "Design: pacotes de rede simulados" — hoje a 10.11 já materializa os pacotes, mas de forma mais enxuta —, instala as ferramentas por cabo e traz o Wi-Fi dos cybercafés); e as câmeras invadidas do "Modo CCTV" (Ideias futuras), se virarem jogabilidade.

15. **Refinamento e variedade** (pedido do usuário em 2026-09-30; ampliado em 2026-10-01): uma etapa para refinar o visual **e acrescentar variedade** em vários elementos do jogo (modelos, eventos, fachadas etc.), quando houver mais sistemas e o jogo estiver mais estável. **O usuário testou a etapa 6 e tem opiniões sobre ela, que vai dar nesta etapa: perguntar no começo.** Pode vir a qualquer momento depois da etapa 11, se fizer sentido. Inclui:
   - carros menos arcaicos: rodas girando, pessoas visíveis dentro, modelos e formatos variados;
   - pesquisar **fotos de referência reais na internet**, por exemplo da Times Square;
   - um **distrito cheio de neon, no estilo da Times Square** (pode exigir um tipo de distrito novo);
   - os defeitos visuais conhecidos que ainda estiverem abertos (veja as notas técnicas);
   - (etapa 8) detalhes nos telhados de perto, greebles nas fachadas e topos, chaminés industriais com fumaça (veja "Pedidos em aberto");
   - (segunda lista) placas perpendiculares, holofotes e neons de prédio, outdoors ligados às empresas e telões de notícias, se não tiverem entrado antes (veja "Pedidos em aberto");
   - **animais** (movido para cá em 2026-10-02; antes era a 11c): bichos de estimação nos apartamentos, cachorros passeando com os donos, gatos de rua, pombos, e os cidadãos postando fotos dos próprios bichos no Streetwire. A simulação já tem os bichos de cada lar (`Household.pet`, `petName`).
R. **Render na GPU (WebGPU): medir, prototipar, migrar tudo** (pedido do usuário em 2026-10-02, logo depois do grupo B da etapa 12; as medições estão em "Pedidos em aberto", R.1 e R.2). **Feitos:** R.1 (medir), R.2 (o protótipo, `src/render/gpu/world.ts`, tecla J) a R.3 (o compositor em WebGPU, `src/render/gpu/compositor.ts`: o mundo vai do buffer da GPU direto para a tela, no mesmo quadro) a R.4 (luzes, fachadas por estilo, chão, telhados, `finish` e a **câmera 3D de verdade**, `src/render/gpu/shader.ts`) a R.5 (o céu: gradiente, estrelas, lua, nuvens, `skyCell`) a R.6 (letreiros das lojas, anúncios pintados, telões e o letreiro de notícias, pelo buffer `sg`) a R.7 (o chão queimado da zona de fogo) a R.8 (a cerca; a curvatura das paredes corrigida) a R.9 (o Sarcófago, a torre e os guindastes) e a R.10 (andaimes e relevos). **Próximo:** portas e escadas de incêndio (R.11), os cômodos vistos pelas janelas, objetos e carros, interiores, zona de fogo e Sarcófago, fumaça, chuva e neve caindo, o vidro; sempre comparando com a CPU pela tecla J. **A câmera 3D** já existe no modo GPU (J dá três passos: CPU, GPU, GPU 3D) e vira o padrão quando o resto do mundo estiver na GPU e a versão da CPU for apagada; aí também se solta o limite de olhar para cima (`Camera.MAX_PITCH`). Hoje o render são ~350 KB de TypeScript (`src/render/`), então quanto antes, mais barato. Ganho de quebra: um raio por célula é a **câmera 3D de verdade** (olhar para cima sem distorção, vistas do alto, elevadores de vidro), esperada desde a etapa 2.

**Etapa de correção de bugs e otimização** (pedido do usuário em 2026-09-30; a otimização foi juntada a ela em 2026-10-01, por causa da queda de 180 para ~60 FPS): **vem antes da etapa 15** (decidido em 2026-10-01); a lista está em "Bugs conhecidos".

15b. **Sound design** (pedido do usuário em 2026-10-02): uma passada só de som, com o jogo mais completo: mixagem entre as fontes (ambiente, trânsito, chuva, interfaces), espaço (reverb por lugar: rua, saguão, apartamento, túnel), variação dos sons repetidos, e a revisão de ouvido com o usuário dos sons sintetizados das etapas anteriores.
16. **Vida do personagem** (pedido do usuário em 2026-09-30): deep sim / life sim. Apartamento próprio, stats, necessidades, customização do personagem pela lore. Depende dos cidadãos (11) e da economia (13).

**Para avaliar (pedido em 2026-10-01; reforçado na etapa 8; a luz do sol sem sombras foi feita na 9b): iluminação dinâmica com sombras,** do sol (e da lua) e das luzes (postes, faróis, letreiros, janelas). Verificar se é viável no raycaster por coluna (por exemplo, um raio de sombra por ponto iluminado contra a grade de prédios, ou mapas de sombra por luz na janela deslizante), medir o impacto com `bench`, e talvez criar uma etapa própria para isso.

**O sistema de notícias com telões** entra na etapa 12 (portal de notícias).

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
- **Etapa 12b (transporte):** o usuário ainda não sabe se quer transporte aéreo. Se houver, será um helicóptero de passeio, e não um táxi aéreo.

## Ideias futuras (não decididas)

- **Modo CCTV (pedido do usuário em 2026-10-01; o ASCII City tem algo parecido, e a regra de originalidade vale: a técnica sim, o visual e os nomes não):** uma opção na tela de título ao lado de "ENTER THE CITY": a vista de uma câmera de vigilância presa num poste, girando devagar de um lado para o outro, com efeito de tela de CCTV (linhas de varredura, ruído, data e hora e o nome da câmera no canto, talvez em preto e branco ou monocromático), trocando de câmera de tempos em tempos. Combina com o hacking: as câmeras podem ser objetos da simulação, e o mesmo efeito serve depois para o jogador ver câmeras invadidas no notebook. O modo CCTV da tela de título em si (sem invasão) é visual e pode ser feito em sessão normal; as **câmeras invadidas** são `[HACKING]` (Trilha de hacking).
- Rede da cidade como dado do jogo: nós (telefones, câmeras, semáforos, prédios) com endereços e níveis de acesso.
- Notebook do hacker como objeto físico no jogo, com teclado, tela de terminal e sons.
- Transmissão ao vivo determinística (como o "ASCII City Live"): a mesma semente e a mesma hora mostram a mesma cena.

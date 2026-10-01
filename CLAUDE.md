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
  - **Forma decidida em 2026-09-30: o Sarcófago com uma chaminé de tiragem.** É uma cúpula de contenção colossal e **inacabada** sobre a cratera principal do fogo, com ~3 km de largura, ~400 m de altura (feita com **600 m**, para a escala aparecer na grade; veja a 5.11) e uns 5 km depois da cerca. Tem esqueleto de treliça, painéis faltando e guindastes parados no topo; o laranja do fogo vaza por baixo e pelas frestas. Ela se junta a uma **torre de tiragem** (a ideia de usar o calor do fogo para gerar energia), mas **larga e baixa**, com diâmetro grande em vez de altura, para não aparecer do centro. A inspiração real é o arco de Chernobyl. Para a história e o hacking, é uma obra parada por falência ou corrupção, com telemetria, sensores e guindastes ainda ligados.
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

## Pedidos do usuário para etapas futuras (2026-09-30)

Dados enquanto jogava a etapa 3. Cada um está também no roteiro, na etapa em que cabe.
- **Escadas de incêndio físicas:** hoje são só desenho na fachada. Devem ser objetos em que se sobe de verdade (etapa 6, junto com os interiores e a subida de andares).
- **Letreiros nas fachadas:** com o nome da empresa que de fato funciona ali (vem da simulação, não é enfeite) e com luzes que piscam e fazem efeitos (letras acendendo em sequência, contornos correndo, falhas de neon). O visual e os efeitos cabem na etapa 4; os nomes reais das empresas vêm da etapa 13 (economia), mas podem ser gerados antes, desde que fiquem ligados ao prédio.
- **Interiores físicos, como em Shadows of Doubt:** o interior existe no mesmo espaço que a cidade. Entrar num prédio é atravessar a porta, sem tela de carregamento, sem teleporte e sem fade. É preciso vigiar o desempenho (etapa 6; o usuário quer medir o custo antes de confirmar que fica sem carregamento).
- **Elevadores funcionais:** você entra, aperta o botão e é levado para cima de verdade, sem fade. Alguns elevadores com parede de vidro, para ver a cidade enquanto sobe (etapa 6). Isso depende da câmera com giro vertical de verdade ou pelo menos da altura do olho variável (veja as notas de projeção).
- **Iluminação dinâmica:** os postes e os faróis dos carros iluminam o mundo em volta de verdade, e a luz se move com os carros (etapa 4 para a base da luz, feita; os faróis já iluminam desde a 4; faltam os do trânsito novo, na etapa 7).
- **Objetos espalhados:** entulho, bancos e mobiliário urbano (etapa 4).

## Pedidos do usuário durante a etapa 6 (2026-09-30)

Dados ao testar o grupo A dos interiores, junto com as referências 27–36.
- **Fachadas mais complexas:** hoje são simples demais. Os prédios de Nova York, mesmo quadrados, têm cornijas em vários níveis, arcos, pilastras, bases diferentes do corpo, coroas e muitos detalhes (referências 28–30 e 32). Também andaimes (*scaffolding*), que são comuns em Manhattan.
- **Áreas cobertas da chuva:** debaixo de um andaime ou de um ponto de ônibus não chove, e a água escorre pela borda do telhado. *(Feito para o ponto de ônibus; o andaime vem junto com ele.)*
- **Muito mais letreiros e publicidade nos prédios,** como em Manhattan (referências 34 e 35). Liga-se ao pedido anterior de anúncios ligados às empresas da simulação.
- **Iluminação dos topos à noite:** além dos holofotes de baixo, coroas e topos acesos, como o Empire State (referência 36).
- **Ver os interiores de fora:** *(feito na 6.4, veja o Histórico).*

## Pedidos do usuário durante a etapa 8 (2026-10-01)

Dados ao testar o grupo B da navegação. Cada um também está no roteiro, na etapa em que cabe.
- **Luz do sol nos prédios:** de dia, os lados virados para o sol iluminados e os outros na sombra, e o horizonte iluminado (hoje fica todo preto de dia; o usuário mandou captura). Depois, um mapa de sombras para os prédios fazerem sombra uns nos outros e no chão. Junta-se à avaliação da "iluminação dinâmica com sombras" no roteiro; o usuário quer ver isso explicitamente.
- **A marca do celular e dos chips vem das empresas da cidade:** o aparelho hoje é "Kestrel" fixo no código. Deve ser o nome de uma empresa de eletrônicos que existe na simulação (`city.businesses`, ou fabricantes da economia), e a splash screen mostra essa marca. Os chips de dentro (CPU, rádio) também com marcas de fabricantes que existem no mundo. É simulação: entra com a economia (etapa 13) e com os celulares dos cidadãos (etapa 9); o `Device` em `sim/device.ts` já é o lugar.
- **Detalhe nos telhados de perto:** ar-condicionado, dutos, casas de máquinas, antenas e afins quando se chega perto de um telhado (de um andar alto, o telhado vizinho aparece liso demais). Etapa 15.
- **Greebles nos prédios** (o termo que o usuário procurava: os detalhes de relevo sem função das naves de Star Wars, chamados *greebles* ou *nurnies*): caixas, painéis, saliências e peças miúdas na fachada e no topo, só para o prédio não parecer um paralelepípedo. Etapa 15.
- **Indústria que solta fumaça de verdade:** chaminés de fábrica nos distritos industriais com colunas de fumaça (como as da zona de fogo). Hoje há chaminés (`chimney`) sem fumaça. Etapa 15, ou antes se couber.

## Pedidos do usuário no começo da etapa 9 (2026-10-01)

Anotados por ele enquanto testava o fim da etapa 8. Gostou da digitação por multi-tap.
- **O celular sobe para digitar (como no GTA IV):** hoje a última fileira do teclado fica fora da tela. Quando a tela pede digitação (discador, SMS, notas, calculadora), o aparelho sobe mais, até o teclado inteiro aparecer; nas outras telas volta à altura atual. Etapa 9, grupo A.
- **Botão do meio do mouse tira e guarda o celular.** Etapa 9, grupo A.
- **Clicar nas teclas do celular com o mouse:** o usuário não tem teclado numérico, e digitar e usar a calculadora pelo teclado do PC é chato. As teclas do aparelho na tela devem ser clicáveis (o cursor livre aparece com o celular fora, ou uma mira), com o mesmo afundar, clique e som. Etapa 9, grupo A.
- **Plano de dados com limite (ideia de uma amiga do usuário):** os dados móveis têm franquia em MB; acabou, ou se compra outro pacote ou fica sem 3G/EDGE. Mais um gasto do dinheiro do jogador, bom para a jogabilidade. A operadora é uma empresa da cidade (hackeável depois). O contador de uso nasce na etapa 9 com os dados móveis; a compra com dinheiro de verdade depende da economia (etapa 13), então até lá o saldo pode ser um valor fixo de debug.
- **Marca e modelos de celular vindos das empresas da simulação** (reforço do pedido da etapa 8): o "Kestrel" fixo deve virar o nome de um fabricante da cidade, e deve haver **vários modelos** com hardware diferente (CPU, memória, câmera, rádios), aparência e cores diferentes. Os cidadãos têm aparelhos diferentes (etapa 9 para o dado `Device` por modelo; a ligação com fabricantes reais da economia, etapa 13).
- **Portas difíceis de achar,** para entrar e para sair:
  - por dentro, **placas verdes de saída de emergência** (EXIT) e setas indicando o caminho até a porta de rua;
  - **por dentro a porta de rua não é desenhada** (aparece uma janela no lugar): é bug, para a etapa de bugfix.
- **Pessoas dentro dos prédios,** só para mostrar que são habitados, antes das rotinas da etapa 11 (poucos figurantes parados ou andando no cômodo, com `pedModel`). Etapa de bugfix/refinamento ou começo da 11.
- **Interior falso nas janelas (parallax / *interior mapping*, como o cube map dos jogos):** cada janela mostra um cômodo falso com profundidade, escolhido pelo tipo de prédio (escritório, apartamento, loja), barato. Serve para os prédios distantes (além de `PEEK_FAR`) e, **enquanto os móveis não aparecem nos interiores vistos de fora, para todos os prédios**. Etapa de bugfix e otimização.

## Agradecimentos (easter eggs)

Pedido do usuário em 2026-10-01: amigos dele que aparecem no jogo como agradecimento. **Cada nome aparece exatamente uma vez em toda cidade gerada, num lugar diferente conforme a semente:** numa semente é o nome de uma empresa, em outra um cidadão, uma rua, um marco, uma manchete, um contato no celular etc. A escolha do lugar sai da semente (determinística). Os nomes são escritos exatamente como abaixo, sem tradução.

- Léo Fennix
- Masotan Braun

**Implementado na 9.2:** a lista fica em `src/locale/thanks.json` e o sorteio em `thanks()` (`names.ts`). Hoje os lugares são loja, avenida ou rua larga, marco com nome e distrito. **Cada lugar novo das etapas seguintes (cidadão, contato, post, manchete) deve entrar no sorteio de `thanks()`.** Nunca dois nomes no mesmo lugar, e cada nome uma vez só.

## Pedidos do usuário para planejar (2026-09-30, segunda lista)

Dados antes de começar a etapa 5. Ainda não têm etapa decidida; a sugestão de onde cabem está em cada item e no roteiro.
- **Placas de publicidade e neons condizentes com a simulação:** outdoors e painéis anunciam empresas e produtos que existem (`city.businesses` e, depois, os produtos da economia da etapa 13), e não marcas inventadas à parte. Os anúncios podem mudar com a simulação (liquidação, lançamento, empresa que faliu e deixou o outdoor rasgado).
- **Outras luzes nos prédios:** holofotes iluminando fachadas de baixo para cima, contornos de neon, faixas acesas. Usam a base de luz da etapa 4 (`lights.ts`) e devem ficar ligadas à rede elétrica da 5b. *(Os holofotes foram feitos na 5.3; contornos de neon ainda não.)*
- **Placas perpendiculares à fachada** (*blade signs*): estacionamento, café, hotel, bar, penhor, feitas para quem vem pela rua e pela calçada. Mostram o tipo e o nome da empresa do prédio. No render, são objetos com volume (como os da 4b), presos à parede, e não pintados na fachada. *(Feitas na 5.2.)*
- **Sistema de notícias:** notícias de *flavor* e notícias que correspondem ao que de fato acontece, vindas da mesma fila de eventos da rede social (etapa 12). Prédios com letreiros de notícias correndo (como o *news zipper* da Times Square) mostram essas manchetes na cidade.
- **Distrito no estilo Times Square:** abundância extrema de neon, telões e publicidade. Já estava na etapa 15; provavelmente é um tipo de distrito novo (`KIND` em `city.ts`), com poucos por cidade.
- **Avenidas diagonais que cortam os quarteirões, como a Broadway em Manhattan.** É uma mudança estrutural: hoje a malha é só ortogonal (`xb`/`yb`) e o raycaster percorre essa grade; os prédios são caixas ou cilindros. Uma diagonal pede lotes triangulares e trapezoidais (prédios no estilo Flatiron, que exigem prismas de base poligonal no teste de raio), praças nos cruzamentos em X e um trecho da malha que o DDA precisa testar à parte. **Deve vir antes do trânsito**, porque o trânsito e os semáforos dependem do desenho das ruas. *(Feita na 5.1, a pedido do usuário: "o mais cedo possível, antes de causar problemas".)*
- **Deep sim / life sim imersivo:** ter um apartamento, stats do personagem, customização do personagem em termos de lore (história, origem, habilidades, e não aparência). Provavelmente nas últimas etapas, depois dos cidadãos (11) e da economia (13).

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

## Design: rede elétrica e blackout (proposta, 2026-09-30)

Pedido do usuário, inspirado no blackout do Watch Dogs 1 (a regra de originalidade vale: técnica e sensação sim, sons e visual copiados não). No fim, será uma ação de hacking. Antes disso, entra como uma **tecla de debug**, para acertar o efeito.

**A rede na simulação (pensando nas etapas seguintes).** O blackout não é um efeito de tela: é o **estado de uma rede elétrica** que existe na simulação. As subestações ficam em pontos fixos da cidade (a usina da etapa 3 alimenta a rede). Cada prédio, poste, letreiro e, mais tarde, cada semáforo pertence a uma subestação. Desligar uma subestação apaga tudo o que ela alimenta, e o render só lê esse estado. Assim, a mesma rede depois:
- tranca e destranca portas e para os elevadores (etapa 6, interiores);
- apaga os semáforos e causa acidentes e engarrafamentos (etapa 7, trânsito);
- derruba as antenas de celular e o Wi-Fi (etapa 9);
- mexe com as rotinas dos cidadãos e vira assunto na rede social (etapas 11 e 12);
- fecha lojas e para a economia (etapa 13);
- é hackeada pelo jogador (etapa 14).

**O efeito:**
- **Apagão progressivo:** uma onda que parte da subestação e se espalha em alguns segundos. Janelas, postes e letreiros apagam em sequência, com falhas e piscadas antes de morrer, e nunca todos de uma vez.
- **Som:** estouro de transformador (um estalo grave com chiado elétrico), arcos e zumbidos subindo de tom até cortar, relés e chaves estalando "enlouquecidos", e depois o silêncio de uma cidade sem zumbido. O rumor da cidade abafa.
- **Não fica tudo preto:** o luar ilumina a cidade com uma luz fria e fraca, e dá para ver os contornos. Também continuam acesos os faróis dos carros, as janelas de quem tem gerador (hospital, alguns prédios) e as brasas da zona de fogo no horizonte, que ficam em destaque.
- **A volta da energia:** também progressiva, com o zumbido dos transformadores voltando, lâmpadas de sódio acendendo devagar (primeiro um vermelho fraco, depois o âmbar, como as de verdade), e letreiros piscando até estabilizar.

**Quando implementar: logo depois da etapa 5**, como uma etapa curta 5b. Ela precisa do luar, que só existe a partir da etapa 5; sem ele, o blackout ficaria só preto. Precisa também da luz dos postes e dos letreiros (etapa 4, já feitos) e do módulo de áudio (4f). A tecla de debug liga e desliga uma subestação. O hacking de verdade vem na etapa 14.

**Referência: vídeo do blackout do Watch Dogs 1** (`E:\Downloads\Watch Dogs Cool Blackout - Valya Vinogradova (1080p, h264).mp4`, 17 s, 60 fps). Analisado em 2026-09-30 com folhas de miniaturas:
- **4,5–8,0 s:** a cidade acesa. Entre 7,5 e 8,0 s as luzes ficam **um pouco mais fortes**, um surto antes de queimar. O usuário descreve que elas queimam com faíscas.
- **8,1–8,9 s:** a onda de apagão passa em **menos de 1 segundo**. Começa pelos prédios mais próximos, atravessa o centro e termina nos mais distantes, e **cada prédio e cada poste apaga individualmente**. No jogo original é um círculo em volta do jogador (limitação da simulação dele); aqui a onda segue a **rede real**, o que está ligado a cada subestação, mas com a mesma sensação.
- **Depois:** a área é grande, mas **não é a cidade inteira**. Ao fundo continuam áreas acesas, de outras subestações. As silhuetas escuras se leem contra um **céu nublado mais claro que os prédios**. As **luzes vermelhas de aviação no topo das torres continuam acesas** (bateria ou gerador).
- **12–16 s:** a energia volta aos poucos em partes da cidade.

**Receita do som, pela análise que o usuário pediu a outra IA** (resumo; o som original não é usado). **O texto completo, na íntegra, está em `docs/blackout-som-receita.md`: ler antes de fazer o som da etapa 5b.**
- **Camadas por faixa:** 20–80 Hz sub e impacto; 80–150 Hz o tom grave principal; 150–500 Hz harmônicos e distorção; 700–1500 Hz glitches e arcos; 1,5–5 kHz transientes e estalos; quase nada sustentado acima de 5 kHz. É um som pesado, e não brilhante.
- **Tempo:** entrada rápida com uma massa grave abaixo de 150 Hz, depois o ataque mais pesado. Em seguida, o corpo: um **tom grave sustentado que desce devagar**, ~121 → 112 → 102 → 94 → 86 → 82 Hz (cerca de 7 semitons, de B2 a E2). Por cima entram **rajadas curtas e irregulares** de ruído em ~700–1500 Hz (muitas perto de 1,2 kHz), sem ritmo. No fim, uma última rearticulação forte do grave em ~55–80 Hz, estalos agudos e um corte rápido.
- **Síntese:** o grave é seno ou triângulo, com uma segunda onda uma oitava abaixo, glide descendente, saturação moderada, passa-baixa com ressonância, ataque curto e sustain longo. Nunca um oscilador limpo: precisa soar como um hum industrial de transformador. Os arcos são **ruído → passa-banda → modulação de filtro → distorção → reverb curto e escuro**, cada um com o próprio envelope curtíssimo.
- **Estéreo:** o grave fica no centro; os glitches ganham um pouco de largura.
- **Durante o blackout** (pedido do usuário) continuam os sons mecânicos: chaves e relés estalando, transformadores piscando e graves de eletricidade.
- **Duas versões:** uma fiel a essa receita e outra com interpretação própria, para o usuário comparar, como foi feito com as paletas.

## Design: pacotes de rede simulados (pedido do usuário, 2026-10-01)

O usuário quer que toda rede do jogo (Wi-Fi, EDGE, 3G e qualquer serviço) funcione **por pacotes de verdade**, para que um capturador de pacotes no estilo do Wireshark (com outro nome, mas o mesmo programa na prática) mostre tudo de forma realista e funcional: handshakes, conexões TCP, perda de pacotes e retransmissão.
- **Quando:** no começo de uma etapa de rede, antes do hacking (14), como fundação dela. Na etapa de bugfix só o Wi-Fi inicial, com o modelo de "fluxo" (KB por segundo).
- **Arquitetura proposta, para manter o desempenho:** a simulação continua com fluxos (sessões: quem fala com quem, quantos bytes, quando). Os pacotes são **materializados de forma determinística a partir das sessões só quando algo está capturando** (o capturador, um log, um IDS de alguma empresa). Sem captura, nada é gerado. Com captura, os pacotes daquela rede aparecem com tudo coerente:
  - 802.11: beacons, probe, autenticação, associação, o handshake de 4 vias do WPA (EAPOL), dados cifrados (WEP/WPA) e em claro nas redes abertas;
  - IP: DHCP, ARP, DNS, TCP (SYN, SYN-ACK, ACK, seq/ack, janela, FIN), HTTP da época;
  - perdas pelo sinal (o mesmo dBm do rádio), com retransmissões e tempos que batem com a vazão do fluxo.
- **O passo da simulação** (granularidade dos pacotes, quantos se guardam) é ajustável, para equilibrar fidelidade e desempenho.
- Nomes de programas fictícios e parecidos (veja "Conteúdo seguro").

## Design: física dos carros (proposta do usuário, 2026-10-01)

O usuário propôs física simples nos carros (suspensão, rodas girando e afins), que também ajude a simulação, se o custo for baixo. Plano, para o grupo B da etapa 7:
- **Na simulação (`traffic.ts`), barato e com semente:** cada carro ganha um estado de carroceria com mola e amortecedor: arfagem (pitch) pela aceleração e frenagem, rolagem (roll) pela aceleração lateral nas curvas (v² × curvatura), e um sobe e desce pelos buracos e emendas do asfalto (`hash3` da posição). Mais o ângulo das rodas (distância / raio). São poucas contas por carro e por tick: 300 carros custam bem menos de 0,1 ms.
- **O que muda na simulação de verdade:** a aderência depende do chão (molhado, neve, do `world.weather`), então a distância de frenagem cresce na chuva e na neve, e mais motoristas não conseguem parar no amarelo. Nas batidas, o carro passa de "andar na faixa" para um corpo rígido 2D (velocidade, giro, atrito): bate, gira, derrapa e para fora da faixa, virando obstáculo e evento. Isso deixa as batidas do grupo B físicas, e não só um carro que para.
- **No render:** os objetos só giram em torno do eixo vertical, então a inclinação da carroceria é aproximada deslocando a altura de cada peça pela posição dela (pitch × x + roll × y), o que na resolução da grade se lê como inclinação. As rodas trocam de glifo pelo ângulo (`|`, `/`, `-`, `\`) quando estão perto. O "pular" num buraco e o "afundar" na frenagem aparecem.

## Design: celular e apps (proposta, 2026-09-30)

Ideia do usuário: o celular do jogador tem vários apps com funções reais e uma loja de apps. A época de 2008 (primeiro iPhone e primeira loja de apps) resolve o dilema "a loja não existia nos anos 2000" e deixa a rede social funcionar no celular.

**O aparelho**
- **É um computador virtual como os outros:** CPU, memória, armazenamento, rádio (EDGE/3G, Wi-Fi, Bluetooth), câmera de poucos megapixels e bateria. Esses limites são reais: um app que não cabe na memória não roda, e o armazenamento enche.
- **É um objeto físico:** o jogador tira o celular do bolso, e ele aparece na mão, ocupando parte da tela. A tela é uma região da própria grade de caracteres (`Lcd` em `src/phone/lcd.ts`), desenhada depois do mundo. Os botões fazem som, e o texto é composto aos poucos, como nos terminais. *(Feito na etapa 8.)*

**Conectividade (é daqui que vem a jogabilidade)**
- **Dados móveis:** vêm das antenas da cidade, que existem na simulação. O sinal depende da distância e dos prédios no caminho. São lentos e custam dinheiro do jogo: há um plano de dados com franquia em MB, e quando acaba é preciso comprar outro pacote (veja "Pedidos do usuário no começo da etapa 9").
- **Wi-Fi:** em cybercafés e outros lugares com senha, com alcance físico.
- **Downloads grandes só por Wi-Fi.** Em 2008, a loja real limitava os downloads por rede celular a ~10 MB. Assim, os apps pequenos baixam na rua, e os grandes exigem ir a um cybercafé. A rede social funciona no celular pelos dados móveis, e ir ao cybercafé continua tendo motivo.

**A loja de apps**
- É uma empresa da cidade, com servidores reais na simulação, e portanto pode ser hackeada.
- Há apps pagos com dinheiro do jogo.

**Apps com função real,** cada um ligado a um sistema da simulação. Cada um nasce na etapa do sistema a que pertence:
- **Etapa 9:** discador, SMS e câmera. A foto é um render pequeno e pode ser postada.
- **Etapa 5:** clima, que lê o estado real do clima.
- **Etapa 8:** mapa e GPS, com a posição dada pelas antenas ou pelo GPS.
- **Etapa 10:** táxi, que liga para a central, e horários do monotrilho, com os horários reais dos trens.
- **Etapa 12:** rede social.
- **Etapa 13:** banco, com o saldo real; notícias; tocador de música.

**Apps de hacker não estão na loja.** São instalados por fora, pelo cabo do notebook (um "desbloqueio", como o jailbreak da época). Exemplos: scanner de Wi-Fi, farejador de Bluetooth e captura de pacotes, todos limitados pelo hardware fraco do celular. O notebook continua sendo a ferramenta principal.

**Os celulares dos cidadãos também existem:** modelo, apps instalados, contatos e mensagens são dados hackeáveis. Um app falso publicado na loja pode se espalhar pelos celulares da população, o que é um impacto sistêmico.

## Estado atual

### Resumo para começar uma sessão (atualizado em 2026-10-01)

- **Etapas 1 a 9 (e 5b) concluídas.** A 9 (rede de telefones e celular) fechou em 2026-10-01: o grupo A foi testado e ajustado (9.4); B e C foram feitos sem rodada de teste, a pedido do usuário ("pode prosseguir, não precisa pedir meu feedback de novo"), então **o retorno dele sobre ligações, SMS, orelhões, câmera, loja e abertura pode chegar no começo da próxima sessão.** O que ele achou de errado nas etapas 6–9 está em "Bugs conhecidos", "Refinamento: anotações" e nas seções "Pedidos do usuário…". A nota "perguntar sobre a etapa 6" é para o **começo da etapa 15**.
- **A próxima etapa:** a proposta é a **etapa de bugfix e otimização**, começando pelos interiores (a porta de rua invisível por dentro, as placas de saída, portas nos cômodos com animação e o **rework das escadas**, que o usuário relatou com capturas) e pelo desempenho (theater district perto de 30 FPS). A outra opção é a etapa 10 (transporte). Perguntar ao usuário no começo da sessão.
- **Antes de começar qualquer etapa, leia as seções "Lições da etapa N"** nas notas técnicas: são o conhecimento acumulado das sessões anteriores (a 7 tem como testar a simulação sem o jogador; a 8, como testar o celular).
- **Rodar:** `iniciar.bat` ou `npm run dev` (porta 5173, a do usuário). O Claude usa a configuração `claude-dev` (5180) ou `vite-auto`. `?seed=42` fixa a cidade.
- **Teclas:**
  - jogo: WASD, mouse, Shift corre, Q/E (e as setas laterais) giram; **F** na frente de um orelhão tira o fone (e desliga);
  - celular (como no GTA IV): **seta para cima** (ou P, ou o **botão do meio**) tira; com ele fora, o ponteiro do sistema fica livre e clica nas teclas (segurar o botão direito olha em volta; a roda anda pelo menu e pelas listas); com ele fora, setas = d-pad, Enter ou botão esquerdo = OK, Backspace ou botão direito = Voltar (na tela inicial, guarda), dígitos = teclado, + = \*, − ou . = #, **Space** = tecla verde (abre o discador, liga), **Delete** = tecla vermelha (volta à tela inicial); no menu, a tecla do lugar do app na grade 3×4 abre direto; no mapa, 1–4, \*/# ou a roda do mouse = zoom, OK = lista de lugares (ou centralizar);
  - visual: **B** fundo sólido (4 estágios), **U** glifos de bloco, **M** som;
  - interiores: entrar pela porta; escadas andando; no elevador, mirar na botoeira e clicar (botão esquerdo); escadas de incêndio dos prédios de tijolo andando pela borda de fora do patamar;
  - debug: **T** e Shift+T mudam a hora em ±1 h (o trânsito e os pedestres seguem a hora); **Y** percorre os climas fixos e volta ao automático; **K** liga e desliga a subestação mais próxima; **Shift+K** liga e desliga a cidade toda; **PageUp/PageDown** sobem e descem um andar dentro de um prédio (até existirem escadas e elevadores).
  - A linha de status mostra semente, posição, `DRAW x ms (MAX y)` e os modos. A linha de cima dela mostra data, hora, clima e `POWER x/y`.
- **Desempenho:** no PC do usuário (monitor de 180 Hz; ele nota quedas), o `DRAW` passou de ~3–8 ms nas primeiras etapas para ~17–20 ms em lugares densos (40–55 FPS) e chega perto de 30 FPS no theater district: é a prioridade da etapa de otimização. O celular custa ~0,5 ms. `bench(n)` mede a vista atual numa grade 256×80. Toda novidade deve ser medida com `bench` antes e depois.
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
    - `device.ts`: os modelos de celular dos fabricantes da cidade (`phoneModel`, `playerPhone`).
    - `interior.ts`: plantas dos andares (sob demanda, em cache), portas de rua (a principal e as das lojas), móveis, escadas internas, escadas de incêndio, elevadores (de vidro também) e a colisão de tudo isso.
  - **`src/render/`:**
    - `raycaster.ts`: a ordem do quadro; `wallColumn` desenha as fachadas.
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
  - **`src/phone/`** (a interface do celular, como o `main.ts`: lê a simulação, não é lida por ela): `phone.ts` (estado, teclas e a lógica dos apps), `draw.ts` (o aparelho na mão, a luz nele, o boot, o mapa da cidade e o de interior, a lista de lugares), `apps.ts` (o menu em grade e as telas dos outros apps), `lcd.ts` (a tela: tamanho, cores, texto digitando, barra de status, teclas laterais, letras grandes), `gps.ts` (o receptor com os limites de 2008), `radio.ts` (o rádio GSM/EDGE: sinal, barras, registro, dados), `call.ts` (a ligação: quem atende, o roteiro de falas, o menu por teclas, a cobrança), `ussd.ts` (o menu `*100#` da operadora e os cartões de recarga), `codes.ts` (os códigos secretos por semente), `camera.ts` (visor e fotos), `store.ts` (os apps da loja: Snake, conversor), `payphone.ts` (o orelhão), `mapdata.ts` (o raster da cidade para o mapa). O hardware do aparelho fica em `sim/device.ts`. A luz nas mãos (`VIEW_LIGHT`, `VIEW_GLINT`) vem do fim de `renderWorld`.
  - **`src/audio/`:** `sound.ts` (ambiente, chuva, trovão, zumbidos) e `blackout.ts` (o som do apagão, versão A).
  - **`src/locale/`:** `en.json`, `names.ts` (nomes, operadora, fabricantes de celular e os agradecimentos), `news.ts`, `calls.json` (as falas das ligações, curtas e genéricas) e `thanks.json` (os nomes dos amigos).
  - **`src/render/intro.ts`:** a abertura (terminal no preto, depois a cidade em blocos que se desfazem em glifos).
- **Ordem do quadro** (`renderWorld`):
  1. Por coluna: dentro de um prédio, primeiro o andar (`interiorColumn`), que ocupa as células e a profundidade e deixa livres só as janelas; depois céu (`skyColumn`, que pula células ocupadas) e Sarcófago, chão (com a curvatura e testando a profundidade), paredes (DDA na grade; telhados quando o olho está acima deles) e cerca.
  2. Depois: fumaça, guindastes, objetos, `glassPass` (o vidro das janelas por cima da cidade: escurece, reflete a lâmpada, gotas de chuva) e `finish` (fundo sólido, névoa do dia, luar, glifos de bloco).
  3. Por fim: chuva e neve, que vêm depois do `finish` para manter o fundo do que está atrás.
- **Flags para religar depois:** `SEAM_LIGHTS_CLOUDS` (`sky.ts`), as brasas iluminando as nuvens, para religar com a câmera 3D.
- **Bugs registrados para depois:** veja "Bugs conhecidos".

### Preparação da etapa 6 (interiores) — *superada: a etapa foi feita; mantida como registro das decisões iniciais*

- **Decisões a tomar com o usuário no início** (veja também "Perguntas em aberto"):
  - interiores no mesmo espaço físico da cidade (o pedido original, sem carregamento) ou com carregamento, decidindo depois de medir o custo;
  - se a câmera 3D de verdade (raio por célula, em JS ou no shader) entra agora, porque elevadores com vidro, vistas de andares altos e olhar para cima dependem dela. O usuário já disse que espera por essa câmera para olhar mais para cima.
- **O que já existe e deve ser reaproveitado** (veja "Projetar pensando nas próximas etapas"):
  - **Prédios:** caixas, cilindros e caixas cortadas pela diagonal (`Building.cut`, polígono convexo; **os prédios cortados também terão interior**). As torres com recuo são caixas aninhadas que partem do chão, e as peças de telhado ficam escondidas dentro do prédio de baixo; um interior precisa saber qual caixa é o volume real de cada andar.
  - **Janelas:** as da fachada já têm grade fixa (`BAY` = 1,6 m, `FLOOR_H` = 3,5 m, índices `wi` e `fl` em `wallColumn`), e cada uma tem identidade (acesa ou não por `hash3(id, wi, fl)`, energia própria em `winPow`). Os cômodos devem bater com essa grade, para que a janela acesa vista de fora seja a do cômodo aceso de dentro.
  - **Lojas:** `Building.shop` e `biz` (a empresa do térreo), com a vitrine desenhada em `wallColumn`; o interior da loja vem daí.
  - **Energia:** cada prédio já tem subestação e gerador (`world.power`), então a luz interna e os elevadores devem seguir esse estado.
  - **Clima:** `world.weather` (chuva abafada e janelas molhadas por dentro, que é o "aconchego" pedido em Shadows of Doubt).
- **Pedidos que caem nesta etapa:** as janelas iluminando a fachada (como os letreiros fazem), escadas de incêndio em que se sobe, elevadores reais (alguns com vidro), andares altos com vista, vitrines com o interior das lojas, e pesquisar fotos de referência de fachadas e placas.
- **Referências** (`referencias/`): 02, 14, 15, 16, 18, 19.

### Histórico (registro por etapa; os itens mais antigos ficam no fim)

- **Etapa de bugfix e otimização, primeira parte, e Wi-Fi inicial (2026-10-01).** Retorno do usuário sobre a etapa 9:
  - segurando o botão direito para olhar com o celular fora, o cursor do sistema bate na borda da tela e a câmera para de virar: o ponteiro deve ser preso enquanto o botão está segurado;
  - o flash da câmera e a lanterna não iluminam em volta;
  - quer saber se os orelhões tocam quando se liga para eles; **no futuro, um pedestre poderia atender** (etapa 11);
  - pediu para começar a etapa de bugfix e otimização com uma **triagem**: o mais crítico agora, o resto para outra etapa;
  - propôs uma **versão inicial do Wi-Fi**, sem hotspot elaborado: modems e roteadores em lugares, fácil de testar.

- **Etapa 9, rede de telefones e celular: decisões e grupos (2026-10-01).** O usuário decidiu no início:
  - **Grupos:**
    - **A:** o celular mais confortável (sobe para digitar, o botão do meio tira e guarda, as teclas são clicáveis com o cursor), os easter eggs dos amigos, as antenas na simulação, o sinal real e os dados móveis com franquia.
    - **B:** ligações e orelhões, SMS, a operadora, os códigos `*…#` e vários modelos e marcas de celular.
    - **C:** câmera com fotos, a loja de apps (limite do EDGE e Wi-Fi) e a abertura do jogo.
  - **Clique nas teclas: cursor livre.** Com o celular fora, o mouse solta a câmera e vira uma seta que clica nas teclas; para olhar em volta, segura-se o botão direito ou guarda-se o celular.
  - **Quem atende até a etapa 11:** as empresas e figurantes, com **mensagens de flavor** (gravações, atendentes, "fechado", fila de espera, engano, secretária eletrônica). Gerar **umas mil** variações já pensando no que vem depois (como as 602 manchetes de `news.flavor`, com lacunas e nomes reais da cidade). Números que não existem dão o aviso da operadora.
  - **Contatos:** o "0 of 250" é a capacidade do chip SIM, não um limite de números na cidade, que pode ter milhares. O aparelho vem só com os **contatos essenciais** (emergência e a operadora: atendimento, saldo); o resto o jogador **adiciona à mão**.
  - **Códigos de serviço (USSD), como os da época:** digitar algo como `*100#` e ligar abre um menu de texto da operadora: consultar e recarregar créditos (o plano pode ser **pré-pago**), comprar pacote de dados, ver a franquia, o próprio número. Os códigos são da operadora da cidade (inventados, não copiados de operadoras reais).
- **9.1, celular mais confortável (grupo A, 2026-10-01):** nas telas de digitar (`TYPING` em `phone.ts`: discador, calculadora, notas) o aparelho sobe até o teclado inteiro aparecer (`Phone.lift`; `origin` em `draw.ts`). O **botão do meio** tira e guarda. Com o celular fora, o mouse move um **cursor** (`Phone.cx/cy`, em células; a célula em inverso) em vez da câmera; a tecla sob ele clareia (`hover`) e o clique esquerdo a aperta (`keyAt`); fora das teclas, o esquerdo é OK. **Segurar o botão direito olha em volta**; um clique curto (< 0,3 s, sem arrastar) é Voltar. O clique não pôde ser testado no painel (sem pointer lock): o teste é do usuário.
- **9.2, agradecimentos:** `src/locale/thanks.json` e `thanks()` em `names.ts`: cada nome cai uma vez por cidade em loja (40%), avenida ou rua larga, marco com nome ou distrito, nunca dois no mesmo lugar (semente 42: "Masotan Braun Grocery" e o distrito "Léo Fennix Commons"). O atlas ganhou Latin-1 (códigos 161–255; os blocos ficam em 128–138), e as lâmpadas dos letreiros usam a letra sem acento (`fontRows`).
- **9.3, rede móvel (grupo A):**
  - **Antenas** (`sim/telco.ts`, `world.telco`): uma a cada ~450 m (16 com a semente 42), num canto do telhado do prédio mais alto de cada trecho, a 6 m acima dele (`MAST`). Seguem a subestação, com bateria de 2–6 h de jogo no apagão (`siteUp`; com Shift+K: 16 no ar no começo, 12 em 3 h, 0 em 7 h). As do centro também são 3G (`umts`, para o futuro; o celular do jogador é só GSM/EDGE). Desenhadas como objeto (`mastModel`: armário, poste, três painéis, luz vermelha piscando, que fica acesa no blackout) junto com os outdoors (`gatherBoards`).
  - **A linha do jogador** (`Account`): número `(área) 555-01xx` (o bloco reservado para ficção), pré-pago com $20,00 e pacote de 5 MB (`useData`).
  - **O rádio do celular** (`phone/radio.ts`): a cada 0,5 s (~0,06 ms) ouve todas as antenas no ar: perda urbana a 900 MHz pela distância 3D até as antenas (`EIRP_STREET` = 40 dBm já com a perda da rua), −10 dB por prédio no caminho (lido do raster do mapa, até −40), −14 dentro de prédio, −22 na cabine do elevador, sombreamento de ±3 dB numa grade de 5 m. Registra em 3 s, troca de antena só com 4 dB a mais, perde o serviço abaixo de −110 dBm. Barras em −104/−95/−85/−75. Medido com a semente 42: na rua quase sempre 3–4 barras; dentro de 0 a 4 (2% sem serviço); andares altos melhores.
  - **Dados:** `Radio.fetch` abre a sessão (1,6 s, "GPRS attach", "PDP context") e baixa no ritmo do EDGE pelo sinal (30–200 kbit/s), descontando do pacote a cada quadro; sem sinal falha, sem pacote para ("Data bundle used up"). Na barra de status, `E` pisca enquanto há dados.
  - **Na tela:** barras reais (`Y||..`, `x` sem serviço, piscando procurando), o nome da operadora na tela inicial (`operatorName`), configurações com rede, sinal em dBm, célula, número, crédito e dados. O **app de clima** baixa a previsão (12 KB, guardada por 1 h de jogo; OK atualiza): agora, +3, +6, +12 e +24 h com céu, nuvens, vento e °F, e a fase da lua. Web e loja dizem "Coming soon" com rede (grupo C). A chamada com rede falha com "NETWORK BUSY" até o grupo B.
- **Retorno do usuário sobre o grupo A (2026-10-01), feito na 9.4:** o cursor em ASCII era ruim de mirar (virou o cursor do sistema); roda do mouse nos apps e listas; unidades (°C), toques, modo silencioso, temas; códigos secretos que se acham no mundo, diferentes por geração, e uma seção de debug com eles. A mesa de centro tinha só duas pernas e atravessando o tampo (corrigido). Os interiores (porta invisível, placas de saída, portas nos cômodos, escadas) foram para "Bugs conhecidos". Mandou seguir sem pedir retorno de novo. Regras novas: conteúdo seguro e nomes fictícios de programas (em "Decisões tomadas").
- **9.4, ajustes do grupo A:**
  - **Cursor do sistema:** com o celular fora, `input.unlock()` libera o ponteiro; o clique acha a célula (`cellAtClient` em `main.ts`) e a tecla (`keyAt`). Segurar o botão direito olha em volta (`Input.drag`: os `movementX/Y` contam mesmo sem pointer lock); um clique curto é Voltar. Guardar o celular trava o ponteiro de novo.
  - **Roda do mouse:** no mapa, zoom; no menu, anda de app em app; nas listas, sobe e desce.
  - **Configurações em páginas** (`SET_PAGES`, `PREF_ROWS`, `Prefs` em `phone.ts`): sons (perfil normal/vibrar/silencioso; 6 toques sintetizados com prévia, `sound.ring`; tons de tecla bipe/clique/DTMF/desligado), tela (6 temas: as cores do LCD mudam no lugar, `applyTheme` em `lcd.ts`), unidades (°F/°C, metros/pés: `fmtDist` em todo o celular), sobre o celular, debug do jogo.
  - **Códigos secretos** (`codes.ts`): `*#06#` (IMEI, o padrão GSM) e seis `*#nnnn#` por semente: teste de GPS (o céu com os satélites, o sinal e os usados), teste de campo (célula, LAC, canal, nível, avanço de tempo, vizinhas), sensores (bateria, temperatura, luz ambiente, RF), teclas, LCD e versão. Rodam ao digitar o último `#`. A página de debug lista e disca sozinha (`autoKey`). **No jogo, devem ser achados no mundo** (fórum, oficina, manual vazado; etapas 12 e 14).
- **9.5, ligações** (grupo B; `call.ts`, números em `sim/telco.ts`): cada empresa tem número (código de área da cidade); um terço dos outros números são casas; 911, 411 (manda por SMS as 5 empresas mais perto, $1,49) e 611 (menu da operadora, saldo). Chama com o ringback americano a cada 6 s; ocupado (8% das empresas abertas, ou ligar para si mesmo); número inexistente com os três tons e a gravação. Empresa aberta atende e, como o jogador não fala, reage ao silêncio e desliga; fechada toca a gravação com o horário (`BIZ_HOURS`); banco, cinema e hotel atendem com menu por teclas (horário, endereço, sessões com filmes inventados, espera com música). Casas: pessoa, secretária eletrônica ou ninguém. Cobrança de 10¢ por minuto iniciado (911 e 611 grátis). Falas curtas e genéricas em `locale/calls.json` (o usuário pediu poucas e genéricas, depois de o arquivo grande ser sinalizado). Sons: ringback, ocupado, interceptação, voz sem palavras (ruído em sílabas pela banda do telefone), música de espera, clique. Contatos no SIM (os quatro essenciais de fábrica; novos por multi-tap; Salvar no discador); a tecla verde no discador vazio rediscar.
- **9.6, operadora e SMS:** `*100#` (USSD, `ussd.ts`): saldo, pacotes de 5/20/100 MB comprados com o crédito, recarga com cartão de 12 dígitos (40 cartões por semente; `telco.spent` guarda os usados; um livre aparece no debug), número, uso. Confirmações por SMS. Mensagens: entrada e enviadas, ler, responder, ligar de volta, nova por multi-tap (10¢, só com sinal); empresas respondem às vezes com resposta automática, casas às vezes; número inexistente volta com aviso; avisos da operadora (boas-vindas, pouco dado, dado acabou). Envelope `[=]` piscando na barra de status.
- **9.7, orelhões** (`payphone.ts`): F na frente de um (os 571 objetos `payphone` da semente 42 viram `telco.payphones`, com número próprio): aparelho de aço com visor, teclado cromado, COIN, DIAL e HANG UP clicáveis; 50¢ por ligação em moedas do bolso (`player.cash`, novo, $12,50), devolvidas se ninguém atende; 911 grátis; funciona sem sinal de celular. Ligar para um orelhão toca e ninguém atende (missões depois).
- **9.8, modelos e marcas:** três fabricantes por cidade (`makerName`, slots próprios das raízes), cada um com modelo barato, médio e topo (`phoneModel`); o jogador leva o topo de um deles, com a cor do corpo do modelo. O "Kestrel" fixo saiu. Os cidadãos vão usar os mesmos modelos (etapa 11); a ligação com a economia vem na 13.
- **9.9, câmera** (`camera.ts`): visor ao vivo (um `renderWorld` pequeno da vista do jogador, 15 vezes por segundo, ~2,4 ms cada), foto guardada como glifos com a resolução pelos megapixels (84×42 a 3,2 MP), granulada e escura com pouca luz; obturador pelo perfil; galeria; armazenamento do aparelho (`freeKB`).
- **9.10, loja de apps** (`store.ts`, `STORE` em `phone.ts`): catálogo e instalados; tamanho e preço (no crédito da operadora); download por EDGE e limite de 10 MB pela rede celular (Tunes Player e Street Atlas 3D pedem Wi-Fi, que vem com a etapa 14). Funcionam: Snake, lanterna (tela branca), City News (as manchetes do letreiro, 8 KB por vez), conversor de unidades.
- **9.11, abertura** (`render/intro.ts`): ao entrar, terminal no preto digitando a cidade, o distrito, a data e a hora e o sinal (1,8 s); depois a cidade em blocos sólidos das próprias cores se desfaz em glifos do centro para fora (2,6 s), com um som de entrada. Só na primeira entrada.
- **Ainda não (etapa 9):** ligações e SMS recebidos de figurantes (o toque existe, ninguém liga ainda); Wi-Fi (etapa 14, com os cybercafés); os códigos secretos espalhados pelo mundo; 3G de verdade.

- **Etapa 8, navegação: decisões e grupos (2026-10-01).** O usuário decidiu no início:
  - **O painel é o celular:** sai do bolso com uma tecla e aparece na mão, ocupando parte da tela; o mapa é um app dele. É o mesmo aparelho da etapa 9 (discador, SMS, câmera), então nasce já como o objeto do "Design: celular e apps".
  - **Não pausa:** o mundo continua andando, e dá para andar com o celular na mão.
  - **Posição:** primeiro o GPS sempre exato. **Os limites do GPS de 2008 são o último grupo desta etapa (8C), obrigatório, não esquecer:** demora para achar os satélites ao ligar (*cold start*), erro e salto perto de prédios altos (cânion urbano), sem sinal dentro dos prédios e debaixo de coberturas, e a última posição conhecida piscando enquanto não há sinal. O usuário gostou muito da ideia. Não depende das antenas (etapa 9); a precisão por antena entra lá.
  - **Grupos planejados:**
    - **A:** o celular como objeto (tirar e guardar, na mão, botões com som, texto composto aos poucos) e o app de mapa no nível local (ruas, prédios, marcos, a posição e a direção do jogador).
    - **B:** os outros zooms (distrito, setor, cidade), rótulos de ruas e distritos, a lista de marcos.
    - **C:** os limites do GPS de 2008 (veja acima) e, pedido do usuário em 2026-10-01, **os outros apps de um celular de 2008**: os que não dependem da simulação funcionando de verdade (calculadora, relógio/alarme, cronômetro, bloco de notas e afins), os que dependem dela com a base pronta mas sem função ainda (discador interativo que não completa a ligação, contatos vazios, mensagens) e os que precisam de rede ou de etapas futuras como entradas que dizem "sem 3G" ou "coming soon", já com o layout. É a fundação dos apps da etapa 9.
- **Etapa 8 concluída em 2026-10-01** (grupos A, B e C; A e B testados e aprovados pelo usuário; o C foi feito a pedido dele sem rodada de teste, e o retorno pode vir na sessão seguinte).
- **8.5, correções do retorno do grupo B e mapa de interior (2026-10-01):**
  - **Vidro sobre os móveis:** `glassPass` (`render/interior.ts`) tingia por coluna todas as células de janela, inclusive as de um móvel na frente dela; agora pula as células com algo mais perto que o vidro (`depth < t`).
  - **Sombras das teclas:** em duas passadas (todas as sombras, depois todas as teclas por cima, para nenhuma sombra escurecer a tecla vizinha), do tamanho da tecla, para o lado oposto à luz e para baixo (luz à frente, que vem de cima do aparelho) ou para cima (luz atrás); sempre há um pouco, da luz do ambiente. `VIEW_GLINT[5]` diz quanto a luz está atrás.
  - **Mapa de interior** (`indoorMap` em `draw.ts`): dentro de um prédio, o app de mapa mostra a planta do andar em volta (`planOf`), amostrando 3×3 pontos por célula: um cômodo só é o piso dele, colorido pelo tipo (`ROOM_BG`); dois cômodos encontrando-se é parede `#`, a menos que os dois lados sejam porta; escada `=`, elevador `X`; fora das paredes, a rua ou um vizinho (`:`). Os nomes dos cômodos (`en.json` → `phone.room`) vão no meio deles, onde cabem. As mesmas teclas de zoom escolhem a escala de dentro (`INDOOR_ROW_M`: 1, 2, 3,5 e 6 m por linha). Embaixo, a esquina do prédio.
- **8.6, os limites do GPS de 2008 (grupo C, 2026-10-01)** (`src/phone/gps.ts`, `Phone.gps`): o receptor liga com o app de mapa (ou a lista de lugares) e desliga ao sair.
  - **Satélites:** 11, cada um com azimute e elevação que mudam devagar com a hora do jogo (`hash3` da semente). O céu visível em volta do jogador é um perfil de 16 direções lido do raster do mapa (a elevação do prédio mais alto até 160 m, recalculada a cada 0,5 s). Um satélite acima do perfil conta; um até 0,35 rad abaixo dele às vezes passa refletido nos prédios (com mais erro); dentro de um prédio só passam os altos, fracos e intermitentes.
  - **Fixação:** precisa de 4. Partida a frio 25 s (a primeira vez), morna 8 s, quente 2 s (fixou há menos de 2 min); a contagem anda mais devagar com poucos satélites e para com menos de 3. A fixação aguenta 3 s com menos de 4 antes de se perder.
  - **Erro:** sigma = 3 m + 12/(satélites − 3) + 18 × (elevação média do horizonte) + 5 por satélite refletido, até 60 m; o erro é um passeio aleatório (multipath) que muda a cada segundo. Dentro: 12 m e posição a cada 3 s (fora, a cada 1 s). Medido com a semente 42: céu aberto, fixa em 25 s com erro de 2–5 m; no centro, a frio em 40–70 s, ~18 m de erro médio e perdas curtas; dentro de prédio, ~40 s e perdas curtas.
  - **No mapa:** a vista segue a posição do GPS (antes da primeira fixação, o meio da cidade); sem bússola, a seta segue o deslocamento (parado, `o`); sem fixação, a última posição conhecida pisca como `?`. Uma caixa diz "SEARCHING SATELLITES" com os satélites à vista e uma barra até a fixação, ou "NO GPS SIGNAL" com a última posição; com fixação, a precisão (±m) fica no título, em vermelho acima de 30 m. Na barra de status, "GPS" pisca procurando, fica verde com fixação e cinza sem sinal. A lista de lugares mede a distância a partir do GPS.
- **8.7, os outros apps (grupo C, pedido do usuário, 2026-10-01)** (`src/phone/apps.ts`; as peças comuns da tela foram para `src/phone/lcd.ts`):
  - **Menu em grade 3×4**, como nos celulares da época: cada app numa moldura com símbolo e cor, na posição da sua tecla no teclado (1 Maps, 2 Calls, 3 Contacts, 4 Messages, 5 Camera, 6 Web, 7 Clock, 8 Calc, 9 Notes, * Weather, 0 Store, # Settings); setas andam pela grade, a tecla do lugar abre direto.
  - **Funcionam de verdade:** calculadora (dígitos, # o ponto, as setas + − × ÷, OK =, * limpa), relógio (a hora da cidade e um cronômetro em segundos reais: OK começa e para, * zera), notas por multi-tap (a mesma tecla em menos de 1 s troca a letra; 0 espaço, * apaga, # nova linha; até 400 caracteres), configurações (o hardware de `Device`, rede, Wi-Fi, o estado do GPS agora, IMEI).
  - **Com a base pronta, sem rede ainda:** discador (os dígitos em letras grandes, tons DTMF de verdade em `sound.dtmf`, a tecla verde liga, "CALLING…" e depois "NO NETWORK / CALL FAILED" com os três tons da operadora em `sound.callFail`), contatos (vazio, "SIM card: 0 of 250"), mensagens (caixas vazias, não envia).
  - **Esperando a rede ou uma etapa futura:** câmera ("coming soon", com a rede na etapa 9), web, clima e loja ("no data connection"; clima e loja baixam por EDGE ou Wi-Fi).
  - **Teclas novas:** **Space** = tecla verde (do menu ou da tela inicial abre o discador), **Delete** = tecla vermelha (volta à tela inicial), **.** também é o # (o ponto da calculadora).
  - **Crash corrigido no teste:** o quadro usa a hora do começo dele, que pode ser um pouco anterior à da tecla; `now - callAt` dava negativo e `repeat(-1)` derrubava o laço de quadros.
- **8.1, o celular e o mapa local (grupo A, 2026-10-01), aprovado:**
  - **O aparelho** (`src/phone/`, fora de `sim` e de `render`, como o `main.ts`): `phone.ts` guarda o estado (no bolso ou na mão, a tela, o menu, a vista do mapa, quando cada tecla foi apertada) e traduz o teclado; `draw.ts` desenha o celular sobre a vista, no canto de baixo à direita (50 colunas, 46 linhas visíveis; a última fileira do teclado fica fora da tela), com tela de 42×26 células. **P** tira e guarda (sobe em ~0,25 s, com som de pano e o toque na mão). Com o celular fora, as **setas** são o d-pad, **Enter** é o OK (e a tecla lateral esquerda), **Backspace** é Voltar e os **dígitos** são o teclado; WASD continuam andando e Q/E girando. As teclas acendem por trás com o aparelho ligado e afundam ao serem apertadas, com clique e tom (`phoneKey`, `phoneSlide`, `phoneBoot` em `sound.ts`).
  - **O hardware é um dado** (`sim/device.ts`, `Device` e `PLAYER_PHONE`: Kestrel 7300 Navigator, KOS 3.1, ARM11 332 MHz, 128 MB, GSM/EDGE, Wi-Fi b/g, GPS). O boot (na primeira vez que sai do bolso) mostra o logotipo e lista o hardware digitando aos poucos; o rádio diz NO SERVICE porque as antenas ainda não existem (etapa 9). Na etapa 9 esses limites passam a valer de verdade.
  - **Telas:** espera (relógio grande na fonte 5×7 dos letreiros, data), menu (só Maps por enquanto; `APPS` em `phone.ts`) e o mapa. Ao tirar do bolso a tela redesenha (a luz de fundo acorda).
  - **Mapa local** (`mapdata.ts` e `map` em `draw.ts`): a cidade é rasterizada uma vez em quadrados de 2 m (`mapRaster`: rua, calçada, lote, prédio com altura, parque, praça, pátio; ~26 ms, durante o boot). Cada célula do mapa mostra o chão mais comum nos seus quadrados e o prédio mais alto, em âmbar mais claro quanto mais alto (`^` acima de 200 m). Norte para cima, 8 m por linha (a coluna é 8 × a proporção da célula, então não estica): ~200 × 176 m. O mapa se desenha linha a linha (celular lento), com o distrito e a escala no topo, marcos com `*` e nome, o jogador piscando com uma seta na direção do olhar, e embaixo a esquina. O d-pad move a vista um quarto de tela (mostra a distância e a direção de volta), e OK centraliza de novo.
  - **Custo:** ~0,4 ms por quadro com o mapa aberto.
- **Retorno do usuário sobre a 8.1 (2026-10-01):** "tá ótimo". Pediu o que virou a 8.2.
- **8.2, ajustes do celular (2026-10-01):**
  - **Controles no estilo GTA IV no PC** (pesquisados: seta para cima tira o celular, Backspace guarda): **seta para cima** tira (P continua valendo, nos dois sentidos); com ele fora, setas = d-pad, **Enter ou botão esquerdo do mouse** = OK, **Backspace ou botão direito** = Voltar, e Voltar na tela inicial (ou durante o boot) **guarda o celular** (a tecla lateral direita diz "Hide"). As setas para cima e para baixo não andam mais (só W/S), como no GTA IV.
  - **Boot em dois estágios:** primeiro a checagem do hardware passando rápida (320 caracteres/s, `BOOT_LOG_S` = 1,9 s), depois a splash (fundo azul clareando, o logotipo desenhando, o modelo digitando, barra de carga) até `BOOT_S` = 4,6 s; o som de ligar toca no começo da splash.
  - **Celular na luz da cena:** `VIEW_LIGHT` (`raycaster.ts`, calculado no fim de `renderWorld`) é a luz nas mãos do jogador: dentro do prédio, a lâmpada do cômodo; fora, o céu (dia, luar, relâmpago) mais os postes, letreiros e faróis a 1,2 m de altura. Vai de ~0,3 no escuro a ~1,5 sob um poste de sódio, com a cor dele. O corpo e as teclas multiplicam as cores por ela (as letras das teclas, com luz de fundo, não escurecem); a tela emite luz própria e só ganha um véu fraco da luz da cena. A borda tem luz em cima e à esquerda e sombra à direita, as teclas têm aresta clara e sombra embaixo, e um **reflexo** diagonal desliza pelo metal e pelo vidro da tela conforme o jogador gira (mais forte com mais luz).
- **Retorno do usuário sobre a 8.2 (2026-10-01):** gostou dos ajustes e das cores. Pediu o que virou a 8.3 e a regra de seguir sem pedir confirmação depois do retorno (em "Como trabalhar neste projeto"). Relatou o poste dentro do semáforo e o theater district a ~30 FPS (em "Bugs conhecidos").
- **8.3, reflexo pela luz, adaptação do olho e relevo das teclas (2026-10-01):**
  - **Reflexo da luz mais forte por perto** (`VIEW_GLINT` em `raycaster.ts`): a luz é amostrada a 2 m em volta do jogador (4 pontos e o centro, a 1,6 m de altura; dentro do prédio, a lâmpada do cômodo); o gradiente dá o lado de onde ela vem em relação à vista (−1 esquerda .. 1 direita) e a cor é a da luz ali. A força cresce com a luz atrás do jogador (a tela voltada para ele espelha o que está às costas). No celular (`GL` em `draw.ts`, suavizado em ~0,25 s), a faixa do reflexo fica do lado da luz e na cor dela, no metal e no vidro.
  - **Relevo das teclas:** a aresta de cada tecla voltada para a luz pega o reflexo, e uma sombra curta cai do lado oposto (e um pouco para baixo), pelo mesmo lado e força.
  - **Adaptação do olho** (suavizada em ~1,5 s): no escuro a tela parece mais clara (até ×1,25) e faz bloom no vidro e na moldura em volta; sob luz forte fica um pouco mais apagada (até ×0,8).
- **8.4, os zooms do mapa, os rótulos e a lista de lugares (grupo B, 2026-10-01), aprovado:**
  - **Quatro zooms** (`ZOOM_ROW_M` em `phone.ts`: 8, 18, 36 e 96 m por linha; local ~200 m, distrito ~450 m, setor ~900 m, cidade ~2,4 km): teclas **1–4**, **\*** e **#** (ou + e − do teclado) e a **roda do mouse**. O d-pad move um quarto da vista do zoom atual, e a vista não sai da cidade e da borda (300 m).
  - **De longe, as ruas são linhas:** num zoom afastado a rua é mais fina que uma célula, então cada coluna ou linha que contém uma rua (`roadIn`) é desenhada como rua (no zoom da cidade, só as avenidas e as ruas largas), e a diagonal também. Cada célula amostra no máximo 4×4 pontos do raster, para os zooms afastados não pesarem (~0,5 ms em qualquer zoom). Nos zooms de setor e cidade, a cor dos distritos tinge o mapa pelo tipo (financeiro azul, comercial âmbar, residencial verde, histórico marrom, industrial cinza, theater magenta).
  - **Rótulos:** no local, os nomes das avenidas no topo, das ruas nas próprias linhas e da diagonal; no distrito, só as largas; no setor e na cidade, os nomes dos distritos (os mais perto do centro da vista primeiro). Os marcos são estrelas, com o nome até o zoom de distrito. Nenhum rótulo cobre outro nem uma estrela (`used` em `map`).
  - **Retorno do usuário sobre o grupo B (2026-10-01):** "tá ótimo". Corrigido na 8.5: o vidro das janelas tingia os móveis na frente dele; as sombras das teclas do d-pad saíam do tamanho da tecla e não iam para cima ou para baixo conforme a luz. Pedido e feito na 8.5: mapa do interior no GPS. Os pedidos para depois estão em "Pedidos do usuário durante a etapa 8". O usuário mandou seguir até o fim da etapa e fechar o CLAUDE.md, porque pode não voltar a esta conversa.
  - **Lista de lugares** (tela `places`): **OK** no mapa (com a vista no jogador; com a vista deslocada, OK centraliza) abre os marcos, do mais perto ao mais longe, com distância e direção; **Show** leva o mapa até o marco escolhido, num zoom em que ele cabe, e a linha de baixo mostra a distância e a direção de volta.

- **Etapa 7, grupo A (7.1–7.4), feito em 2026-10-01:**
  - **7.1, faixas e semáforos** (`sim/traffic.ts`): cada carro anda numa faixa (`hd`, `road`, `lane`; 0 = a mais perto do centro, mão direita) e segue o da frente pelo modelo IDM (aceleração 2, frenagem 3, folga 2 m, 1,2 s). No cruzamento, segue uma curva quadrática do ponto de entrada ao de saída (`startTurn`; esquerda pela faixa interna, direita pela externa, reto por qualquer uma), escolhendo já a manobra do cruzamento seguinte (`plan`). Não entra se a faixa de saída está cheia (`laneFree`), e a conversão à esquerda no verde cede ao tráfego oposto (`oncoming`).
    - **Semáforos** (`signal`, função pura do cruzamento e de `tick/60`, ou seja, **tempo real**, não o relógio do jogo que anda 30×): ciclo de 64 s, amarelo 3,5 s, todos no vermelho 2 s, verde maior na avenida larga, onda verde subindo as avenidas. Esquinas calmas (residencial e industrial, ruas estreitas) têm ~55% de paradas obrigatórias (`hasSignal`). Sem energia na subestação, o semáforo apaga e vira parada obrigatória: para, espera 0,8 s e vai por ordem de chegada, um por vez (`arrive`, `gate`, `busy`, `firstWait`).
    - Testado sem o jogador: 15 min sem impasse (a parada mais longa é um vermelho, ~50 s); no blackout geral também flui. 300 carros custam ~0,25 ms por tick; 1500, ~0,8 ms.
  - **7.2, semáforos desenhados** (`forSignals` em `raycaster.ts`, `signalModel`/`SIGNAL_POLE`/`STOP_SIGN` em `models.ts`): um poste na esquina da direita do outro lado do cruzamento para cada aproximação, com o braço sobre as faixas e um grupo focal por faixa (vermelho, amarelo e verde; acesa é `Glow`). Placa de PARE na esquina da direita antes do cruzamento. Até 60 m o semáforo inteiro (poste e braço são objetos separados, o braço centrado nele e com `z0` = 4,7 m); de 60 a 200 m, só a lâmpada acesa (`signalFarModel`), porque os distantes eram caros (~3,5 ms). Cada lâmpada acesa joga a cor no asfalto até 80 m (`SIGNAL_LIGHT_FAR`). Linha de parada no chão, 4,6–5 m antes do cruzamento, na metade que chega. **Custo:** ~+1,5 ms no `bench` numa esquina do centro.
  - **7.3, fila de eventos** (`sim/events.ts`, `world.events`): `logEvent(kind, tick, time, x, y, weight, refs)`, guarda os últimos 1000. Hoje: `blackout` e `restored` (em `togglePower`, com a subestação) e `jam` (a cada 10 s, 7+ carros parados a até 80 m de uma aproximação; repete só depois de 5 min). O letreiro de notícias mostra os engarrafamentos dos últimos 3 min (`news.jam` em `en.json`). As batidas (7B) vão entrar aqui.
  - **7.4, a diagonal** (`diagRoad`, `Zone`, `zoneSignal`): ~12% a mais de carros correm nos dois sentidos da diagonal (`dg`, `u`; 3 faixas por sentido), de borda a borda, e dão meia-volta no fim (perto da cerca). Onde ela cruza uma rua da grade há uma **zona**: perto de um cruzamento (até 8 m) ele vira um semáforo de **3 fases** (avenida, rua, diagonal; ciclo de 75 s) e a linha de parada recua até o começo da zona; no meio da quadra, semáforo próprio de 2 fases (60 s, 55% para a diagonal). Onde a diagonal corre sobre uma avenida em ângulo raso (zona com mais de 45 m, `SHARED`), as duas dividem a pista sem parada própria: valem os cruzamentos com as ruas dentro do trecho (limitação: carros das duas podem se sobrepor ali). Postes de semáforo da diagonal na direita depois de cada zona; postes da grade que cairiam na pista da diagonal não são desenhados. Testado em 3 sementes, com e sem energia, sem impasse.
  - **Ainda não:** carros não entram nem saem da diagonal pela grade (só correm nela); não há linha de parada desenhada na diagonal.
  - **7.5, o X da Times Square (pedido do usuário em 2026-10-01):**
    - **Diagonal fixa** (o usuário liberou deixar igual em toda semente, para poder fazer soluções mais "hardcoded"): ângulo de `DIAG_ANGLE` = 24° das avenidas, passando pelo **centro do cruzamento de avenida mais perto do ponto do theater district** (`placeDiagonal` em `city.ts`). Assim o X do theater district fica centrado numa rua transversal, como a Times Square. A diagonal cruza 4–5 avenidas numa cidade de 2 km, e cada encontro desses vira um X.
    - **O X** (`Zone.isX`, `js`, `x`; `xOf`, `xPhase` e `interKey` em `traffic.ts`): onde a diagonal corre sobre uma avenida (trechos de ~100–130 m), o encontro é **um cruzamento só**, com as ruas transversais de dentro dele. Três fases (a avenida, a diagonal, as ruas de dentro juntas), ciclo de 96 s e **vermelho geral de 8 s** para dar tempo de esvaziar. Os carros param só nas bordas do X e, dentro, seguem direto; o X cobre também os cruzamentos da diagonal com as ruas de dentro, para que ninguém pare no meio. No blackout é uma parada obrigatória grande, por ordem de chegada. Semáforos nas bordas (avenida e diagonal) e linha de parada da avenida nelas.
    - **O "calçadão que fazia curvas":** a faixa de pedestre e a linha de parada da avenida eram medidas a partir da borda da diagonal, então ao longo do X corria uma faixa zebrada diagonal de ~130 m, que parecia uma calçada torta. Nas avenidas a faixa agora fica só nas ruas transversais.
    - Testado nas sementes 42, 7 e 123, com e sem energia: sem impasse (a espera mais longa é um vermelho do X, ~70 s).
  - **Retorno do usuário sobre o grupo A (2026-10-01):** "tá muito bom". Pediu (feito na 7.6): mais carros; passadas menos frequentes; marcações no X (havia um trecho grande de asfalto preto); vidro de dentro "praticamente transparente" e com o efeito de vidro "pintado na arquitetura" atrapalhando a vista (pediu um efeito de material, ligado à câmera); a praça do X com piso, mobiliário e telões ("essencial para o distrito"); e luzes que não apagavam no blackout. Os problemas das faixas de pedestre foram para a etapa de bugfix.
  - **7.6, ajustes:**
    - **1500 carros** (`CARS` em `world.ts`, mais 12% na diagonal; antes 300). Ele sugeriu 1000–1500. Com energia o trânsito flui (~1,25 ms por tick); no blackout congestiona, o que o usuário quer ("é um blackout, é suposto dar problemas", desde que não seja bug). Para o desenho: carros a mais de 70 m usam um modelo de 4 peças (`carFarModel`) e os faróis iluminam a rua só até 90 m (`CAR_LIGHT_FAR`); 5× mais carros custam ~1,8 ms a mais no `bench`.
    - **Impasse no blackout com muitos carros, corrigido:** um cruzamento da diagonal no meio da quadra ficava a 8–15 m de um cruzamento da grade, sem espaço para um carro entre as duas paradas, e as paradas obrigatórias se esperavam em círculo. Agora zonas a até 15 m se fundem ao cruzamento (`MERGE`). Teste: 7 min de blackout em 3 sementes, a espera mais longa estabiliza em ~100 s.
    - **Passadas:** uma a cada 1,6 m andando e 2,6 m correndo (antes 0,75 e 1,3).
    - **Blackout: regra central para luzes** (`signPower` em `raycaster.ts`, e `ad`/`adElec` em `wallColumn`): o que é letreiro, publicidade ou decoração (letreiros e placas, marquises, neon, telões, letreiro de notícias, outdoors, anúncios pintados, coroas, holofotes) usa a energia da subestação **sem o gerador**; o gerador de emergência só mantém a luz de dentro (janelas, saguão). O que o usuário viu acender no blackout eram prédios com gerador. **Toda luz decorativa nova deve usar `signPower`/`adElec`.**
    - **Vidro como material** (`glassPass` em `render/interior.ts`): de dentro, tom frio, reflexo de Fresnel (`gC`: mais forte com a janela vista de lado) da luz do cômodo e um brilho suave que segue a direção da câmera (`gH`), só em cor, sem trocar caracteres. De fora (`glassOver`), o reflexo também não troca mais caracteres.
    - **Marcações no X:** as faixas e a linha central da diagonal continuam sobre a avenida, e a borda entre as duas vias ganha uma linha contínua.
    - **A praça do X** (`Block.square`, `furnishSquare`, `facesX` em `city.ts`): quarteirões a até 190 m do centro do X do theater district têm as cunhas como praça até 4.000 m² (`SQUARE_PLAZA`). Piso de granito em xadrez de dois cinzas; mesas de café com cadeiras, floreiras, bancos e lixeiras numa grade de 4 m; e, na cunha maior, uma **arquibancada vermelha iluminada** virada para o X (`steps`, segue a energia da rua). Toda face de rua voltada para o X ganha telão, e as cunhas, o letreiro de notícias. Com a semente 42: 44 mesas, 16 floreiras, 2 arquibancadas.
- **Etapa 7, grupo C (7.12–7.15), feito em 2026-10-01** (o usuário mandou seguir sem pedir confirmação):
  - **Retorno sobre o grupo B:** rodas quadradas (deviam ser pneus com detalhes que mostrem o giro), suspensão quase imperceptível (pediu bem mais mole, "tipo GTA IV"), e vidro dos carros translúcido para ver as pessoas dentro. Feito na 7.12. Os outros pontos foram para "Bugs conhecidos".
  - **7.12, carros:** pneus são elipsoides achatados com material próprio (`Mat.Wheel` em `objects.ts`): de lado, cubo, cinco raios, borracha com banda e uma mancha de sujeira, tudo girando com `Obj.wheel`; de frente, a banda. **Inclinação de verdade:** o raio é girado (e erguido) para o referencial da carroceria (pivô a 0,7 m, ângulos pequenos) e testado contra as peças fora do chão, então a caixa inteira inclina; as rodas ficam no chão. Molas mais moles (rigidez 22, amortecimento 2,6; até ~7° de arfagem e rolagem, buracos com o dobro do tranco). **Vidro translúcido** (`Mat.Glass`): não ocupa a célula; o raio segue até o que está atrás (dentro do carro ou a cidade) e só tinge. Dentro: bancos, motorista à esquerda (`seated` em `models.ts`, roupa e pele por `Car.id`), às vezes um passageiro; viaturas com dois policiais; ônibus com motorista, passageiros e luz no teto; vans e caminhões com motorista na cabine. `Car.id` novo (identidade do veículo).
  - **7.13, ciclistas** (`kind: 'bike'`, 5%, `bikeModel`): na faixa da direita, 4–7 m/s, inclinam para dentro nas curvas (até ~25°), pedalam (as pernas seguem a roda), farolete fraco, sem som de motor.
  - **7.14, pedestres** (`sim/peds.ts`, `world.peds`, `pedModel`): até ~520 no pico (menos de madrugada e 40% menos na chuva), vivos só a até 220 m do jogador; ao passar de 260 m, alguém novo surge a 150–220 m. Andam em volta do quarteirão na calçada (a 0,7–3,3 m do meio-fio) e, em cada esquina, viram ou atravessam (45%) pela faixa (a 2,75 m do cruzamento) até o quarteirão vizinho: esperam o verde do tráfego paralelo, ou, na placa de PARE e no semáforo apagado, olham e vão quando não vem carro a 28 m. Os carros param para quem está na faixa (`crossers`). Desviam do jogador. Ainda evitam os quarteirões da diagonal. Modelo com pernas e braços no passo, roupa e pele pelo `id`, guarda-chuva na chuva (~75%); a mais de 40 m, um modelo de 2 peças; desenhados até 130 m. **Custo:** ~0,2 ms por tick na simulação; ~11,5 ms no `bench` com 82 por perto.
  - **Último retorno da etapa 7 (2026-10-01), corrigido na hora:** o motorista estava no banco do passageiro (o +y do objeto é a direita, não a esquerda) e cada faixa tinha sinal de pedestre só numa ponta. Agora cada poste tem dois sinais (hoje dois objetos `walkSignal`, veja abaixo): um virado para a frente do poste (a faixa ao longo deste tráfego) e outro ao longo do braço (a faixa que cruza a via deste tráfego depois do cruzamento); conferido que as 8 pontas de faixa de um cruzamento têm um sinal virado para elas. O resto foi para "Bugs conhecidos" e "Refinamento: anotações".
  - **7.15, sinal de pedestre e som:** cada poste de semáforo tem o sinal de pedestre virado para o outro lado da rua: aceso no verde do tráfego paralelo, proibido no vermelho, piscando no amarelo, apagado no blackout. Burburinho de vozes (ruído em três bandas com volume que oscila como conversa) pelo número de pessoas a até 30 m.
  - **Sinal de pedestre como letreiro (pedido do usuário em 2026-10-01, no começo da etapa 8):** o homenzinho branco não se lia (era só uma luz branca). Agora o painel diz **GO em verde** ou mostra um **X vermelho** (`walkSignal` em `models.ts`, material `Board` com `bulbs` em `objects.ts`): em lâmpadas da fonte 5×7 até ~6 m (letra com 4 linhas), letras ASCII até ~30 m (basta uma coluna por letra, mesmo menor que uma linha), e depois uma faixa acesa. O painel tem 0,7 × 0,6 m (um pouco maior que um real, para ler do outro lado da avenida). O poste (`SIGNAL_POLE`) e cada sinal são objetos separados; o segundo sinal é o mesmo modelo girado 90°. Custo dentro do ruído do `bench`.
- **Etapa 7, grupo B (7.7–7.11), feito em 2026-10-01** (o usuário mandou seguir sem pedir confirmação):
  - **7.7, tipos de veículo** (`VehicleKind`, `VEHICLES`, `newVehicle` em `traffic.ts`; `vehicleModel` e `VEHICLE_SIZE` em `models.ts`): sedã, táxi (18%), van (10%), caminhão-baú (6%), ônibus (4%) e viatura (4%), cada um com comprimento (`len`, usado em todas as distâncias), aceleração (`acc`) e faixa de velocidade. **Ônibus** andam na faixa da direita, preferem seguir reto e param 10 s em cada ponto de ônibus da calçada do seu lado (`stopsOf`, `busStop`; o abrigo na borda norte de um quarteirão serve a mão leste da rua de cima, e assim em volta). **Viaturas**: ~35% com o giroflex piscando, que joga luz vermelha e azul na rua.
  - **7.8, física** (`stepBody`, `roadGrip`): carroceria em molas (rigidez 60, amortecimento 5,5): arfagem pela aceleração (até ~3°, mais nos grandes), rolagem pela aceleração lateral nas curvas (v × taxa de giro), sobe e desce nas emendas do asfalto a cada ~3 m; rodas girando. **Aderência** pelo clima (seco 0,8, molhado 0,5, neve 0,3): limita a frenagem e deixa os motoristas mais lentos e afastados (`care`). No render (`Obj.pitch/roll/lift/wheel` em `objects.ts`), as peças fora do chão sobem e descem pela posição, e as rodas vistas de lado trocam de glifo (`| / - \`) pelo ângulo. Só a até 70 m.
  - **7.9, batidas** (`reckless`, `overlap`, `crash`, `stepWreck`): motoristas imprudentes furam o vermelho ou a parada (0,015% por parada; 0,4% num semáforo apagado ou numa placa de PARE; ×2,5 de madrugada e mais com chão escorregadio); quem passa a linha no vermelho por não conseguir parar também conta. Só um imprudente bate (teste de retângulos orientados com quem estiver no caminho); os dois trocam momento pelo peso, são empurrados, giram e derrapam até parar no atrito do chão, ficam como obstáculo (os outros param antes) com pisca-alerta e são guinchados depois de 4 min (`TOW`), voltando como carro novo longe do jogador. Evento `crash` na fila (com o cruzamento mais perto) e no letreiro de notícias (`news.crash`). Teste: ~1 batida a cada 4 min na cidade com chão seco; 4 em 2 min na neve; 8 em 2 min no blackout.
  - **7.10, movimento pelo horário** (`RUSH`, `carsWanted`, em `world.ts`): de ~25% de madrugada a 100% nos picos (8–9 h e 17–18 h), entrando e saindo a mais de 300 m do jogador, até 8 por segundo.
  - **7.11, sons** (`Sound.traffic` em `sound.ts`): os 3 veículos mais próximos (até 45 m) têm cada um um motor (dente de serra num passa-baixa que abre com a velocidade, mais grave em ônibus e caminhões), pneus e chiado no molhado; **buzinas** decididas na simulação (`held`/`honk`: parado atrás de alguém no verde por 4 s, ou travado pelo jogador por 1,5 s), ouvidas a até 120 m; freio a ar do ônibus ao parar no ponto; batidas (baque grave, metal amassando, vidro) a até 600 m, atrasadas pela velocidade do som. O teste de ouvido é do usuário.
- **Etapa 7, trânsito: decisões e grupos (2026-10-01).** O usuário decidiu no início:
  - **Batidas reais:** com o semáforo apagado (blackout, depois hacking) ou um motorista furando o vermelho, os carros podem bater de verdade; o carro batido para, forma fila e gera um evento na fila de eventos.
  - **Pedestres ambientes com ID:** andam pelas calçadas e faixas perto do jogador e obedecem o sinal de pedestre; cada um tem um ID fixo, para a etapa 11 ligá-lo a um cidadão com casa e rotina.
  - **Atropelar o jogador:** por enquanto, não (os carros param diante dele, para teste e debug). Quando o jogo estiver mais "gamificado", haverá consequência.
  - **Grupos planejados:**
    - **A:** malha viária como grafo (faixas por sentido, cruzamentos, a diagonal), semáforos por cruzamento ligados à rede elétrica (no blackout apagam ou piscam), carros seguindo faixas com curvas suaves e filas no vermelho, o objeto do semáforo com as lâmpadas acesas, a fila de eventos da simulação, e o conserto das calçadas da diagonal.
    - **B:** tipos de veículo (sedã, táxi, van, caminhão, ônibus com pontos, viatura), **física simples** (suspensão, rodas, aderência pelo clima; veja "Design: física dos carros"), batidas reais e o evento delas, densidade pelo horário, sons (motores, buzinas, pneus no molhado).
    - **C:** pedestres e ciclistas, com o sinal de pedestre e nível de detalhe (longe, a simulação é grosseira).
- **Manchetes de flavor (2026-10-01):** 602 modelos em 13 categorias (`en.json` → `news.flavor`: city, crime, economy, business, transit, fire, tech, culture, sports, health, world, odd, night). `FLAVOR_BY`, `FLAVOR` e `fillHeadline` em `locale/news.ts` servem para reaproveitar em jornais, rádio e rede social. Lacunas: `{biz} {road} {district} {landmark} {seam} {city} {n} {nth} {m} {p} {o}`.
- **Lâmpadas mais longe (2026-10-01):** letreiros, letreiro de notícias, placas e outdoors viram lâmpadas a partir de 1,6 colunas × 1,4 linhas por letra (`BULB_COLS`/`BULB_ROWS` em `signs.ts`, ~28 m num letreiro; antes 3 × 2,6, ~15 m). Com várias lâmpadas por célula, `bulbGlyph` escolhe `@`, `o` ou `:` pela densidade. O painel do elevador desenha os números em lâmpadas a qualquer distância (`digitLamps` em `render/interior.ts`).

- **Etapa 6: decisões e grupos (2026-09-30).** O usuário decidiu no início:
  - **Interiores no mesmo espaço da cidade**, sem carregamento: entrar é atravessar a porta. O custo foi medido (veja abaixo) e ficou mais barato que a rua.
  - **Câmera 3D depois:** fica o raycaster por coluna, com o olho na altura do andar e os telhados desenhados. A câmera 3D entra mais tarde, como subetapa própria (talvez na 10).
  - **Começar por residencial e escritório** (estilos `office`, `glass`, `residential`, `brick`). Histórico, galpão, cilindros e marcos ficam sólidos por enquanto.
  - **Grupos planejados:**
    - **A (6.1–6.3):** planta, porta, entrar, render de dentro, telhados e vista do alto, som abafado (feito).
    - **B:** escadas em que se sobe de verdade e elevadores (alguns de vidro), sem fade.
    - **C:** de fora, os cômodos vistos pelas janelas (batendo com a luz de dentro; feito antes, na 6.4) e as janelas iluminando a fachada (feito na 6.9).
    - **D:** lojas e vitrines abertas, móveis, escadas de incêndio, os outros tipos de prédio (feito na 6.10–6.13, menos galpões, cilindros e marcos).
    - **E (pedido durante a etapa):** fachadas mais complexas, andaimes que abrigam da chuva, muito mais letreiros e publicidade, topos de torre acesos (primeira passada feita na 6.14; o que falta está em "Fachadas: o que ainda falta").
- **Retorno do usuário sobre o grupo A (2026-09-30):** gostou ("tá ótimo"). Pediu correções e novidades, feitas na 6.4: chovia dentro dos prédios; o som devia ficar bem mais abafado, quase sem a chuva, mas com o "tec, tec" das gotas na janela; ver os interiores do lado de fora; os pontos de ônibus não apagavam no blackout; sem chuva debaixo do ponto de ônibus, com a água escorrendo do telhado. Os pedidos de fachada estão em "Pedidos do usuário durante a etapa 6".
- **6.5, elevador (grupo B, 2026-09-30):** dentro da cabine (cômodo `lift`), PageUp/PageDown são os botões: cada toque soma um andar ao destino (`Player.liftTo`), e a cabine sobe ou desce de verdade a até 2,5 m/s, com partida e parada suaves (`stepLift` em `world.ts`). `Player.z` é a altura dos pés (contínua), e o olho é `z + 1,7`. Durante a viagem o jogador fica parado e as portas ficam fechadas (`Inside.closed`); o piso e o teto seguem a cabine (`Inside.z0`). Fora da cabine, PageUp/PageDown continuam sendo o pulo de andar de debug.
  - **6.6, painel da cabine:** de pé na cabine, aparece o painel do elevador no canto da tela (andar atual, sentido e destino, os andares servidos). Os números do teclado digitam o andar, Backspace apaga e Enter confirma (`callLift` e `liftFloors` em `world.ts`). Cada tecla faz um bipe; um andar que não existe faz um bipe grave; a chegada toca um sino de duas notas (`beep` e `ding` em `sound.ts`).
  - **Botoeira na parede da cabine:** um mostrador âmbar sobre duas colunas de botões, perto da porta, em todas as paredes do `lift`; um botão acende enquanto a cabine anda. O painel no canto da tela continua, porque mostra o andar digitado.
  - **Crash corrigido (2026-10-01):** a faixa atrás do núcleo virava cômodo de apartamento com unidade -1 quando a vizinha era o corredor, e a cor da parede saía indefinida (`wallPaint`).
  - **6.7, escadas e som do elevador (2026-10-01):**
    - **Escadas de verdade:** toda caixa de escada é uma escada em U (`stairLocal`, `stairH` e `stairStep` em `sim/interior.ts`). Do patamar junto à porta, um lance sobe pela primeira metade da largura até o patamar do fundo (meio andar acima), e o segundo lance volta pela outra metade até o patamar do andar de cima, logo acima do primeiro. Os pés seguem os degraus (`Player.z`), e o andar é o do pavimento em que se está. O corrimão entre os lances bloqueia, porque a altura nova não pode saltar mais de 0,5 m. Não se desce abaixo do térreo nem se sobe acima do último andar.
    - **Render:** dentro da caixa de escada, as paredes vão um andar acima e um abaixo, e o teto é o do andar de cima. Os degraus são desenhados marchando ao longo do raio sobre as alturas da escada (como um mapa de altura), com a borda de cada degrau marcada. O lance que desce aparece ao lado do que sobe.
    - **Som do elevador:** portas deslizando (ruído grave que cresce e some, com o baque delas se encontrando) ao sair e ao chegar, e o zumbido grave do motor durante a viagem (`doors` e `liftMotor` em `sound.ts`). O teste de ouvido é do usuário.
  - **6.8, fim do grupo B (2026-10-01):**
    - **Elevador de vidro:** ~45% das torres de escritório com mais de 12 andares (`Frame.glass`) têm o núcleo encostado na fachada. A cabine tem 2,4 m de fundo junto ao vidro, atrás de um pequeno hall que sai do corredor, e a parede externa dela é vidro do piso ao teto (`liftGlassAt`). Na viagem, a cidade real passa pelo vidro; de fora, a coluna do poço aparece envidraçada e acesa na fachada (pelo mesmo caminho dos interiores vistos de fora).
    - **Passos:** um a cada passada (0,75 m andando, 1,3 m correndo). São mais secos e claros dentro do prédio, um pouco mais agudos na escada, e com respingo na rua molhada (`step` em `sound.ts`).
    - **Bug dos prédios sem acesso ao corredor, corrigido:** a causa principal não era a diagonal. Em prédios estreitos (corredor junto a uma parede), o núcleo ia para o lado da porta e o saguão era desenhado por cima da escada. Agora o corredor de um lado só fica na parede da porta (a porta abre direto nele), o núcleo sai do caminho do saguão, a porta saguão→corredor fica no trecho do saguão que existe, e uma passada final (`connect`) abre uma porta para todo cômodo isolado (as lojas continuam fechadas). Com a semente 42: de 1.551 prédios sem caminho da porta até a escada, sobraram 24, todos cortados pela diagonal, em que o recorte apagou a escada (esses ficam só com o térreo). 508 lotes não têm porta, por estarem cercados de prédios.

- **Grupo F, segunda passada nas fachadas (2026-10-01).** O usuário escolheu fazer tudo o que faltava, em duas rodadas de teste. Aprovou a 1ª rodada ("está tudo ok"), mas notou a queda de desempenho (veja "Bugs conhecidos").
  - **6.17, andaimes de fachada** (`Building.scaffold`, a altura, e `net`, a cor da tela): em ~45% dos prédios com andaime de calçada e mais de 9 m, o andaime sobe pelas faces da rua, a 1 m da parede (`SCAF_D`), do andaime de calçada até o topo (em prédios baixos) ou até 12–36 m. Desenhado em `wallColumn`, como o relevo: o raio cruza o plano do andaime, e ali há montantes a cada 2,4 m, travessas e tábuas a cada 2 m, diagonais em vãos alternados e, em metade deles, uma tela colorida que vela a parede (verde, azul, branca, laranja, preta). De dentro do próprio prédio o andaime não aparece pela janela (limitação conhecida). Com a semente 42: 120 andaimes.
  - **6.18, theater district** (pedido do usuário, com o letreiro de notícias do Motograph, referência 38):
    - **Tipo de distrito novo, `theater`:** o distrito comercial mais perto do centro (um por cidade; nomes como "{r} Lights" e "{r} Square"). Prédios mais altos (até 45 andares), quase todo térreo com loja (cinemas e hotéis em dobro), postes de vapor metálico e LED, neon em ~70% dos prédios e outdoors em ~45% dos topos (até 140 m).
    - **Telões** (`Building.screen`, um bit por face): em ~60% das faces de rua dos prédios com 14 m ou mais, acima do letreiro (e do letreiro de notícias), até 16 m de largura. Cada um troca de cena a cada 6 s (`screenScene`, `screenPixel`): o nome de uma empresa da cidade em letras de bloco digitando, um "vídeo" de plasma em rampa de glifos, ou faixas de cor varrendo. Pixels de 0,3 m. Iluminam a calçada com a cor da cena (luz dinâmica a até 80 m) e seguem a energia.
    - **Letreiro de notícias** (`Building.ticker`): uma faixa de 9,8 a 11 m que dá a volta no prédio, com as manchetes em lâmpadas âmbar correndo da direita para a esquerda (3,2 m/s); de longe vira letra ASCII e depois uma faixa. Fica em ~35% das cunhas da diagonal dentro do distrito e em 4% dos outros prédios (19 com a semente 42).
    - **Manchetes** (`locale/news.ts`, `tickerText`, modelos em `en.json` → `news`): primeiro o que é real na simulação, ou seja, subestação desligada ("BLACKOUT HITS {distrito}") ou religada há pouco ("LIGHTS BACK ON"), o tempo de agora com a temperatura em °F e a previsão para daqui a 6 h, e a data; depois 5 notícias de flavor por hora de jogo, sem repetir, com nomes de empresas, ruas, distritos, marcos e da zona de fogo que existem. Recalcula quando muda a hora ou a energia. A fila de eventos (etapas 7 e 12) vai alimentar o mesmo letreiro. A fonte de lâmpadas ganhou pontuação (`, : ! ? / + $ % ( )`).
    - **Custo:** ~9,9 ms no `bench` no meio do distrito.
  - **6.15, letreiros e publicidade:**
    - **Outdoors no telhado** (`Building.board: Board`, com a empresa anunciada, posição, largura, altura e a altura das pernas; `billboard` em `city.ts`): ~14% das caixas de topo com 7–90 m, menos no distrito histórico e nas torres com coroa; nunca onde já há uma caixa-d'água ou casa de máquinas na frente. Fica 1,5 m para dentro da face mais larga voltada para a rua, de frente para ela. Desenhado como objeto (`boardModel` em `models.ts`), até 500 m (`BOARD_FAR`): painel, pernas e travessas de aço, passarela com corrimão e luminárias que acendem à noite com a energia do prédio. O material novo `Mat.Board` (`objects.ts`) escreve o nome da empresa na horizontal, lido da esquerda para a direita pela frente: em lâmpadas de bloco 5×7 de perto, em letra ASCII de longe e numa faixa mais longe ainda. As cores são as dos anúncios pintados (`AD_BG`/`AD_FG`), e a luz das luminárias vem de baixo. Os objetos ganharam `z0` (a altura da peça mais baixa), para não varrer linhas do chão até o telhado. Com a semente 42: ~370 outdoors.
    - **Placas verticais altas:** hotéis e cinemas em prédios altos o bastante usam letras de 1,5 m (`BLADE_TALL`; o tamanho da letra vai em `Prop.z1`), com 4 braços e lâmpadas subindo pelas duas bordas da frente (`chase`), seguindo a energia. Com a semente 42: 58.
    - **Contornos de neon** (`Building.neon`, a cor): tubos nas quinas e na linha do telhado, com halo na parede; ~35% deles têm um trecho apagado que corre. ~18% dos prédios do comercial, 8% do financeiro e 3% do residencial. Seguem a energia e quase somem de dia.
    - **Custo:** dentro do ruído do `bench` (~10 ms com e sem, numa rua comercial).
    - De quebra, o fundo da tecla B passou a começar em 1/3 (0,24), a pedido do usuário.
  - **6.16, forma das fachadas:**
    - **Relevo** (`reliefOf` e `REL` em `raycaster.ts`): peças que saem da parede, repetidas a cada P vãos: bay windows de 2 vãos e 0,6 m em parte dos prédios de tijolo sem escada de incêndio (`feat` de 0,45 a 0,8), bay windows de 1 ou 2 vãos e 0,7 m em parte dos residenciais (`feat` ≥ 0,6), as pilastras dos históricos (0,25 m) e os pilares art déco dos escritórios (0,3 m). Por coluna, `wallColumn` acha onde o raio encontra a peça (frente ou lateral, entre as alturas dela); nessas linhas, o ponto ao longo da face, a profundidade e a luz mudam (a lateral fica mais escura). Só no nível detalhado, e nunca a menos de 0,5 m de uma quina. Os interiores vistos pela janela da bay window usam a planta de trás, como antes.
    - **Padrões de janela por prédio** (`PATS`): `@#%`, `8o:`, `XZ+`, `0o=` e `H#=`, como nas referências 28–30; ~35% dos prédios têm uma segunda cor de janela (a de `sign`) em faixas de 1 a 3 andares.
    - **Sacadas variadas** (residenciais): grade em todo andar, parapeito sólido em andares alternados, vidro empilhado em pares de vãos, ou uma laje contínua.
    - **Custo:** ~0,5 ms a mais (~5%) no `bench` numa avenida.
- **Grupo E, fachadas, primeira passada (6.14, 2026-10-01), feito sem rodada de teste, a pedido do usuário:**
  - **Dados na simulação** (em `Building`, decididos por `hash3` da posição no fim da geração de cada quarteirão, então o resto da cidade não muda): `crown` (cor com que o topo é banhado à noite; ~55% das torres de escritório, vidro ou históricas com mais de 22 andares, cada recuo com a sua), `shed` (andaime de calçada; ~7% dos prédios com interior) e `ad` (empresa anunciada num painel pintado; ~30% dos prédios de tijolo, residenciais e galpões com mais de 10 m). Com a semente 42: 43 coroas, 529 andaimes, 1055 anúncios.
  - **Coroas acesas** (`CROWN_H` = 16 m em `raycaster.ts`): a luz sobe dos 16 m de baixo até o topo, segue a energia do prédio e quase some de dia. Funciona em qualquer distância, então aparece no horizonte.
  - **Detalhes de fachada** (só no nível detalhado, depois das janelas): cornija com dentículos no topo (menos vidro, galpão e histórico, que têm a sua), cinta a cada 4–6 andares, verga e peitoril de pedra nas janelas de tijolo, pilares art déco em ~40% dos escritórios e base de pedra no térreo de escritórios e residenciais sem loja.
  - **Anúncios pintados:** num painel no alto de uma face sorteada (até 16 m de largura e 5,5 m de altura, logo abaixo do topo), com o nome da empresa em letras de bloco 5×7 de 1,25 m (a mesma fonte das lâmpadas dos letreiros, `bulbOn`), cores de tinta sorteadas (`AD_BG`/`AD_FG`), tinta gasta e luz de baixo à noite (luminárias em pescoço de ganso, seguindo a energia). O painel cobre as janelas que houver atrás (por dentro elas continuam).
  - **Andaimes de calçada** (`shedModel` em `models.ts`, `gatherRoofs` em `raycaster.ts`): nas faces voltadas para a rua, um deck de compensado verde a 3 m, com 2,6 m de profundidade, sobre postes de aço do lado do meio-fio, com uma lâmpada a cada trecho de ~4,8 m. Desenhados como objetos até `SPRITE_FAR`. Cada face com andaime é um telhado de chuva (`Roof`): debaixo não chove e a água pinga da borda (nos trechos internos as pontas também pingam; ver bugs). Os postes ainda não são sólidos.
  - **Custo:** no `bench`, ~12 ms diante de um andaime na rua comercial (com tudo o mais da etapa 6).
- **Fachadas: o que ainda falta** (depois do grupo F): anúncios e telões que mudam com a simulação (etapas 12 e 13); notícias reais da fila de eventos no letreiro (etapas 7 e 12).
- **Grupo D (6.10–6.13, 2026-10-01), feito sem rodada de teste, a pedido do usuário:**
  - **6.10, lojas abertas:** cada loja do térreo (cômodo `shop`) ganha a própria porta de vidro na vitrine, um vão no meio da frente dela, se houver chão livre na frente (`Plan.exits`, `exitsOf`). A colisão aceita qualquer porta de rua, e a fachada desenha todas, desde que a planta do térreo já exista (perto do jogador). As lojas continuam sem ligação com o saguão, e as luzes delas ficam acesas em ~80% dos casos.
  - **6.11, móveis** (`furnish` e `Furn` em `sim/interior.ts`, `furnitureModel` em `models.ts`): por tipo de cômodo há cama com criado-mudo e abajur, sofá com mesa de centro, TV, mesa de jantar, planta, bancada de cozinha e geladeira, banheira e vaso, escrivaninha com monitor aceso e cadeira (em fileiras nas plantas abertas), estante, prateleiras de loja com produtos coloridos, caixa com tela verde e recepção. Cada peça vai contra uma parede (ou numa grade), só onde o chão e uma faixa à frente são do cômodo, longe das portas e das outras peças. São sólidas (`inFurniture` em `blocked`) e são desenhadas como objetos com volume (`drawObjects` com `mul`: a luz da lâmpada do cômodo multiplica as cores) só no andar do jogador. Não aparecem nos interiores vistos de fora. Um objeto tem no máximo 32 peças (`P` em `objects.ts`).
  - **6.12, prédios históricos com interior:** janelas altas em arco; o térreo de base rusticada não tem janelas (só as vitrines, quando há loja). Ainda sem interior: galpões (andares de 5 m), cilindros e marcos.
  - **6.13, escadas de incêndio em que se sobe** (`escapesOf`, `escapeAt` e `escapeZ` em `sim/interior.ts`; `drawEscapes` em `raycaster.ts`): nos prédios de tijolo onde a fachada as desenha (2 vãos a cada 7, nas faces com chão livre na frente). Há um patamar de grade em cada andar, com 1 m de fundo e corrimão. Os lances sobem em zigue-zague na metade de fora: os pares na faixa de 0,45–0,72 m da parede, os ímpares na de 0,72–1 m, então subir e descer ficam lado a lado e entrar na faixa de um lance é subir (ou descer) por ele. Não se anda para fora da escada no ar. Num patamar dá para entrar no apartamento pela janela da escada (e sair por ela). De perto (50 m), cada andar da escada é desenhado como objetos de ferro. O desenho antigo na fachada continua por trás.
  - Corrigido de quebra: objetos acima do olho tinham a linha de baixo calculada errada (`objects.ts`).
- **Retorno do usuário sobre a 6.9 (2026-10-01):** aprovou, com três correções, feitas logo em seguida: a escada ficava "transparente" dependendo do ângulo (os degraus só eram desenhados de dentro da caixa de escada); o andar de cima só aparecia ao terminar de subir; o vidro estava sutil demais. Agora os degraus são desenhados em qualquer coluna que cruza a caixa de escada (de fora, pela porta), no térreo o segundo lance é um bloco sólido, e passando do patamar do meio o render já usa o andar de cima (`viewFloor` em `main.ts`; a colisão continua no andar dos pés). O vidro ganhou tom mais forte e reflexos mais largos e brilhantes (`:` e `/` nas faixas). Depois, o usuário mandou seguir para o grupo D sem esperar o teste.
- **6.9, botoeira clicável, vidro e grupo C (2026-10-01):**
  - **Botoeira única e clicável** (pedido do usuário: a botoeira se repetia pela cabine): uma só, na parede comprida de coordenada menor da cabine, centrada nela, lida da esquerda para a direita por dentro (`panelPaint` em `render/interior.ts`). Tem um mostrador âmbar com o andar atual e um botão numerado por andar servido (4 colunas acima de 12 andares, o térreo embaixo); o destino acende. Cada dígito vai só na célula que contém o centro dele. **Clique esquerdo** aperta o botão sob a mira (uma `+` aparece no centro da tela dentro da cabine); o render anota o botão da célula central (`pickedButton`). O painel no canto da tela e a digitação pelo teclado saíram. PageUp/PageDown continuam como pulo de andar de debug.
  - **Vidro com cor e reflexo** (pedido do usuário: o vidro parecia totalmente transparente): visto de fora (`glassOver`), o interior fica atrás de um leve tom azul-esverdeado, com faixas diagonais de reflexo do céu e da cidade (`sheenAt`, as mesmas da fachada de vidro), mais fortes de dia; nas faixas mais claras sobre um fundo escuro aparece `/`. Visto de dentro (`glassPass`), a cidade fica tingida, com o reflexo da lâmpada do cômodo mais forte nas faixas.
  - **Grupo C:** a luz de um cômodo aceso se espalha na parede em volta da janela (até ~1,5 m do centro dela), com a cor da lâmpada do próprio cômodo (`roomGlow`). As lojas acesas jogam luz quente na calçada em frente (segmentos de luz dinâmica só nas faces voltadas para a rua, a até 60 m).
  - **Custo:** no `bench`, a fachada de tijolo do começo da semente 42 ficou em ~11,7 ms (com interiores e luz das lojas desligados, 9,4 ms nesta medição; a máquina varia bastante entre sessões); a torre de vidro, ~7,5 ms.
- **6.4, correções e interiores vistos de fora (2026-09-30):**
  - **Chuva dentro:** nas colunas em que uma parede interna fecha a vista (sem janela), a chuva não é mais desenhada (`nearT` = infinito).
  - **Som:** dentro do prédio, a rua passa por um passa-baixa de 220 Hz e cai para 28%. A chuva quase some, e no lugar entram gotas batendo no vidro, uma a uma: ruído de poucos milissegundos num passa-banda de 2,2–5,2 kHz, com volume e pan sorteados, mais frequentes quanto mais forte a chuva (`drop` em `sound.ts`). O teste de ouvido é do usuário.
  - **Pontos de ônibus e orelhões** seguem a energia da subestação do lugar (`poweredFurniture` em `models.ts`).
  - **Abrigo da chuva** (`Roof` e `underRoof` em `precip.ts`, `gatherRoofs` em `raycaster.ts`): os telhados dos pontos de ônibus a menos de 40 m tiram as gotas e os respingos debaixo deles, e a água pinga das bordas (a frente aberta e as pontas). O andaime vai usar o mesmo mecanismo.
  - **Interiores vistos de fora** (`peekInto` e `peekCell` em `render/interior.ts`, ramo novo em `wallColumn`): até 80 m (`PEEK_FAR`), e só no nível detalhado da fachada, cada célula de janela continua o raio para dentro da planta daquele andar: parede do fundo, piso ou teto, com a luz do próprio cômodo. Por coluna e prédio, a planta é percorrida uma vez para o térreo e uma para os andares de cima (que são iguais).
    - **A luz bate com a de dentro:** o cômodo aceso visto de fora é o mesmo aceso por dentro (`roomLamp`, usado pelos dois lados). Além de 80 m continua o sorteio por janela antigo, então o padrão pode mudar um pouco ao se aproximar.
    - **Geração aos poucos:** no máximo 4 plantas novas por quadro (`PLANS_PER_FRAME`); até lá a janela usa o desenho antigo. O cache guarda até 4000 plantas e descarta as mais antigas (`PLAN_KEEP`). `lotOf` liga cada caixa (inclusive os recuos) ao seu lote.
    - **Custo:** quase nenhum. No `bench`, diante de uma fachada de tijolo, 7,1 ms (antes ~7–8 ms); diante de uma torre de vidro, 6 ms.
- **6.1–6.2, plantas e render de dentro (2026-09-30):**
  - **Simulação** (`sim/interior.ts`):
    - Cada andar é uma grade de células de 0,4 m (`CELL`) com o índice do cômodo; a parede é a divisa entre cômodos diferentes; a porta é o bit `DOOR` nas células dos dois lados. As paredes ficam em múltiplos de `BAY` (1,6 m, agora exportado de `city.ts`), na mesma grade das janelas da fachada.
    - `Building.tier` (novo): 1 é o volume térreo do lote (o que tem porta e andares), 2+ são os recuos da torre, 0 são peças de telhado e de marcos. `tiersOf` acha os recuos, e `storeyBox` diz qual caixa cada andar ocupa.
    - **Moldura do lote** (`frameOf`): eixo longo, corredor central de 1,6 m (ou junto a uma parede, se o prédio é estreito; nenhum abaixo de 7 m) e o núcleo (escada de 2 vãos e elevador de 1 vão se o prédio é de escritório ou tem mais de 5 andares), igual em todos os andares e recuos, para a escada alinhar. O núcleo fica do lado oposto à porta; atrás de um núcleo raso entra um cômodo da unidade vizinha.
    - **Porta de rua** (`doorOf`): um vão na face mais perto da rua que tenha chão livre na frente; no meio da face, ou perto de uma ponta quando o térreo é loja. Dá para o saguão, que liga ao corredor.
    - **Unidades:** apartamentos de 4–7 vãos (hall de entrada, banheiro, cozinha, sala, quarto, com portas entre eles) ou escritórios (planta aberta ou salas de 2–3 vãos). No térreo de prédio com loja, as lojas são cômodos fechados por enquanto. Os andares de uma caixa acima do térreo são iguais (cache por caixa).
    - **Colisão** (`blocked`, usada por `stepWorld`): o passo do centro do jogador até cada sonda é verificado em pulos de 0,1 m; a parede externa só se atravessa pela porta e no térreo. `Player.floor` e `Player.inside` são novos.
  - **Render** (`render/interior.ts`):
    - Por coluna, o DDA anda nas células da planta: troca de cômodo sem porta é parede inteira; com porta, só o lintel (acima de 2,2 m) e segue. A parede externa fecha a coluna, com as janelas do mesmo jeito da fachada (`windowHole`, por estilo), a porta de rua aberta e **paredes cegas** onde um prédio vizinho encosta (até a altura dele).
    - Piso, teto e paredes por tipo de cômodo: tábuas, ladrilhos, mármore no saguão, carpete e forro com luminárias no escritório, papel de parede por apartamento, lambri no corredor, rodapé e peitoril.
    - **Luz:** lâmpadas a cada ~4 m (`lampD2`). As partes comuns ficam sempre acesas, os cômodos acendem pelo `lit` do prédio, e **o cômodo onde o jogador está acende**, como se ele achasse o interruptor. Tudo segue a energia do prédio (o blackout apaga). Ambiente fraco de noite, forte de dia.
    - **Vidro:** a cidade aparece pelas janelas, um pouco escurecida, com o reflexo da lâmpada e, na chuva, gotas escorrendo e paradas no vidro. A chuva que cai não é desenhada dentro do cômodo (`nearT` em `drawFall`).
    - Na fachada, a porta de rua aparece com batente, duas folhas de vidro e bandeira, acesa pelo saguão.
  - **Custo** (`bench`, 256×80): dentro de um apartamento 4–7 ms, no corredor 4 ms, na rua 7–8 ms. O andar é desenhado antes da cidade, e a cidade só preenche as janelas.
- **6.3, vista do alto e som (2026-09-30):**
  - **Telhados** no raycaster (`roofRows`): quando o olho está acima de um prédio, o telhado vai da borda da frente até a de trás, ou até uma caixa mais alta em cima dele (recuo, caixa-d'água). O teste que pula quarteirões usa a borda de trás quando o olho está acima.
  - **PageUp/PageDown** (debug, `debugFloor`) trocam de andar dentro do prédio. A faixa de chuva acompanha a altura do olho.
  - **Som:** tudo o que é de fora passa por um passa-baixa (480 Hz) e cai pela metade dentro do prédio; a chuva vira um tamborilar no vidro, e os escritórios têm o zumbido das lâmpadas fluorescentes (segue a energia).
  - **Custo:** do 40º andar, ~9 ms no `bench`.
  - **Limitações conhecidas:** atrás de uma caixa-d'água ou de um recuo, o resto do telhado não é desenhado (aparece o chão); olhando muito para baixo, as fachadas viram faixas verticais (y-shearing, até a câmera 3D); prédios cortados podem ter cômodos recortados ou sem porta.

- **Retorno do usuário sobre 4a–4c (2026-09-30):** boas impressões. Escolheu a paleta de sódio e pediu o fundo sólido mais escuro. Não viu pop-in; os objetos distantes deformam, o que é esperado. Pediu lixo espalhado (copos, papéis), e não só montes de entulho, e o entulho longe da calçada. Viu o FPS oscilar (80–180, com uma queda a 40).
  - **Causa da oscilação:** os objetos da 4b chegavam a 26 ms por quadro. Um objeto muito perto tinha a tela inteira como área de busca, e cada célula testava todas as peças. Corrigido com um recorte por coluna em `drawObjects`: o raio da coluna contra o círculo que envolve o objeto dá o trecho de profundidade [ta, tb] e, dali, só as linhas possíveis; células já cobertas mais perto que `ta` são puladas. O quadro inteiro caiu para 2–7 ms, e os objetos para ≤ 3 ms. O recálculo do mapa de luz custa ~2 ms.
  - A linha de status agora mostra `DRAW x ms (MAX y)`: o tempo médio de desenho do mundo e o pior do último segundo. É o número a observar, porque o FPS fica preso ao monitor.
  - Em modo dev, `bench(n)` desenha a vista atual n vezes numa grade 256×80 própria e devolve os ms médios. Funciona mesmo com o painel oculto, quando o laço de quadros para.
  - **Lixo:** é desenhado no próprio chão, no passe do solo (`LITTER` em `raycaster.ts`), preso a quadrados de 0,5 m pelo `hash3`: sacolas, copos, latas, papel, jornal, papelão e bitucas. Fica mais denso na sarjeta (1,2 m junto ao meio-fio) e nas calçadas do industrial, e só aparece até 14 m (`LITTER_FAR`).
  - **Entulho:** agora só nos lotes vazios, dentro do quarteirão.
  - Depois do teste: o fundo passou a ter estágios na tecla B. O lixo ganhou formas (discos, retângulos girados, peças compridas como latas e garrafas deitadas) e 17 tipos de cores sóbrias, dentro da paleta de sódio.
- **4d feita (2026-09-30), junto com o grupo 4d–4f para teste:** letreiros com o nome real da empresa.
  - **Empresas na simulação:** `Business { kind, building, name }` em `city.businesses`, com uma empresa por loja térrea (`Building.biz`, ou -1). O tipo (diner, bar, pharmacy, pawn, cinema, hotel etc.) sai de `SHOPS` pelo tipo de distrito. Tipo e nome vêm do `hash3` da posição do prédio, então não mudam a geração do resto. A simulação guarda só números; as palavras (modelos por tipo, sobrenomes, marcas) ficam em `en.json` e são montadas por `businessName` em `names.ts`.
  - **Letreiro** (`render/signs.ts` e o ramo de sinal em `wallColumn`): faixa a 2,6–3,4 m, com o nome centralizado em cada face da caixa. Se o nome não cabe, usa a palavra mais longa, cortada. Letras de 0,55 m, cada uma desenhada só na célula que contém o seu centro; o resto da faixa brilha na cor do neon. Longe, vira uma barra acesa. O sentido de leitura é invertido conforme o lado de onde se olha (`rev`), e `dAlong` (metros de fachada por coluna, que cresce quando a face é vista de lado) decide se as letras cabem.
  - **Letras de lâmpadas (pedido do usuário em 2026-09-30):** de longe, o letreiro se lê como texto ASCII, o que o usuário gostou. De perto (ajustado a pedido dele), quando uma letra ocupa pelo menos 4 linhas e 3 colunas (até ~9,5 m de frente), ela é desenhada com o padrão de lâmpadas de uma fonte 5×7 (`FONT` e `bulbOn` em `signs.ts`). Cada célula conta as lâmpadas cujo centro cai na área dela (intervalo meio-aberto, para cada lâmpada cair numa célula só): uma vira `o`, duas ou mais viram `@`. Em volta de cada lâmpada fica um brilho, e entre elas o painel liso. O padrão espelha quando visto do outro lado.
  - **Efeitos** (funções puras de empresa e tempo): aceso fixo, letras acendendo em sequência, piscando, tubo morto ou falhando em rajadas (`signStutter`, que o áudio vai seguir) e marquise com lâmpadas correndo (cinema e hotel).
- **4e feita:** a luz dos postes (o mesmo `LightWindow` do chão) é consultada no ponto atingido das fachadas (andares baixos, sumindo até 9 m, `LIT_H`) e dos objetos (mais forte nos topos). Um carro acende ao passar sob um poste.
- **4f feita:** `src/audio/sound.ts`, todo sintetizado com Web Audio: rumor da cidade (ruído grave com corte que oscila), zumbido de 120 Hz do poste mais próximo (até 8 m), zumbido do neon mais próximo (até 16 m) que segue `signLight` e corta e estala com `signStutter`, e ronco grave perto da borda (até 300 m). As fontes próximas têm pan estéreo. O áudio nasce no clique de entrada (regra dos navegadores). A tecla **M** liga e desliga.
- **Pedidos durante o teste de 4d–4f (2026-09-30), já feitos:**
  - **Letreiros:** a troca entre lâmpadas e letras ASCII fica a ~15 m, no meio de uma avenida vista da calçada oposta (a letra com pelo menos 2,6 linhas e 3 colunas). Mais perto, lâmpadas; mais longe, texto ASCII.
  - **Postes que falham** (`render/lamps.ts`), com base para o blackout: cada poste tem identidade na simulação (`city.lamps`, índice fixo, que a rede elétrica da 5b vai usar). O estado vem de uma função pura, como a dos letreiros: 88% estáveis, 6% em ciclo de lâmpada de sódio no fim da vida (pisca, apaga, fica 4 s frio e reacende em 9 s, do vermelho fraco ao âmbar), 3% piscando em rajadas e 3% queimados. Esse aquecimento é o mesmo que todos os postes farão quando a energia voltar depois do blackout. O `LightWindow` guarda qual poste ilumina cada metro, e a luz no chão, nas paredes e nos objetos segue o estado dele; a cabeça do poste muda de brilho e de cor, e o zumbido segue (silêncio se apagado, corte e estalo se falhando).
  - **Luzes dinâmicas** (`render/lights.ts`): a cada quadro, os faróis dos carros (cone de 24 m à frente), as lanternas (brilho vermelho de 4 m atrás) e os letreiros (uma faixa na cor e no ritmo deles, que ilumina a calçada em frente e a parede em volta) entram numa lista organizada em baldes de 8 m. O chão, as fachadas e os objetos pedem toda a luz de um ponto a `lightAt(x, y, z)`, colorida. Custa ~2 ms a mais por quadro (o quadro fica em 2,5–9 ms).
- **Tipos de poste (pedido em 2026-09-30, feito):** `Prop.lampType` na simulação, um tipo por lado de quarteirão, sorteado por distrito (`LAMPS` em `city.ts`): sódio de alta pressão (âmbar, a maioria), vapor metálico (branco, centro e comércio), mercúrio (branco-esverdeado, bairros antigos), sódio de baixa pressão (amarelo intenso, industrial) e LED piloto no centro (sem aquecimento e sem zumbido). As cores e o aquecimento ficam em `LAMP_LIGHT` (`lamps.ts`); o `LightWindow` guarda a cor de cada poste por quadro (`add`).
- **Luz por letra (pedido do usuário, feito em 2026-09-30):** a letra que falha afeta a luz do letreiro. A primeira tentativa, uma luz por letra, dobrou o tempo de desenho (8,5 → 20 ms), porque cada ponto somava dezenas de luzes. A versão final mantém **uma luz por face** (`DynLights.pieces` em `lights.ts`) que carrega o brilho de cada letra em somas acumuladas. Cada ponto pega a média das letras em volta do ponto mais próximo da faixa, num trecho que cresce com a distância (0,3 m + metade da distância): colado na parede, só a letra da frente conta (a parede atrás de uma letra morta cai de 94 para 37); na calçada, a 3 m, a diferença quase some. Só vale para letreiros a menos de 40 m (`SIGN_LETTER_LIGHT`); mais longe, e quando todas as letras estão iguais (letreiro fixo ou piscando), é um segmento comum. Custo: até ~1,5 ms a mais no `bench` parado na frente de um letreiro; o quadro real ficou em ~3,3 ms.
- **Etapa 4 fechada (2026-09-30):** o usuário testou 4d–4f e aprovou tudo ("os sons e as luzes estão ótimos"; não precisa mais mexer).
- **Etapa 5, primeiro grupo (5.1–5.3), feito e aprovado em 2026-09-30.** O usuário pediu que as diagonais viessem já, "antes de causar problemas", e junto as placas perpendiculares e os holofotes, porque a base para isso já existia. A numeração com ponto (5.1, 5.2…) evita confusão com a 5b, que continua sendo o blackout.
  - **5.1, avenida diagonal** (`Diagonal` em `city.ts`, `city.diagonal`): uma por cidade, reta, de borda a borda. Passa perto do centro a 18–32° das avenidas, com 21 m de largura e calçada de 4 m. Tem gerador próprio (`placeDiagonal`), então a grade e os distritos não mudam. `diagS(d, x, y)` dá a distância com sinal até a linha central. O nome ("{r} Way") vem de `diagonalName` e aparece no cabeçalho quando se está nela.
    - **Prédios cortados:** um lote que a diagonal atravessa vira **caixa ∩ semiplano** (`Building.cut: Cut`, com a normal para fora, `c` e a extensão `u0..u1` da face cortada). Uma caixa que atravessa a avenida inteira vira dois prédios. Cilindros que encostam na faixa e sobras com menos de 40 m² são tirados (`cutByDiagonal`). Os telhados e as camadas das torres são cortados pelo mesmo plano, então ficam coerentes. Nas quinas agudas ficam as cunhas estilo Flatiron. Com a semente 42: 107 prédios cortados, 26 quarteirões atravessados e 7 praças.
    - **Interiores (lembrete do usuário em 2026-09-30):** os prédios cortados **também terão interior** na etapa 6. A pegada deles é um polígono convexo exato (4 ou 5 lados: a caixa recortada pelo semiplano), e é esse o dado que a divisão em andares e cômodos deve usar, não um caso especial.
    - **Raycaster:** o teste da caixa ganha o semiplano (`side` 3 = face diagonal). `faceSpan(B, face)` dá a extensão real de cada face (0/1 = x0/x1, 2/3 = y0/y1, 4 = cortada), usada nos cantos, nos letreiros e nas luzes deles. A face cortada é medida ao longo de (ny, −nx), que lê da esquerda para a direita, então nunca precisa de `rev`.
    - **Chão:** asfalto com linha central amarela e faixas em `/` ou `\`; nos cruzamentos o asfalto é liso. As ruas que chegam à diagonal terminam com faixa de pedestre. Os pedaços de quarteirão com menos de 1200 m² (`PLAZA_AREA`) viram praça de lajes (`Block.diag`, bits 2 e 4), como a Times Square e a Herald Square. Os postes vêm dos dois lados, a cada 28 m (`diagonalLamps`), e o mobiliário que caía na pista foi tirado.
    - **Ainda não:** carros na diagonal (etapa 7, trânsito), curvas ou segunda diagonal.
  - **5.2, placas perpendiculares** (`blade` em `Prop`, `bladeSign` em `city.ts`, `bladeModel` em `models.ts`, material `Mat.Text` em `objects.ts`): um painel vertical num braço de aço, saindo da fachada (lado da calçada ou face diagonal), perto de uma ponta, com as letras empilhadas de cima para baixo (lêem igual dos dois lados). Hotel, cinema e estacionamento sempre têm; bar e penhor às vezes, e café, diner, farmácia e loja de bebidas menos (`BLADE`). O texto vem de `bladeText` (`en.json`, `blade`): o tipo (BAR, PAWN, PARK, EAT…) ou, em hotéis e cinemas, a palavra mais marcante do nome. A placa pisca junto com o letreiro da empresa (`signLight`) e ilumina a calçada (luz pontual em `gatherLights`). Novo tipo de empresa: **`parking`** (garagem), no financeiro e no comercial. Com a semente 42 são 334 placas, que custam ~0,8 ms com uma bem na frente.
  - **5.3, holofotes de fachada** (`Building.flood`, a cor, e `floodH`, a altura que a luz alcança): são dados da simulação, para a rede elétrica da 5b poder apagar. Prefeitura, igreja e torre do relógio sempre têm, em luz quente; parte dos prédios históricos também (30% no distrito histórico). Parte das torres de vidro e de escritório do centro financeiro tem luz branca fria ou colorida (azul, violeta, verde-água), subindo 30–90 m (`floodFor`). No render, os refletores ficam a cada 6 m na base (`FLOOD_GAP`), cada um um cone que se abre para cima (0,35 m + 0,18 por metro de altura). O desenho de "vieiras" aparece até uns 3 andares e depois se funde. Longe, usa a média, sem tremer. Com a semente 42 são 95 prédios com holofote.
  - **Retorno do usuário sobre 5.1–5.3 (2026-09-30):** tudo certo, exceto o bug das calçadas da diagonal (veja "Bugs conhecidos"), que fica para depois.
  - **5.4, lâmpadas e símbolos nas placas perpendiculares** (pedido do usuário): de perto, as letras das placas perpendiculares viram lâmpadas, como nos letreiros de fachada. Também ganharam um **símbolo** em cima, de 9×9 lâmpadas (`SYMBOLS` e `BLADE_SYMBOL` em `signs.ts`): P num círculo (estacionamento), as três bolas do penhor, uma cruz (farmácia) e uma taça (bar). A contagem de lâmpadas por célula é a mesma dos letreiros (`bulbsIn`) e lê da esquerda para a direita dos dois lados. De longe viram glifos; mais longe, uma barra acesa.
    - De quebra, foi corrigido um erro em `drawObjects`: a área de tela dos objetos dividia por `plane` duas vezes. No jogo `plane` ≈ 1,04, então o efeito era pequeno (objetos na borda da tela podiam perder uma lasca).
  - **Pedido para mais tarde:** pesquisar na internet fotos de placas de negócios reais e de fachadas (Times Square etc.) e salvar como referência. O usuário disse que isso fica para a etapa de interiores (6) ou para o refinamento visual (15).
- **Etapa 5, grupos A e B do clima (5.5–5.9), feitos e aprovados em 2026-09-30.** O usuário pediu para ir direto ao clima e acrescentou as **nuvens**: céu limpo, nuvens parciais e cobertura total na chuva e na tempestade, com a luz da cidade batendo embaixo delas.
  - **5.5, relógio e clima na simulação.**
    - `sim/clock.ts`: o tempo do jogo (`world.time`, em segundos desde 2008-01-01 00:00, e `ptime` para interpolar) corre `TIME_SCALE` = 30× (um dia = `DAY_REAL_MIN` = 48 min reais, como pedido). O calendário é o real de 2008 (bissexto; 1º de janeiro foi terça). Cada semente começa num dia de 2008, às 21h.
    - Sol e lua são calculados para 41°N (`sunDir`, `moonDir`, com elevação e azimute a partir do norte). A lua segue o sol atrasada pela fase, e a fase (`moonPhase`) parte de uma lua nova real (2008-01-08 11:37 UTC).
    - `sim/weather.ts`: `forecast(seed, t)` é uma função pura, então a mesma semente dá o mesmo tempo, e a previsão futura é só olhar adiante (útil para o app de clima). Tem nebulosidade (sistemas de ~14 h e pancadas de ~3 h), precipitação, temperatura por estação e hora (−1 °C em janeiro, 25 °C em julho), vento e neve abaixo de 1 °C.
    - `stepWeather` integra o que fica no chão: `wet` (a rua molha em minutos e seca em horas) e `snowCover` (acumula em ~2 h de neve e derrete acima de 0 °C). `lightning(seed, t, precip)` dá o clarão e o número do raio.
    - **Teclas de debug:** **T** avança 1 h (Shift+T volta; também serve de base para dormir) e **Y** percorre os presets (`PRESETS`: clear, partly, overcast, drizzle, rain, storm, snow) e volta para AUTO. A linha acima da de status mostra data, hora e clima.
  - **5.6–5.7, céu** (`render/sky.ts`, `skyColumn` por coluna, `prepareSky` por quadro):
    - **Gradiente pelo sol:** a noite continua sendo o visual principal. O entardecer e o amanhecer são coloridos, mais fortes do lado do sol. O dia é claro, enevoado e dessaturado.
    - **Dia ("visual de serviço"), provisório:** em `finish`, o mundo clareia e se perde numa névoa pálida com a distância; ~75% das janelas apagam (`litK`). Os postes têm **fotocélula** (`photocell` em `lamps.ts`): acendem um a um ao entardecer, com o aquecimento de sódio (do vermelho ao âmbar), e apagam ao amanhecer; o zumbido segue.
    - **Estrelas:** somem com a luz do dia e atrás das nuvens.
    - **Nuvens:** uma camada a 1200 m (`CLOUD_H`) com ruído em 3 escalas que corre com o vento, **só em cor** (sem glifos, a pedido). As escalas finas são descartadas perto do horizonte, para não tremer. A cobertura vem de `weather.cloud`, e com 100% o céu fecha. Por baixo, as nuvens recebem a **luz de sódio da cidade** (redonda e apagada, seguindo a energia) e o vermelho da cratera do Sarcófago (`glowBelow`); o anel das brasas está desligado (`SEAM_LIGHTS_CLOUDS`). Na chuva a camada fica mais clara. O céu distante vira uma névoa aquecida pela cidade. De dia as nuvens são cinza, no entardecer são pintadas do lado do sol, e a lua prateia as bordas finas. O relâmpago as acende por dentro.
    - **Lua:** disco grande (raio de 3,4°, exagerado de propósito), com a fase certa (o crescente acende à direita), mares por ruído, luz cinérea fraca, halo e visibilidade através das nuvens finas. `SkyFrame.moonlight` já dá a força do luar para o blackout da 5b.
  - **5.8–5.9, chuva e neve** (`render/precip.ts`):
    - **Gotas:** ficam em 9 cascas em volta de quem olha (1,6 a 28 m), em colunas presas à bússola (girar não as arrasta), e caem em faixas de 3 m (1,2 m na neve). Cada gota é calculada diretamente por coluna e faixa, e não célula por célula (custa ~0,4 ms). O risco tem comprimento em linhas (6 perto, 2 longe). As gotas se escondem atrás de paredes e objetos e **acendem perto dos postes**. A inclinação pelo vento aparece só no glifo (`/`, `|`, `\`).
    - **Aprendido:** deslocar as colunas pelo vento fazia colunas vizinhas dividirem a mesma gota, e o hash rápido também precisou da finalização completa do murmur3; nos dois casos as gotas formavam carreiras.
    - **Chão:** o asfalto molhado escurece e devolve mais a luz dos postes e letreiros, ondulando enquanto chove. Os respingos são anéis que crescem, e ao longe viram pontos. A neve cobre calçadas e parques (a rua pela metade), beirais e topos de objetos (`Cam.snow`).
    - **Tempestade:** relâmpagos a cada ~5 min de jogo (clarão duplo nas nuvens e no mundo) com trovão atrasado de 1 a 6 s.
    - **Som:** chiado de chuva mais o ronco grave num temporal, trovão, e a neve abafando o rumor da cidade.
  - **Ainda não:** chuva abafada dentro dos prédios (etapa 6), carros e pessoas reagindo ao clima (7 e 11), neblina e vento com som próprio.
  - **Retorno do usuário sobre A e B (2026-09-30), já corrigido:**
    - **Nuvens só em cor**, sem glifos ASCII: com caracteres o céu ficava sujo.
    - **Precipitação sem caixas pretas:** a gota substituía o fundo da célula. Agora `drawFall` roda depois de `finish`, mantém o fundo do que está atrás e desenha a gota como essa cor clareada (a neve, embranquecida), o que parece transparência. Não escreve mais no buffer de profundidade (usa `taken`). Ficou menos densa e mais rápida (7–12 m/s).
    - **Lua:** em 2008-03-07 era lua nova real, então ela estava junto do sol e se pondo com ele, o que está certo. O erro era desenhar o lado escuro: agora, de dia, só aparece a parte iluminada, e a luz cinérea só de noite.
    - **Sol:** ganhou um brilho suave (sem disco), aplicado depois das nuvens e atenuado por elas.
    - **Limite de olhar para cima:** com o y-shearing, a câmera vai até ~40° (`MAX_PITCH`) e mostra até ~70° acima do horizonte, então a lua alta fica fora da vista. Opções levadas ao usuário: subir o limite aceitando alguma distorção, ou esperar a câmera 3D de verdade (etapa 6 ou 10).
  - **Retorno seguinte (2026-09-30):** o usuário aprovou e decidiu **esperar a câmera 3D** para olhar mais para cima (o limite de ~40° fica). Pediu só para tirar a faixa que cortava o brilho do sol: o brilho era calculado só até 0,8 rad do sol; agora é calculado no céu inteiro. Depois disso, mandou seguir sozinho para o grupo C e o 5b, sem pedir teste.
- **Grupo C (5.10–5.11), feito em 2026-09-30:**
  - **5.10, curvatura:** queda d²/2R com `CURVE_R` = 400 km (em `render/sarcophagus.ts`). O chão (raiz exata da equação, numa forma estável), as fachadas (o olho efetivo `eyeD` sobe com a distância), a cerca e a fumaça afundam juntos. Na escala da cidade quase não se nota (~5 m a 2 km), mas a 6 km a queda é de ~50 m. Comecei com 150 km, o que comia demais a base do Sarcófago.
  - **5.11, o Sarcófago** (`city.sarcophagus`, gerado em `generateBorder` com o gerador da borda, então não muda a cidade):
    - **Cúpula:** calota esférica de **3 km de largura e 600 m de altura** (a decisão dizia ~400 m; a 6,5 km, 400 m davam só ~3 linhas na grade de 80, então subi a altura para a escala aparecer), com a borda perto a 5 km da cerca, num lado sorteado.
    - **Desenho por coluna** (`sarcophagusColumn`, marchando 24 passos pela corda): borda `_`, painéis de 2,5° × 50 m em `#` e `|`, um terço faltando (`:` laranja, o fogo por dentro) e o fogo vazando pela base (`~`).
    - **Ao lado:** a torre de tiragem larga e baixa (raio de 420 m, 230 m de altura), com a borda acesa pelo calor e luzes vermelhas, e 5 guindastes parados no topo (`drawCranes`), com luz vermelha piscando.
    - **Visibilidade:** a névoa do fogo a esconde, então só aparece a menos de ~6,8 km do centro dela, ou seja, perto daquela borda (`visibility`). Do centro da cidade não aparece.
    - As nuvens sobre a cratera ficam avermelhadas (`glowBelow`).
    - **Ainda não:** telemetria e sensores, que são dados para a etapa 14.
- **5b, rede elétrica e blackout, feita e aprovada em 2026-09-30.** Abaixo, a primeira versão; os ajustes pedidos depois estão nos dois "Retorno" no fim e valem por cima dela.
  - **Simulação** (`sim/power.ts`, `world.power`):
    - Uma subestação a cada ~650 m (9 com a semente 42). Cada prédio e cada poste pertence à mais próxima (`building`, `lamp`), e os letreiros, as placas perpendiculares e os holofotes seguem o prédio.
    - **Geradores** (`generator`): a prefeitura e ~4% dos prédios com mais de 40 m.
    - `subAt` é uma busca rápida (grade 64×64) para saber qual subestação alimenta um ponto. `switchSub` guarda o tick da troca e o ponto de origem. Ainda não há fila de eventos (fica para a etapa 7, trânsito).
  - **Efeito** (`render/power.ts`, `power(...)`, uma função pura como as falhas dos letreiros):
    - **Apagão (primeira versão, depois mudada: veja o último retorno):** a onda sai da subestação a 1400 m/s, com uma variação de até 0,25 s por elemento. 0,6 s antes do apagão, um surto leva a luz a até 1,35; depois vêm faíscas e piscadas por 0,3 s e o apagão. Com gerador, a luz volta a 55% depois de 3 s.
    - **Volta:** cada elemento volta no seu momento (0,4–13 s, mais o atraso pela distância), piscando 0,7 s; os postes refazem o aquecimento do sódio.
    - **O que apaga:** janelas, vitrines, letreiros (e a luz que eles jogam), placas perpendiculares, holofotes, faixas das coroas, o relógio aceso e os postes, com luz e zumbido.
    - **O que fica:** as luzes de aviação (bateria) e os faróis dos carros.
    - As nuvens sobre um distrito apagado perdem o laranja, e a névoa distante segue a parte da cidade acesa (`cityLit`). Um luar frio e fraco (`finish`) deixa ver os contornos.
  - **Som** (`audio/blackout.ts`): o atraso segue a velocidade do som (343 m/s), e o volume e o pan seguem a distância e a direção do ponto de origem.
    - **Versão A, fiel à receita:**
      - sub e drone descendo de 121 a 82 Hz (de B2 a E2), com saturação e passa-baixa ressonante;
      - corpo de ruído em 300 Hz;
      - 26 arcos de 0,7 a 1,8 kHz (60% perto de 1,2 kHz), poucos no início e muitos depois;
      - 28 estalos de 1,5 a 5 kHz;
      - reverb curto e escuro só nas camadas médias;
      - rearticulação do grave em 55–80 Hz e corte em 12 s.
    - **Versão B, interpretação própria (removida depois, porque o usuário preferiu a A):**
      - baque e estalo do transformador estourando;
      - arco que sobe de 120 a 260 Hz gaguejando e é cortado seco;
      - zumbido que morre de 120 a 25 Hz;
      - relés em cascata;
      - ecos de outros transformadores mais longe.
    - **No escuro:** relés, zumbidos gaguejando e baques graves a cada 1,5–6,5 s. A cidade abafa (`hush`).
    - **Na volta:** um contator fechando, relés e o zumbido subindo de 60 a 120 Hz.
  - **Teclas:** **K** liga e desliga a subestação mais próxima, e **Shift+K** liga e desliga todas (a tecla J, que trocava o som entre A e B, saiu com a versão B). A linha do clima mostra `POWER x/y`.
  - **Não testado de ouvido:** o Claude não ouve o áudio. O código roda sem erros, mas o som precisa do retorno do usuário.
  - **Retorno do usuário sobre C e 5b (2026-09-30), já corrigido:**
    - **Som:** preferiu a **versão A** (a da receita). A versão B e a tecla J saíram. O som dos estouros (arcos curtos com filtro muito ressonante, Q 5–10) parecia "bolinhas de sinuca batendo". Agora os arcos são **chiados** (`sizzle`: ruído em banda larga, Q 1,4, picotado num gaguejar rápido e saturado), e os estalos e relés são **cliques secos** (`tick`: 1 ms de ruído em passa-alta, sem tom).
    - **Nuvens de noite** laranja demais e com um **quadrado laranja** no céu fechado: o brilho seguia a borda quadrada da cidade. Agora é redondo e suave (`spread`), com cor mais apagada (marrom-alaranjado).
    - **Blackout nas nuvens** com cortes: cada nuvem seguia a sua subestação, e as divisas apareciam. Agora a parte acesa é misturada entre as subestações vizinhas (gaussiana de 450 m), numa grade 32×32 calculada uma vez por quadro (`buildLit`/`litAt`), que custa quase nada.
    - **Janelas** apagavam e acendiam todas juntas por prédio. Agora cada janela tem o próprio momento (`winPow` em `wallColumn`, com `power` por janela): morre com a onda e volta piscando, em ordem aleatória.
    - **Fumaça ao longe** (pedido no meio): agora é só cor, como as nuvens (véus que escurecem o que está atrás, alaranjados na base), sem glifos.
    - **Janelas iluminando a fachada, como os letreiros:** fica para a etapa de interiores, porque é lá que as janelas passam a ser cômodos de verdade, com a própria luz.
  - **Último retorno da etapa 5 (2026-09-30), já corrigido:**
    - O **neon branco das marquises** (cinema, hotel) continuava aceso no blackout. Agora segue a energia do prédio.
    - **Céu no blackout geral:** perde o laranja e fica cinza. O piso de 12% de luz da cidade saiu, a base das nuvens à noite vira um cinza apagado quando a cidade está escura, o laranja baixo do céu segue `cityLit`, e o anel de fogo ficou estreito (não soma mais nada sobre a cidade). Depois o usuário pediu para tirar também o avermelhado sobre as brasas, que com a câmera atual não se lê como fogo: a flag `SEAM_LIGHTS_CLOUDS` em `sky.ts` está desligada e deve ser **religada quando a câmera for 3D de verdade**. A cratera do Sarcófago continua avermelhando as nuvens sobre ela.
    - **Onda do blackout:** agora sai de onde a tecla foi apertada (`Substation.ox/oy`, a posição do jogador por enquanto) em círculo, a **120 m/s** (antes 1400, quase instantânea), e alcança primeiro os prédios mais perto. Quando chega a um prédio, as janelas dele apagam em ordem aleatória ao longo de 1,5 s (`power(..., group, spread)`: o grupo é o prédio, com a mesma posição para todas as janelas). Na volta, os prédios voltam em ordem aleatória ao longo de ~10 s, e dentro de cada um as janelas também, piscando. O som também é ouvido a partir do ponto de origem.
- **Etapa 5 concluída (2026-09-30).** A próxima é a dos **interiores** (veja o roteiro: trocada com o trânsito a pedido do usuário).
- **Etapa 4, grupo 4a–4c feito e aprovado (2026-09-30):**
  - **4a:** teclas **P** (paleta: `SODIUM`, `NEON NOIR`, `TERMINAL`; a tecla P e as outras paletas saíram quando o usuário escolheu o sódio), **B** (fundo sólido, ligado por padrão) e **U** (glifos de bloco). As paletas ficam em `render/palette.ts`: cada uma é uma correção de cor no shader (`grade` em `glRenderer.ts`, aplicada à tela inteira, HUD incluído) mais a cor da luz dos postes. O fundo sólido e a troca de glifos são uma passada final (`finish` em `raycaster.ts`): cada célula do mundo (com profundidade) ganha de fundo a própria cor × `SOLID` (0,36). Os blocos e as linhas de caixa são desenhados como formas exatas no atlas, nas posições 128+ (`BLOCK` em `atlas.ts`), e a tabela `BLOCKS` diz qual ASCII vira qual bloco.
  - **4b:** os billboards viraram objetos com volume (`render/objects.ts`). Como o y-shearing é linear, cada célula é um raio 3D reto (`z = eye + t·(hor − linha)/scale`), então cada peça (caixa, cilindro vertical ou elipsoide, no referencial do objeto) é cruzada exatamente. O `t` é a mesma profundidade do buffer, então os objetos se escondem atrás das paredes e uns dos outros sem ordenar. Peças mais finas que meia célula são alargadas para não piscar ao longe. Materiais: `Solid` (glifo por face), `Leaf` (ruído preso à superfície) e `Glow` (luz, sem sombra). Os modelos ficam em `render/models.ts`: carro (carroceria, cabine de vidro, rodas, faróis e lanternas, luminoso de táxi), poste com base, braço sobre a rua e luminária (`Prop.a` é o lado da rua), árvore com copa em 6–9 elipsoides e holofote do cordão.
  - **4c:** mobiliário por tipo de distrito (`FURNITURE` em `city.ts`): banco, lixeira, hidrante, caixa de correio, caixa de jornal, orelhão (capa azul, voltado para a calçada), ponto de ônibus com cartaz aceso, caçamba e entulho. Bancos nos caminhos de parques e praças; entulho nos lotes vazios. Tudo sai de um **gerador próprio por quarteirão** (`fr`), então a cidade de uma semente continua igual. Com a semente 42 são ~7 mil peças de mobiliário, e o painel segue a ~90 FPS.
  - Ainda não são sólidos: o jogador atravessa postes, bancos e caçambas.
- **Retorno do usuário sobre a etapa 3 (2026-09-30):** achou ótimo ("tá perfeito"). Roda a 180 FPS no PC dele, sem queda. A fumaça está ótima. A quantidade de caixas-d'água está boa. Pediu tamanhos variados de caixa-d'água e uma **biblioteca de marcos** sorteados e espalhados pela geração, em vez de marcos sempre nos mesmos lugares (feitos logo depois, veja abaixo). O relógio da torre está parado em 10h10 até existir o relógio da simulação (etapa 5).
- **Etapa 3 feita (2026-09-30), em cinco commits (3a–3e):**
  - **Distritos:** ~25 por cidade (um a cada ~400 m, grade com variação), tipos `financial`, `commercial`, `residential`, `historic`, `industrial`. O centro é financeiro; o anel em volta é comercial com 1 ou 2 históricos; a periferia é residencial, com uma cunha industrial num lado. Cada quarteirão pertence ao distrito cujo ponto está mais perto. A tabela `KIND` em `city.ts` diz como cada tipo gera (altura, limite de andares, tamanho de lote, bloco aberto, lojas). Setores são só códigos de mapa 4×4 ("C3").
  - **Sem porto:** como a cidade não tem água, o distrito portuário do roteiro virou **pátios ferroviários** (blocos `yard`) dentro do industrial.
  - **Nomes:** a simulação guarda só números (`city.nameSeed`, `District.pick`); as palavras ficam em `src/locale/en.json` e são montadas por `src/locale/names.ts`. Avenidas e ruas comuns são numeradas ("3rd Ave", "14th St"); as largas têm nome ("Blackmoor Blvd"). O cabeçalho em cima mostra cidade, distrito, tipo, setor, esquina e o marco mais perto com distância e direção (é provisório, até o painel da etapa 8).
  - **Fachadas** (`Building.style`): `office` (a antiga), `glass` (montantes, lajes e reflexo diagonal), `brick` (fiadas e escada de incêndio em zigue-zague), `historic` (pilastras, arcos `^`, cornija com dentículos, base rusticada), `residential` (varandas), `warehouse` (chapa ondulada, janelas altas, portas de carga). A mistura por tipo de distrito está em `MIX`, e as cores por estilo em `LOOK`.
  - **Formas:** o raycaster agora testa **cilindros** (`Building.round`, inscrito na caixa). Topos: coroas art déco com faixas acesas e ponta com luz vermelha nas torres altas, antenas no vidro, cúpulas em prédios históricos, caixas-d'água de madeira em prédios de tijolo e residenciais, chaminés no industrial, casas de máquinas nos escritórios. Todos são formas que partem do chão, escondidas dentro do prédio de baixo (função `roof` em `city.ts`).
  - **Blocos abertos** (`Block.open`): `park` (árvores e caminhos em cruz), `plaza` (lajes de pedra), `yard` (trilhos).
  - **Marcos** (`city.landmarks`), sorteados de uma **biblioteca** (`LIBRARY` em `city.ts`) a pedido do usuário: cada tipo tem os tipos de distrito em que pode aparecer, a chance e o máximo por cidade, e cai num quarteirão aleatório que não encosta em outro marco. Tipos: prefeitura com cúpula verde (histórico, sempre), obelisco numa praça (financeiro/comercial), usina com três chaminés de 80–95 m, parque de dois quarteirões, torre do relógio com mostrador aceso e capuz de cobre, igreja com torre e agulha de cobre, transmissor de rádio (treliça vermelha de 150–190 m com luzes), gasômetros. A torre mais alta da cidade também é um marco. Os marcos têm gerador próprio (`pickLandmarkBlocks`). Para acrescentar um tipo: entrada na `LIBRARY`, ramo no bloco de marcos da geração, nome em `en.json` e, se tiver aparência nova, um estilo em `wallColumn`.
  - **Caixas-d'água** com tamanhos (raio 1,1–3,4 m) e materiais variados; pernas, corpo e tampa escalam com o raio.
  - **Borda:** a cerca do cordão fica exatamente no limite da cidade (malha em losango de perto, arame farpado em cima, postes) com torres de holofote a cada 120 m (`city.floodlights`). Do lado de fora, o chão queimado racha (padrão celular) com brasas que pulsam a partir de 40 m (`BURN_START`); `city.vents` são ~76 respiros com colunas de fumaça que sobem e brilham laranja na base; o céu baixo ficou alaranjado em volta toda. A borda tem gerador próprio (`generateBorder`) e não altera a cidade.
- *Histórico:* `terminal-city.html` é o primeiro protótipo (2026-09-30), hoje substituído pelo projeto Vite. Tinha:
  - uma cidade procedural de 12×12 quarteirões (tamanho 12, ruas com 3 de largura);
  - prédios com janelas acesas e letreiros de loja, parques com árvores e postes com poças de luz no chão;
  - ~70 carros e táxis que fazem curvas nos cruzamentos, mantêm distância do carro da frente e param para o jogador;
  - movimento em primeira pessoa (WASD, mouse com pointer lock, Shift para correr) e controle por toque;
  - HUD com navegação, minimapa, contexto da rua e dados do sistema.
- Publicado como artifact: https://claude.ai/artifact/NsHWhubsToP1b7jiiKoM5Z. A versão publicada **não** tem a correção abaixo.
- O usuário jogou: roda a ~30 FPS e está ok, mas parece a primeira versão do ASCII City, bem longe do nível do Update 4. O objetivo agora é chegar a esse nível seguindo o roteiro.
- Bug corrigido localmente: em alguns navegadores a tela de título não sumia ao clicar (`#overlay { display: grid }` vencia o atributo `hidden`). Foi resolvido com `#overlay[hidden] { display: none; }`.
- **Etapa 1 concluída (2026-09-30):** projeto Vite + TypeScript com Git. Rodar com `iniciar.bat` ou `npm run dev` (porta 5173). `?seed=123` na URL reproduz uma cidade.
  - `src/sim/`: cidade, trânsito e jogador, com semente e passo fixo de 60 Hz (`TICK`). Não conhece a tela; a única entrada é `PlayerInput`.
  - `src/render/`: `camera.ts` (o mouse move um alvo e a câmera o segue suavemente), `raycaster.ts` (preenche a `CharGrid`), `glRenderer.ts` + `atlas.ts` (WebGL2: um triângulo de tela cheia, atlas de glifos com células de pixels inteiros, um único draw).
  - Grade: sempre 80 linhas; as colunas seguem a proporção da janela (célula 0,6). Posições do jogador e dos carros são interpoladas entre ticks, sem balanço de cabeça, e as árvores usam coordenadas locais, para não tremer.
  - O HUD lateral e os controles de toque do protótipo 1 ficaram de fora; voltam na etapa 8. Nessa etapa, a cidade ainda era a de 12×12 quarteirões do protótipo.
  - Na parte de baixo da tela fica só uma linha de status (semente, posição, velocidade, grade, FPS). O artifact publicado continua sendo o protótipo 1.
- **Etapa 2 concluída (2026-09-30):** cidade grande em metros.
  - `city.ts`: a cidade não é mais uma grade de tiles. Cada eixo é uma lista de limites (`xb`, `yb`): as células pares são ruas e as ímpares são quarteirões. `xCell`/`yCell` dão a célula de cada metro com uma leitura. Os prédios são retângulos em metros (`Building.x0..y1, h`), e as torres com recuo são várias caixas aninhadas, todas a partir do chão.
  - Grade: avenidas N–S a cada 150–200 m (21 m de largura, 28 m a cada 4ª), ruas L–O a cada 60–80 m (14 m, 21 m a cada 5ª), calçada de 4 m dentro do quarteirão, faixas de 3,5 m. O tamanho é parâmetro de `createWorld(seed, size)` (padrão `CITY_SIZE = 2000`). Com a semente 42: 207 quarteirões, ~11 mil caixas, torre mais alta de 253 m, mediana de 12 m.
  - Identidade fixa: cada quarteirão usa o próprio gerador, `mulberry32(hash3(seed, i, j))`. Mudar um quarteirão não altera os outros, e dá para gerar sob demanda se um dia a cidade crescer.
  - Raycaster: percorre a grade de ruas e quarteirões (~60 células num raio de 2 km), testa as caixas do quarteirão, ordena por distância e continua atrás dos prédios próximos. Pula o quarteirão inteiro quando nem o prédio mais alto dele (`maxH`) apareceria acima do que já foi desenhado. Traça até a borda da cidade.
  - Dois níveis de fachada: detalhada quando o andar tem ≥ 2,2 linhas e a janela ≥ 1,5 coluna. Mais longe, andares e janelas são agrupados em potências de 2, para o padrão não tremer.
  - Janela deslizante: `render/lightmap.ts` guarda a luz dos postes no chão num quadrado de 1024 m em volta do jogador, a 1 m por célula, e recalcula quando ele se afasta mais de 256 m do meio. Objetos e carros só são desenhados até 250 m; o chão, até 600 m.
  - Olho a 1,7 m, andar a 3,5 m, caminhada a 3,5 m/s, corrida a 9 m/s. São 300 carros a 8–14 m/s, com a mesma lógica de antes adaptada à grade nova (a curva ainda "teleporta" de faixa; isso fica para a etapa 6).
  - No painel do app, o quadro leva ~5,6 ms (limitado pela taxa do painel).
- **Retorno do usuário sobre a etapa 2:** achou ótimo. A velocidade de caminhada, a escala dos quarteirões e a altura do centro estão boas e não devem mudar sem motivo. O que falta, para ele, é **variedade**: hoje todos os prédios são caixas com o mesmo padrão de janelas, só mudando as cores e a altura.
- **Retorno do usuário sobre a etapa 1:** achou ótimo. A única queixa era o ângulo vertical limitado (só ~15°); foi corrigido para ~60° (`Camera.MAX_PITCH`) e depois reduzido para ~40° por causa da distorção (veja as notas técnicas). Depois disso, o FOV pareceu pequeno e passou a ser fixado na vertical (veja as notas técnicas). No PC dele o jogo roda a ~180 FPS (monitor de alta taxa). Isso não é problema: a simulação tem passo fixo e a suavização da câmera não depende do FPS.

## Bugs conhecidos (para uma etapa de correção mais adiante)

Pedido do usuário em 2026-09-30: registrar os bugs sem perder tempo com eles agora; haverá uma etapa de correção de bugs mais para frente.
- **Faixas de pedestre tortas e cortadas perto da diagonal (relatado em 2026-10-01, com capturas):** o que o usuário chamava de "calçadas que fazem curva" eram faixas de pedestre. Nas ruas que chegam à diagonal, a faixa é medida a partir da borda inclinada da diagonal (`end` com `pastD` em `raycaster.ts`) e se junta à faixa do cruzamento, formando uma faixa em curva ou em "L"; em outros pontos ela aparece cortada pelo asfalto da diagonal. Uma faixa deve ser sempre reta, atravessando a rua perpendicular a ela. A faixa zebrada que corria ao longo do X foi tirada na 7.5.

- **Escadas: precisam de um rework (relatado em 2026-10-01, com capturas, durante a etapa 9; prioridade da etapa de bugfix):** ao subir um andar, a parede da caixa de escada fica sólida em vez de ter a abertura para passar; no meio do lance fica muito bugado; de baixo, olhando para cima, o chão do andar de cima atravessa a vista (ou fica transparente e se vê o andar de cima); de cima, olhando para baixo, aparecem as janelas do andar de baixo; ao subir o lance e olhar para dentro do cômodo, o chão atravessa até sair dele. A causa de fundo é desenhar um andar só por vez (`viewFloor`) com a escada costurada entre eles.
- **Cômodos sem portas (pedido em 2026-10-01):** as passagens entre cômodos são vãos; devem ter portas com animação de abrir (no futuro, abertas com um botão; por enquanto podem abrir sozinhas, para facilitar os testes). Junto com a porta de rua invisível e as placas de saída, na etapa de bugfix.
- **Porta de rua invisível por dentro (relatado em 2026-10-01):** de dentro do prédio, no lugar da porta de rua aparece uma janela. Junto, fazer as placas de saída (veja "Pedidos do usuário no começo da etapa 9").
- **Escadas de incêndio na frente de portas (relatado em 2026-10-01):** algumas escadas de incêndio (`escapesOf` em `sim/interior.ts`) são geradas diante da porta de um negócio. Devem evitar os vãos de todas as portas de rua (`exitsOf`).
- **Bugs relatados no teste do grupo B do trânsito (2026-10-01):**
  - **Móveis gerados na frente da porta:** em alguns prédios um móvel fica bem na porta e é impossível entrar (`furnish` em `sim/interior.ts` deveria manter livre a faixa em frente a toda porta, inclusive a de rua e as das lojas).
  - **Risco de vidro ainda pintado nas fachadas:** boa parte dos prédios de vidro ainda mostra as faixas diagonais de reflexo presas à arquitetura (`sheenAt` no estilo `glass` de `wallColumn`), em vez de um efeito que depende da câmera, como o vidro das janelas já faz desde a 7.6.
  - **Som do blackout geral somando:** com Shift+K todas as subestações tocam o mesmo som ao mesmo tempo, empilhado, muito mais alto do que um blackout só. Tocar uma vez (ou limitar o volume somado) quando várias caem juntas.
  - **Chuva que inverte:** a chuva começa a cair, para no ar e passa a subir. Provável serrilhado temporal (a fase das gotas contra a taxa de quadros) ou um tempo que volta; investigar em `precip.ts`.
  - **Luz estourada dos faróis:** quando um carro passa por um lugar já iluminado, o branco dos faróis soma e fica queimado e saturado demais. Limitar a soma das luzes (por exemplo, uma curva de saturação suave em `lightAt`) em vez de somar sem teto.
- **Pingos no meio do andaime de calçada:** cada face com andaime é um só telhado de chuva, mas se houver trechos de faces diferentes encostados, as pontas pingam onde não há borda. Os postes do andaime e dos pontos de ônibus não são sólidos.
- **Desempenho caindo (relatado em 2026-10-01):** no PC do usuário, o jogo começou preso em 180 FPS e hoje, nas mesmas situações, chega perto de 60 FPS. Fazer uma **etapa de otimização junto com a de bugfix**: perfilar o quadro (`wallColumn`, interiores vistos de fora, objetos, luzes dinâmicas), medir com `bench` e considerar mover partes para Workers ou para o GPU.
- **Poste e semáforo um dentro do outro (relatado em 2026-10-01, com captura):** em algumas esquinas, um poste de iluminação (`city.lamps`, gerado em `city.ts`) e um poste de semáforo (`forSignals` em `raycaster.ts`) ficam no mesmo lugar, um atravessando o outro. O semáforo deve tirar (ou afastar) o poste de luz da esquina. O usuário suspeita que objetos sobrepostos também pesam no desempenho.
- **Theater district perto de 30 FPS (relatado em 2026-10-01):** no PC do usuário, o desempenho no theater district chega perto de 30 FPS (o `DRAW` passa de ~19 ms). Prioridade da etapa de otimização.
- **Picos de tempo de desenho:** o `MAX` da linha de status chega a ~20–55 ms às vezes perto de prédios novos (provavelmente a geração das plantas, até 4 por quadro, ~0,2 ms cada, mais os móveis); medir com o perfilador antes de mexer.
- **Móveis invisíveis de fora (relatado em 2026-10-01):** os interiores vistos pelas janelas (`peekCell`) mostram parede, piso e teto, mas não os móveis. O usuário achou esquisito; fica para a etapa de bugfix.
- **Chão invisível em alguns lugares, como elevadores e escadas (relatado em 2026-10-01):** o chão some (deixa ver o que estiver por trás) em certos pontos da cabine do elevador e da caixa de escada. Suspeitas: na cabine em movimento, o piso usa `Inside.z0` = altura da cabine, mas a marcha dos degraus ou o recorte do poço (`wz0`/`wzc`) não consideram isso; na caixa de escada, as linhas que a marcha não preenche e que ficam abaixo do piso plano. Fica para a etapa de bugfix.

## Refinamento: anotações (para a etapa 15)

Ajustes que o usuário pediu para deixar para a etapa de refinamento e variedade (não são bugs):
- **Opiniões sobre a etapa 6:** o usuário testou e tem opiniões; perguntar no começo da etapa 15.
- **Carros ocos por dentro:** a carroceria é um bloco sólido; pelo vidro se veem o motorista e os passageiros, mas cortados pela caixa do corpo (só o que fica acima de 0,95 m aparece). Fazer o interior oco (laterais, piso, painel) para ver as pessoas inteiras.
- **Dois cones de farol:** hoje cada carro tem um só cone de luz. Devem ser dois, um por farol, com o da direita mais longo (o facho assimétrico de verdade).
- **A praça do X do theater district** e o X em geral: mais decoração (veja a 7.5 e a 7.6).

## Notas técnicas (para as próximas sessões)

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
5b. ✅ **Rede elétrica e blackout** (veja "Design: rede elétrica e blackout"): subestações na simulação, prédios, postes e letreiros ligados a elas, apagão e volta progressivos com som, luar iluminando a cidade apagada. Acionado por uma tecla de debug até o hacking existir.
6. ✅ **Interiores** *(feita em 2026-09-30 e 2026-10-01, grupos A–F; testada pelo usuário, que tem opiniões para a etapa 15; os bugs estão em "Bugs conhecidos")* (trocada com o trânsito a pedido do usuário em 2026-09-30: dá exploração e gameplay já, e permite medir cedo o custo de ter interiores na cidade inteira). Todos os prédios devem ter interior, inclusive os cortados pela diagonal.
   - **Decidir no início:** interiores no mesmo espaço físico da cidade (o pedido original: atravessar a porta, sem carregamento nem teleporte) ou com carregamento, conforme o desempenho medido; e se a câmera 3D de verdade entra agora.
   - Cômodos coloridos vistos de fora pelas janelas (referência 16), janelas que mostram a cidade real, andares altos com vista de cima, vitrines com o interior das lojas.
   - Elevadores que sobem de verdade, alguns com vidro. Escadas de incêndio em que se sobe.
   - As janelas iluminando a fachada (como os letreiros), a chuva abafada do lado de dentro e a luz interna ligada à rede elétrica.
   - Veja "Preparação da etapa 6" no Estado atual.
7. ✅ **Trânsito** *(feita em 2026-10-01, grupos A, B e C; veja o Histórico)*: avenidas, coletoras e calçadões; semáforos; filas; tipos de veículo; ciclistas; pedestres. Sem carros voadores, porque não combinam com 2008. Criar aqui a fila de eventos da simulação (batidas, engarrafamentos, e também os apagões da rede elétrica). Carros na avenida diagonal, semáforos ligados à rede elétrica, e o conserto das calçadas da diagonal (veja "Bugs conhecidos").
8. ✅ **Navegação** *(feita em 2026-10-01, grupos A, B e C; veja "Etapa 8" no Histórico)*: o celular como painel diegético com terminal progressivo, mapas em 4 níveis e de interior, marcos, os limites do GPS de 2008, e a grade de apps com os que não dependem da rede funcionando. (O passeio automático e o modo cidade vazia do ASCII City saíram: o usuário não quer no nosso jogo, decidido em 2026-10-01.)
9. ✅ **Rede de telefones e celular** *(feita em 2026-10-01; veja 9.1–9.11 no Histórico)*: orelhões; antenas e sinal (a barra "Yx" do celular passa a mostrar o sinal de verdade); loja de apps; discador, SMS e câmera funcionando (as telas já existem desde a 8.7); os limites do hardware valendo; a abertura do jogo. O celular como objeto na mão já existe (etapa 8). Veja "Design: celular e apps". Também os pedidos do começo da etapa: o celular subindo para digitar, o botão do meio do mouse, as teclas clicáveis, o plano de dados com franquia e vários modelos de aparelho (veja "Pedidos do usuário no começo da etapa 9").
10. **Transporte:** táxi (pedido por telefone ou sinal, destino dado ao motorista), monotrilho com estações e trens. Um táxi aéreo futurista não combina com 2008; a alternativa seria um helicóptero de passeio, ainda a confirmar.
11. **Cidadãos e rotinas:** casa, trabalho, relações e horários, com nível de detalhe da simulação.
12. **Rede social da cidade:** posts de cidadãos a partir dos eventos da simulação e das rotinas, com fotos renderizadas do ponto de vista deles, acessível pelo celular e pelo notebook (veja "Design: rede social da cidade").
13. **Economia:** empresas, preços, estoques e salários interligados. Os fabricantes de eletrônicos e de chips da cidade dão a marca dos celulares e dos chips (pedido na etapa 8).
14. **Hacking:** computadores virtuais com hardware próprio, redes, cybercafés com Wi-Fi por distância, portas físicas, terminais progressivos, apps de hacker instalados por fora da loja, impacto sistêmico.

15. **Refinamento e variedade** (pedido do usuário em 2026-09-30; ampliado em 2026-10-01): uma etapa para refinar o visual **e acrescentar variedade** em vários elementos do jogo (modelos, eventos, fachadas etc.), quando houver mais sistemas e o jogo estiver mais estável. **O usuário testou a etapa 6 e tem opiniões sobre ela, que vai dar nesta etapa: perguntar no começo.** Pode vir a qualquer momento depois da etapa 11, se fizer sentido. Inclui:
   - carros menos arcaicos: rodas girando, pessoas visíveis dentro, modelos e formatos variados;
   - pesquisar **fotos de referência reais na internet**, por exemplo da Times Square;
   - um **distrito cheio de neon, no estilo da Times Square** (pode exigir um tipo de distrito novo);
   - os defeitos visuais conhecidos que ainda estiverem abertos (veja as notas técnicas);
   - (etapa 8) detalhes nos telhados de perto, greebles nas fachadas e topos, chaminés industriais com fumaça (veja "Pedidos do usuário durante a etapa 8");
   - (segunda lista) placas perpendiculares, holofotes e neons de prédio, outdoors ligados às empresas e telões de notícias, se não tiverem entrado antes (veja "Pedidos do usuário para planejar").
**Etapa de correção de bugs e otimização** (pedido do usuário em 2026-09-30; a otimização foi juntada a ela em 2026-10-01, por causa da queda de 180 para ~60 FPS): **vem antes da etapa 15** (decidido em 2026-10-01); a lista está em "Bugs conhecidos".

16. **Vida do personagem** (pedido do usuário em 2026-09-30): deep sim / life sim. Apartamento próprio, stats, necessidades, customização do personagem pela lore. Depende dos cidadãos (11) e da economia (13).

**Para avaliar (pedido em 2026-10-01; reforçado na etapa 8, veja "Pedidos do usuário durante a etapa 8"): luz do sol nos prédios (lados iluminados, horizonte iluminado de dia) e iluminação dinâmica com sombras,** do sol (e da lua) e das luzes (postes, faróis, letreiros, janelas). Verificar se é viável no raycaster por coluna (por exemplo, um raio de sombra por ponto iluminado contra a grade de prédios, ou mapas de sombra por luz na janela deslizante), medir o impacto com `bench`, e talvez criar uma etapa própria para isso.

**Ainda sem lugar no roteiro:** o sistema de notícias com telões (junto com a etapa 12). Decidir com o usuário.

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
- **Etapa 10:** o usuário ainda não sabe se quer transporte aéreo. Se houver, será um helicóptero de passeio, e não um táxi aéreo.

## Ideias futuras (não decididas)

- Rede da cidade como dado do jogo: nós (telefones, câmeras, semáforos, prédios) com endereços e níveis de acesso.
- Notebook do hacker como objeto físico no jogo, com teclado, tela de terminal e sons.
- Transmissão ao vivo determinística (como o "ASCII City Live"): a mesma semente e a mesma hora mostram a mesma cena.

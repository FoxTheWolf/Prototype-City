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
- **Painel lateral no estilo do ASCII City:** fica, desde que seja diegético (por exemplo, um PDA, o celular ou o notebook). Deve ter o visual de terminal com texto composto aos poucos. A forma exata ainda está a decidir.
- **Projetar pensando nas próximas etapas (pedido do usuário em 2026-09-30):** toda decisão de projeto deve considerar as etapas que vêm depois. O que é feito agora como visual deve nascer ligado a dados da simulação, de forma modular, para ser ampliado depois sem reescrever. Exemplo: os letreiros da etapa 4 mostram o nome de uma empresa que existe na simulação (`city.businesses`). Os interiores (etapa 6) e a economia (etapa 13) usam e ampliam esse mesmo registro, em vez de inventar nomes à parte.
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
  - **Fundo colorido:** o usuário gosta das duas versões, com e sem fundo. A tecla **B** passa por estágios: 0,24 da cor do glifo, 0,16, **0,08 (o padrão desde 2026-10-01, o "3/3" escolhido pelo usuário; antes era 0,16)** e desligado (`SOLID` em `main.ts`). Antes era 0,36, que ele achou claro e sólido demais.
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

## Design: celular e apps (proposta, 2026-09-30)

Ideia do usuário: o celular do jogador tem vários apps com funções reais e uma loja de apps. A época de 2008 (primeiro iPhone e primeira loja de apps) resolve o dilema "a loja não existia nos anos 2000" e deixa a rede social funcionar no celular.

**O aparelho**
- **É um computador virtual como os outros:** CPU, memória, armazenamento, rádio (EDGE/3G, Wi-Fi, Bluetooth), câmera de poucos megapixels e bateria. Esses limites são reais: um app que não cabe na memória não roda, e o armazenamento enche.
- **É um objeto físico:** o jogador tira o celular do bolso, e ele aparece na mão, ocupando parte da tela. A interface é uma `CharGrid` à parte, desenhada pelo mesmo compositor de glifos. Os botões fazem som, e o texto é composto aos poucos, como nos terminais.

**Conectividade (é daqui que vem a jogabilidade)**
- **Dados móveis:** vêm das antenas da cidade, que existem na simulação. O sinal depende da distância e dos prédios no caminho. São lentos e custam dinheiro do jogo (há um plano de dados).
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

### Resumo para começar uma sessão (atualizado em 2026-09-30)

- **Etapas 1 a 5 e 5b concluídas e aprovadas pelo usuário.** **A etapa 6 (interiores) está em andamento:** o grupo A (6.1–6.3) foi aprovado com pedidos; a 6.4 (correções e interiores vistos de fora) e a 6.5 (elevador, início do grupo B) aguardam o teste. Veja "Etapa 6: decisões e grupos" no Histórico e "Pedidos do usuário durante a etapa 6".
- **Rodar:** `iniciar.bat` ou `npm run dev` (porta 5173, a do usuário). O Claude usa a configuração `claude-dev` (5180) ou `vite-auto`. `?seed=42` fixa a cidade.
- **Teclas:**
  - jogo: WASD, mouse, Shift corre, Q/E giram;
  - visual: **B** fundo sólido (4 estágios), **U** glifos de bloco, **M** som;
  - debug: **T** e Shift+T mudam a hora em ±1 h; **Y** percorre os climas fixos e volta ao automático; **K** liga e desliga a subestação mais próxima; **Shift+K** liga e desliga a cidade toda; **PageUp/PageDown** sobem e descem um andar dentro de um prédio (até existirem escadas e elevadores).
  - A linha de status mostra semente, posição, `DRAW x ms (MAX y)` e os modos. A linha de cima dela mostra data, hora, clima e `POWER x/y`.
- **Desempenho:** o quadro fica em ~3–8 ms no painel (o usuário tem monitor de 180 Hz; ele nota quedas). `bench(n)` mede a vista atual numa grade 256×80. Toda novidade deve ser medida com `bench` antes e depois.
- **Mapa dos módulos** (o que está em cada arquivo):
  - **`src/sim/`** (nunca importa `render` nem o DOM):
    - `city.ts`: grade, quarteirões, prédios (caixas, cilindros e caixas cortadas pela diagonal), empresas, props, marcos, borda e Sarcófago.
    - `world.ts`: o passo fixo de 60 Hz e as teclas de debug.
    - `traffic.ts`: carros simples.
    - `clock.ts`: tempo, calendário, sol e lua.
    - `weather.ts`: previsão pura, chão molhado e neve.
    - `power.ts`: subestações, geradores e quem alimenta o quê.
    - `interior.ts`: plantas dos andares (sob demanda, em cache), porta de rua, colisão com paredes e portas.
  - **`src/render/`:**
    - `raycaster.ts`: a ordem do quadro; `wallColumn` desenha as fachadas.
    - `sky.ts`: gradiente, nuvens, lua e sol.
    - `precip.ts`: chuva e neve.
    - `sarcophagus.ts`: a cúpula e a constante `CURVE_R`.
    - `objects.ts` e `models.ts`: objetos com volume.
    - `signs.ts`: letreiros, lâmpadas e símbolos.
    - `lights.ts`: luzes dinâmicas.
    - `lightmap.ts`: poças de luz dos postes.
    - `lamps.ts`: falhas e fotocélula.
    - `power.ts`: o efeito do blackout, uma função pura.
    - `interior.ts`: o andar em volta do jogador (paredes, piso, teto, lâmpadas, janelas e vidro).
  - **`src/audio/`:** `sound.ts` (ambiente, chuva, trovão, zumbidos) e `blackout.ts` (o som do apagão, versão A).
  - **`src/locale/`:** `en.json` e `names.ts`.
- **Ordem do quadro** (`renderWorld`):
  1. Por coluna: dentro de um prédio, primeiro o andar (`interiorColumn`), que ocupa as células e a profundidade e deixa livres só as janelas; depois céu (`skyColumn`, que pula células ocupadas) e Sarcófago, chão (com a curvatura e testando a profundidade), paredes (DDA na grade; telhados quando o olho está acima deles) e cerca.
  2. Depois: fumaça, guindastes, objetos, `glassPass` (o vidro das janelas por cima da cidade: escurece, reflete a lâmpada, gotas de chuva) e `finish` (fundo sólido, névoa do dia, luar, glifos de bloco).
  3. Por fim: chuva e neve, que vêm depois do `finish` para manter o fundo do que está atrás.
- **Flags para religar depois:** `SEAM_LIGHTS_CLOUDS` (`sky.ts`), as brasas iluminando as nuvens, para religar com a câmera 3D.
- **Bugs registrados para depois:** veja "Bugs conhecidos".

### Preparação da etapa 6 (interiores)

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

- **Etapa 6: decisões e grupos (2026-09-30).** O usuário decidiu no início:
  - **Interiores no mesmo espaço da cidade**, sem carregamento: entrar é atravessar a porta. O custo foi medido (veja abaixo) e ficou mais barato que a rua.
  - **Câmera 3D depois:** fica o raycaster por coluna, com o olho na altura do andar e os telhados desenhados. A câmera 3D entra mais tarde, como subetapa própria (talvez na 10).
  - **Começar por residencial e escritório** (estilos `office`, `glass`, `residential`, `brick`). Histórico, galpão, cilindros e marcos ficam sólidos por enquanto.
  - **Grupos planejados:**
    - **A (6.1–6.3):** planta, porta, entrar, render de dentro, telhados e vista do alto, som abafado (feito).
    - **B:** escadas em que se sobe de verdade e elevadores (alguns de vidro), sem fade.
    - **C:** de fora, os cômodos vistos pelas janelas (batendo com a luz de dentro; feito antes, na 6.4) e as janelas iluminando a fachada.
    - **D:** lojas e vitrines abertas, móveis, escadas de incêndio, os outros tipos de prédio.
- **Retorno do usuário sobre o grupo A (2026-09-30):** gostou ("tá ótimo"). Pediu correções e novidades, feitas na 6.4: chovia dentro dos prédios; o som devia ficar bem mais abafado, quase sem a chuva, mas com o "tec, tec" das gotas na janela; ver os interiores do lado de fora; os pontos de ônibus não apagavam no blackout; sem chuva debaixo do ponto de ônibus, com a água escorrendo do telhado. Os pedidos de fachada estão em "Pedidos do usuário durante a etapa 6".
- **6.5, elevador (grupo B, 2026-09-30):** dentro da cabine (cômodo `lift`), PageUp/PageDown são os botões: cada toque soma um andar ao destino (`Player.liftTo`), e a cabine sobe ou desce de verdade a até 2,5 m/s, com partida e parada suaves (`stepLift` em `world.ts`). `Player.z` é a altura dos pés (contínua), e o olho é `z + 1,7`. Durante a viagem o jogador fica parado e as portas ficam fechadas (`Inside.closed`); o piso e o teto seguem a cabine (`Inside.z0`). Fora da cabine, PageUp/PageDown continuam sendo o pulo de andar de debug.
  - **6.6, painel da cabine:** de pé na cabine, aparece o painel do elevador no canto da tela (andar atual, sentido e destino, os andares servidos). Os números do teclado digitam o andar, Backspace apaga e Enter confirma (`callLift` e `liftFloors` em `world.ts`). Cada tecla faz um bipe; um andar que não existe faz um bipe grave; a chegada toca um sino de duas notas (`beep` e `ding` em `sound.ts`).
  - **Botoeira na parede da cabine:** um mostrador âmbar sobre duas colunas de botões, perto da porta, em todas as paredes do `lift`; um botão acende enquanto a cabine anda. O painel no canto da tela continua, porque mostra o andar digitado.
  - **Crash corrigido (2026-10-01):** a faixa atrás do núcleo virava cômodo de apartamento com unidade -1 quando a vizinha era o corredor, e a cor da parede saía indefinida (`wallPaint`).
  - **Falta (próxima sessão):** escadas em que se sobe de verdade; elevadores de vidro (pedem a cabine numa parede externa, com vidro, e a cabine vista de fora); som do motor e das portas do elevador;  o bug dos prédios cortados sem acesso ao corredor.
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
- **Calçadas da avenida diagonal quebradas (5.1):** em vez de atravessar a rua de forma coerente, as calçadas fazem curvas sem sentido ou desaparecem. A causa provável é a regra do chão em `raycaster.ts`: a calçada da diagonal (`pastD < SIDEWALK` dentro do quarteirão) e a calçada normal do quarteirão (a 4 m da borda) se somam e são cortadas pelas ruas transversais. O usuário sugeriu arrumar junto com o trânsito (agora etapa 7), quando o desenho dos cruzamentos da diagonal for refeito.

- **Prédios sem acesso ao corredor (6.x, relatado em 2026-09-30):** em alguns prédios, provavelmente os cortados pela diagonal, não dá para chegar ao corredor a partir da porta de rua (o recorte tira o saguão, a porta ou parte do corredor). Revisar `makePlan` em `sim/interior.ts` para prédios com `cut`.
- **Grupo B (escadas e elevadores) e fachadas:** o usuário deixou a ordem à escolha do Claude, pedindo o caminho mais barato em processamento e tokens. Sugestão: escadas e elevadores antes, porque reaproveitam o render de dentro que já existe; as fachadas pedem um passe novo e mais caro.

## Notas técnicas (para as próximas sessões)

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
- **Ao terminar uma etapa:** atualizar "Estado atual" e o "Roteiro" deste arquivo, e fazer um commit no Git.
- **Testar de verdade:** abrir o jogo no navegador do app com `preview_start` (configuração `claude-dev`, porta 5180, em `.claude/launch.json`) para ver funcionando, em vez de só checar a sintaxe. Rodar `npm run build`, que também checa os tipos. Medir com `bench` antes e depois de mudanças no render. Veja "Como testar no navegador do app".
- **Som:** o Claude não ouve o áudio. Ao criar ou mudar sons, dizer ao usuário que o teste de ouvido é dele, e descrever o que esperar.
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
6. **Interiores** (trocada com o trânsito a pedido do usuário em 2026-09-30: dá exploração e gameplay já, e permite medir cedo o custo de ter interiores na cidade inteira). Todos os prédios devem ter interior, inclusive os cortados pela diagonal.
   - **Decidir no início:** interiores no mesmo espaço físico da cidade (o pedido original: atravessar a porta, sem carregamento nem teleporte) ou com carregamento, conforme o desempenho medido; e se a câmera 3D de verdade entra agora.
   - Cômodos coloridos vistos de fora pelas janelas (referência 16), janelas que mostram a cidade real, andares altos com vista de cima, vitrines com o interior das lojas.
   - Elevadores que sobem de verdade, alguns com vidro. Escadas de incêndio em que se sobe.
   - As janelas iluminando a fachada (como os letreiros), a chuva abafada do lado de dentro e a luz interna ligada à rede elétrica.
   - Veja "Preparação da etapa 6" no Estado atual.
7. **Trânsito:** avenidas, coletoras e calçadões; semáforos; filas; tipos de veículo; ciclistas; pedestres. Sem carros voadores, porque não combinam com 2008. Criar aqui a fila de eventos da simulação (batidas, engarrafamentos, e também os apagões da rede elétrica). Carros na avenida diagonal, semáforos ligados à rede elétrica, e o conserto das calçadas da diagonal (veja "Bugs conhecidos").
8. **Navegação:** painel diegético com terminal progressivo, mapas em 4 níveis, marcos, passeio automático com A\*, modo cidade vazia.
9. **Rede de telefones e celular:** orelhões; o celular como objeto na mão, com hardware próprio; antenas e sinal; loja de apps; os primeiros apps (discador, SMS, câmera); a abertura do jogo. Veja "Design: celular e apps".
10. **Transporte:** táxi (pedido por telefone ou sinal, destino dado ao motorista), monotrilho com estações e trens. Um táxi aéreo futurista não combina com 2008; a alternativa seria um helicóptero de passeio, ainda a confirmar.
11. **Cidadãos e rotinas:** casa, trabalho, relações e horários, com nível de detalhe da simulação.
12. **Rede social da cidade:** posts de cidadãos a partir dos eventos da simulação e das rotinas, com fotos renderizadas do ponto de vista deles, acessível pelo celular e pelo notebook (veja "Design: rede social da cidade").
13. **Economia:** empresas, preços, estoques e salários interligados.
14. **Hacking:** computadores virtuais com hardware próprio, redes, cybercafés com Wi-Fi por distância, portas físicas, terminais progressivos, apps de hacker instalados por fora da loja, impacto sistêmico.

15. **Refinamento visual** (pedido do usuário em 2026-09-30): uma etapa dedicada a refinar o visual quando houver mais sistemas e o jogo estiver mais estável. Pode vir antes da 15, a qualquer momento depois da etapa 11, se fizer sentido. Inclui:
   - carros menos arcaicos: rodas girando, pessoas visíveis dentro, modelos e formatos variados;
   - pesquisar **fotos de referência reais na internet**, por exemplo da Times Square;
   - um **distrito cheio de neon, no estilo da Times Square** (pode exigir um tipo de distrito novo);
   - os defeitos visuais conhecidos que ainda estiverem abertos (veja as notas técnicas);
   - (segunda lista) placas perpendiculares, holofotes e neons de prédio, outdoors ligados às empresas e telões de notícias, se não tiverem entrado antes (veja "Pedidos do usuário para planejar").
**Etapa de correção de bugs** (pedido do usuário em 2026-09-30): sem número fixo ainda, entra quando fizer sentido; a lista está em "Bugs conhecidos".

16. **Vida do personagem** (pedido do usuário em 2026-09-30): deep sim / life sim. Apartamento próprio, stats, necessidades, customização do personagem pela lore. Depende dos cidadãos (11) e da economia (13).

**Para avaliar (pedido em 2026-10-01): iluminação dinâmica com sombras,** do sol (e da lua) e das luzes (postes, faróis, letreiros, janelas). Verificar se é viável no raycaster por coluna (por exemplo, um raio de sombra por ponto iluminado contra a grade de prédios, ou mapas de sombra por luz na janela deslizante), medir o impacto com `bench`, e talvez criar uma etapa própria para isso.

**Ainda sem lugar no roteiro:** o sistema de notícias com telões (junto com a etapa 12). Decidir com o usuário.

**Transversal, em todas as etapas: som.** O retorno sonoro é prioridade do usuário e não pode ficar para o fim. Cada etapa traz os sons do que cria:
- chuva, trovão e blackout na etapa 5 (feitos; falta o vento);
- portas, passos e ambiente interno na 6;
- motores e buzinas na 7;
- teclas, bipes e toques na 9.

O módulo de áudio já existe (`src/audio/`, Web Audio, tudo sintetizado, sem arquivos).

## Perguntas em aberto

Consolidadas aqui para não se perderem. Pergunte ao usuário quando a etapa correspondente chegar.
- **Etapa 5 (respondido em 2026-09-30, implementado na 5.5):** um dia do jogo dura **48 minutos reais**, como no GTA IV, mas numa variável fácil de mudar. O jogador **pode dormir e pular o tempo**.
- **Etapa 6 (respondido em 2026-09-30):** interiores no espaço físico; câmera 3D depois; começar por residencial e escritório.
- **Etapa 8:** forma do painel lateral diegético. Em 2026-09-30, o usuário disse que o celular serve, mas quer confirmar de novo quando a etapa chegar, porque pode ter outras ideias até lá.
- **Etapa 10:** o usuário ainda não sabe se quer transporte aéreo. Se houver, será um helicóptero de passeio, e não um táxi aéreo.

## Ideias futuras (não decididas)

- Rede da cidade como dado do jogo: nós (telefones, câmeras, semáforos, prédios) com endereços e níveis de acesso.
- Notebook do hacker como objeto físico no jogo, com teclado, tela de terminal e sons.
- Transmissão ao vivo determinística (como o "ASCII City Live"): a mesma semente e a mesma hora mostram a mesma cena.

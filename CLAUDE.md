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
- `02-andar-alto-vista`: vista de um andar alto pela janela (etapa 7)
- `03-visual-solido-carros`: fundo colorido nos glifos e carros volumétricos (etapas 4 e 6)
- `04-rua-poste-predios`: rua com poste, prédios e densidade de caracteres (etapas 1 e 4)
- `05-hud-mapa-local`: painel completo e mapa local (etapa 8)
- `06-mapa-setor` e `07-mapa-cidade`: mapas de setor e de cidade (etapa 8)
- `08-distrito-chuva-pedestre`: distrito com chuva, pedestre e mapa (etapas 3, 5 e 6)
- `09-abertura-dissolvendo`: a abertura em que a imagem sólida se desfaz em células (etapa 9)
- `10-taxi-rua-perto`: táxi de perto na rua, com o chão e as calçadas (etapas 4 e 6)
- `11-taxi-menu-destino`: dentro do táxi, com o menu de destino (etapa 10)
- `12-monotrilho-plataforma`: plataforma do monotrilho (etapa 10)
- `13-taxi-aereo-horizonte`: horizonte distante visto do alto (etapas 2 e 10)
- `14-interior-janela-cidade`: interior de prédio com a janela mostrando a cidade real (etapa 7)
- `15-interior-moveis`: interior com móveis pseudo-volumétricos diante das janelas (etapa 7)
- `16-fachada-janelas-internas`: fachada de perto, com cômodos coloridos vistos pelas janelas (etapa 7)
- `17-escultura-praca`: escultura/monumento numa praça, feito de caracteres (etapas 3 e 4)
- `18-fachadas-vitrines` e `19-fachada-vidro`: fachadas de perto, vitrines e prédio de vidro (etapas 4 e 7)
- `20-praca-objeto-dourado`: praça com um objeto dourado volumétrico (escultura ou fonte) (etapas 3 e 4)
- `21-marco-estatua-cupula`: marco da cidade, com estátua e cúpula num parque (etapa 3)
- `22-fachadas-historicas`: distrito de prédios antigos com fachadas ornamentadas (etapa 3)
- `23-cabine-telefonica`: cabine telefônica vermelha na calçada (etapa 9)
- `24-trem-interior-lua`: interior do trem com uma lua grande no céu (etapas 5 e 10)
- `25-taxi-aereo-interior`: interior do táxi aéreo (etapa 10)
- `26-horizonte-torres-marco`: horizonte com torres-marco art déco vistas do alto (etapas 2 e 3)

O vídeo original está em `E:\Downloads\Everything in ASCII CITY So Far ｜ The Story So Far - Grow Now! Games (1080p, h264).mp4`. Dá para extrair mais quadros com Python + OpenCV (`cv2`), que já está instalado: `cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)` e depois `cap.read()`. Para achar um trecho, monte primeiro folhas de miniaturas com o tempo escrito (uma a cada 8 s cabe em 8 folhas de 6×6) e só depois extraia em resolução cheia.

**Mapa do vídeo** (minuto:segundo → assunto), para achar trechos sem varrer o vídeo inteiro de novo:
- **0:00–2:50:** abertura e passeio.
- **2:58–8:58, protótipo 1** (imagem pequena no centro da tela): 3:30 resolução; 4:50 prédios atrás de prédios; 5:14 objetos pseudo-volumétricos; 5:38 WebGL; 6:18 mundo maior; 6:42–7:14 interiores e janelas internas; 7:22 vários andares; 7:30 vista de cima; 8:02 abertura.
- **8:58–12:42, Update 2 (trânsito e detalhe):** 9:06 visual novo; 9:38 carros; 10:10 trânsito; 10:42–11:06 detalhes do mundo; 11:14–11:30 vitrines; 11:38 modos novos; 12:10 otimização.
- **12:50–21:14, Update 3 (mapas e navegação):** 13:14 passeio automático; 14:58 mapa local; 15:30 distrito; 16:18 setor; 16:50 cidade; 17:38 timelapse; 18:34 marcos; 18:42 detalhes; 18:58 distritos; 19:30 rede de telefones; 20:10 abertura nova.
- **21:22–24:34:** transmissão ao vivo (ASCIICITY.LIVE).
- **24:42–34:26, Update 4:** 25:22 táxi terrestre; 26:34 hierarquia de ruas; 27:06 tocador de música; 27:38 monotrilho; 28:42 viagem de trem; 30:34 táxi aéreo; 32:10 táxi aéreo em velocidade 2x; 32:58 protótipo 3; 34:10 prévia do que vem.

**Regra de originalidade:** copiar a técnica e o gênero é permitido. Os nomes, a história, os marcos e a identidade visual específica do ASCII City **não** devem ser copiados. Criamos os nossos.

## Decisões tomadas

- **Plataforma:** navegador. O protótipo 1 foi um único HTML com JavaScript puro; daqui em diante vale a decisão de stack abaixo (Vite + TypeScript, vários arquivos).
- **Renderização:** raycaster por coluna com prédios de alturas diferentes, desenhado em uma grade de caracteres.
- **Estética do protótipo 1:** noite com a luz amarela de postes de sódio e HUD âmbar/ciano, para se distinguir do verde do ASCII City. É só um ponto de partida; a paleta final ainda está aberta.
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
- **Painel lateral no estilo do ASCII City:** fica, desde que seja diegético (por exemplo, um PDA, o celular ou o notebook). Deve ter o visual de terminal com texto composto aos poucos. A forma exata ainda está a decidir.
- **Os dados da simulação são a matéria do hacking:** registros de moradores e funcionários, logs de telefone, câmeras, controle de portas e semáforos vêm da simulação e não são inventados à parte.
- **Clima e céu (pedido em 2026-09-30):** o usuário quer chuva, garoa, neve e afins, com partículas que caem de verdade e respingam no chão, além das fases da lua. A divisão pretendida:
  - O *estado* do clima (se chove, a intensidade, o vento), a data e a hora ficam na simulação, com semente, porque um dia vão afetar as pessoas e o trânsito.
  - As partículas são só render.
- **Ciclo de dia e noite, com calendário (decidido em 2026-09-30, com ressalva de estética):** o usuário tende a querer, porque as rotinas dos cidadãos, as estações, a passagem do ano e as fases da lua dependem disso. A preocupação dele é o dia estragar o clima de hacker. Proposta para preservar a estética (a validar quando for implementada):
  - **A noite continua sendo o visual principal.** O dia é enevoado e nublado, com céu claro e dessaturado, glifos mais apagados e janelas e postes apagados. É o "visual de serviço". O entardecer e o amanhecer têm céu colorido e são os momentos bonitos da transição.
  - **O dia e a noite mudam o jogo, não só a cor.** De dia, as ruas ficam cheias, há mais testemunhas, os escritórios estão ocupados e o trânsito é pesado. De noite, os sistemas estão menos vigiados, há menos gente e os plantões são curtos. O hacker tem motivo para preferir a noite, mas o dia tem alvos próprios, como as rotinas e as pessoas no trabalho.
  - **Relógio e calendário na simulação:** hora, dia, estação e ano. A duração do dia varia com a estação, a lua segue o ciclo real de ~29,5 dias, e a probabilidade de chuva e neve depende da estação. Ainda falta decidir a escala de tempo (quantos minutos reais dura um dia do jogo) e se o jogador pode dormir ou pular tempo.

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

**O que preparar antes:** a fila de eventos pode nascer já na etapa 6 (trânsito), com as batidas e os engarrafamentos, mesmo sem ninguém lendo. Assim a rede social, as notícias e os logs de câmera consomem a mesma fonte depois.

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

- **Próximo passo: etapa 2 (cidade grande).** Numa sessão nova, ler `src/sim/city.ts`, `src/render/raycaster.ts` e as referências 01, 13 e 26. Decidir antes a conversão de unidades para metros e o tamanho da cidade (veja "Perguntas em aberto").
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
  - O HUD lateral e os controles de toque do protótipo 1 ficaram de fora; voltam na etapa 8. A cidade ainda é a de 12×12 quarteirões do protótipo.
  - Na parte de baixo da tela fica só uma linha de status (semente, posição, velocidade, grade, FPS). O artifact publicado continua sendo o protótipo 1.
- **Retorno do usuário sobre a etapa 1:** achou ótimo. A única queixa era o ângulo vertical limitado (só ~15°); foi corrigido para ~60° (`Camera.MAX_PITCH`). Depois disso, o FOV pareceu pequeno e passou a ser fixado na vertical (veja as notas técnicas). No PC dele o jogo roda a ~180 FPS (monitor de alta taxa). Isso não é problema: a simulação tem passo fixo e a suavização da câmera não depende do FPS.

## Notas técnicas (para as próximas sessões)

- **Regras da arquitetura:**
  - `src/sim/` nunca importa nada de `src/render/` nem do DOM. O render só lê o estado da simulação.
  - Toda aleatoriedade da simulação vem de `world.rng`, nunca de `Math.random`, para manter o determinismo.
  - Detalhes só visuais (textura do chão, janelas acesas) saem de `hash3` da posição. São fixos e não piscam.
- **Interpolação:** tudo o que se move na simulação guarda a posição do tick anterior (`px`, `py`), e o render interpola com `alpha`. Qualquer entidade nova que se mova deve seguir esse padrão, senão treme.
- **Projeção:**
  - O FOV é fixado na **vertical** (`VFOV = 60°`), e o horizontal segue a proporção da janela (~92° em 16:9). Antes era fixado na horizontal (72°), o que deixava só ~44° na vertical, e o usuário achou apertado ao olhar para cima e para baixo.
  - `scale = (rows/2) / tan(VFOV/2)` = linhas por unidade de altura à distância 1.
  - `plane = (cols/2) * cellAspect / scale` = tan(FOV horizontal / 2).
  - Olhar para cima e para baixo é *y-shearing*: `horizonte = rows/2 + tan(pitch) * scale`. Um raycaster por coluna não consegue girar a câmera de verdade; perto de 60° a imagem estica. Olhando para baixo, vê-se só o chão perto dos pés.
  - Uma célula pertence a uma parede ou sprite quando o *centro* dela está dentro do intervalo projetado (`Math.ceil(y - 0.5)`).
- **Unidades:** 1 tile = 1 unidade. O quarteirão tem 12 tiles, a rua 3, a calçada 1. O andar tem 0,55 e o olho está a 0,48. **Ainda não há conversão para metros**; vale decidir isso na etapa 2, junto com a cidade grande.
- **Atlas de glifos:** o índice do glifo é o próprio código do caractere, e só o ASCII 33–126 está desenhado. Para usar caracteres de bloco ou de caixa (`░▒▓█─│`), é preciso mapear o codepoint para uma posição livre do atlas (0–31 ou 127–255) em `atlas.ts`.
- **`CharGrid`** usa `Uint8ClampedArray`: as cores saturam sozinhas em 0–255, então não precisa limitar valores antes do `put`.
- **Textos dentro do jogo** estão em inglês, herdados do protótipo. O idioma do jogo ainda não foi decidido.

## Como testar no navegador do app

- O painel tem só ~800×450, então as células ficam com ~3×5 px e o texto da linha de status é ilegível nas capturas. Serve para ver a composição, não para ler detalhes.
- **O pointer lock não funciona no painel** (`WrongDocumentError`); é esperado. Para testar:
  - Em modo dev, `window.world` e `window.camera` ficam expostos. Por exemplo: `camera.look(0, 2)` olha para cima, `world.player` mostra a posição.
  - Teclas se simulam com `dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW'}))` e o `keyup` correspondente.
- Cada recarga (inclusive a do HMR) sorteia uma semente nova. Use `?seed=42` para comparar sempre a mesma cidade.
- Para criar arquivos, use a ferramenta Write. Um heredoc grande pelo Bash falhou com erro de aspas nesta máquina.
- A pasta `referencias/` está no `.gitignore` (são quadros do vídeo de outra pessoa) e existe só no disco.

## Como trabalhar neste projeto

- **Uma sessão por etapa ou funcionalidade.** Ler só os arquivos e as imagens de referência daquela etapa.
- **Ao terminar uma etapa:** atualizar "Estado atual" e o "Roteiro" deste arquivo, e fazer um commit no Git.
- **Testar de verdade:** abrir o jogo no navegador do app com `preview_start` (configuração `vite`, já em `.claude/launch.json`) para ver funcionando, em vez de só checar a sintaxe. Rodar `npm run build`, que também checa os tipos. Veja "Como testar no navegador do app".
- **Explicar ao usuário como rodar:** o comando do servidor de desenvolvimento, e de preferência um atalho `.bat` para iniciar com duplo clique.

## Roteiro

A ordem segue a evolução do ASCII City até o Update 4, porque cada etapa depende da anterior. Depois vêm as camadas próprias deste jogo.

1. ✅ **Motor:** Git, Vite + TypeScript, grade de ~180×80 caracteres, raycaster com perspectiva correta, câmera suave (o mouse move um alvo que a câmera segue), sem tremor, desenho final via WebGL com atlas de glifos. Simulação separada da renderização desde o início.
2. **Cidade grande:** mundo enorme com uma janela deslizante em volta do jogador, prédios com identidade fixa pela posição, horizonte distante barato, prédios altos visíveis atrás de outros.
3. **Estrutura da cidade:** setores, distritos e quarteirões com nomes; tipos de distrito que mudam a geração; parques variados.
4. **Visual sólido:** fundo colorido atrás dos glifos (alternável), objetos pseudo-volumétricos (árvores, bancos, postes, cabines).
5. **Clima e céu:** chuva (fraca e forte), neve e outros efeitos atmosféricos, com partículas que caem e **batem no chão** (respingos na chuva, marcas ou acúmulo na neve). Lua com **fases** visíveis no céu. O horizonte atual agradou ao usuário e deve ser mantido.
6. **Trânsito:** avenidas, coletoras e calçadões; semáforos; filas; tipos de veículo; ciclistas; pedestres. Sem carros voadores, porque não combinam com 2008. Criar aqui a fila de eventos da simulação (batidas, engarrafamentos).
7. **Interiores:** entrar nos prédios, janelas que mostram a cidade real, andares altos com vista de cima, vitrines.
8. **Navegação:** painel diegético com terminal progressivo, mapas em 4 níveis, marcos, passeio automático com A\*, modo cidade vazia.
9. **Rede de telefones e celular:** orelhões; o celular como objeto na mão, com hardware próprio; antenas e sinal; loja de apps; os primeiros apps (discador, SMS, câmera); a abertura do jogo. Veja "Design: celular e apps".
10. **Transporte:** táxi (pedido por telefone ou sinal, destino dado ao motorista), monotrilho com estações e trens. Um táxi aéreo futurista não combina com 2008; a alternativa seria um helicóptero de passeio, ainda a confirmar.
11. **Cidadãos e rotinas:** casa, trabalho, relações e horários, com nível de detalhe da simulação.
12. **Rede social da cidade:** posts de cidadãos a partir dos eventos da simulação e das rotinas, com fotos renderizadas do ponto de vista deles, acessível pelo celular e pelo notebook (veja "Design: rede social da cidade").
13. **Economia:** empresas, preços, estoques e salários interligados.
14. **Hacking:** computadores virtuais com hardware próprio, redes, cybercafés com Wi-Fi por distância, portas físicas, terminais progressivos, apps de hacker instalados por fora da loja, impacto sistêmico.

**Transversal, em todas as etapas: som.** O retorno sonoro é prioridade do usuário e não pode ficar para o fim. Cada etapa traz os sons do que cria:
- chuva e vento na etapa 5;
- motores, buzinas e passos na 6;
- portas e ambiente interno na 7;
- teclas, bipes e toques na 9.

Isso pede um módulo de áudio simples (Web Audio), criado na primeira etapa que precisar de som.

## Perguntas em aberto

Consolidadas aqui para não se perderem. Pergunte ao usuário quando a etapa correspondente chegar.
- **Etapa 2:** conversão de unidades para metros e tamanho da cidade. Provavelmente menor que a do ASCII City, porque cada cidadão é detalhado.
- **Etapa 5:** escala de tempo (quantos minutos reais dura um dia do jogo) e se o jogador pode dormir ou pular tempo.
- **Etapa 8:** forma do painel lateral diegético. Com a época de 2008, o celular é o candidato natural.
- **Etapa 10:** se haverá helicóptero de passeio no lugar do táxi aéreo.
- **Quando houver textos na tela:** o idioma dos textos do jogo (hoje em inglês).
- **Etapa 4:** a paleta final (hoje, noite com postes de sódio e HUD âmbar/ciano).

## Ideias futuras (não decididas)

- Rede da cidade como dado do jogo: nós (telefones, câmeras, semáforos, prédios) com endereços e níveis de acesso.
- Notebook do hacker como objeto físico no jogo, com teclado, tela de terminal e sons.
- Transmissão ao vivo determinística (como o "ASCII City Live"): a mesma semente e a mesma hora mostram a mesma cena.
- Tamanho da cidade: provavelmente menor que a do ASCII City, porque cada cidadão é detalhado (como no Shadows of Doubt).

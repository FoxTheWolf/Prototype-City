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


- (fila vazia — os itens de 2026-10-04 foram organizados: o esforço do agente `hacking` foi para o arquivo dele; a regra do limite de 5 h em "Como trabalhar"; upgrades diegéticos, a mochila com física, a troca de chip com operadora nova e as placas de rua na etapa 13; o tempo das missões na Trilha de hacking; a lua em "Bugs conhecidos")


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

### Depois do port para a GPU (2026-10-03)

- **O raio por célula abre portas que o raycaster por coluna não abria; usar isso antes de mais conteúdo.** Reflexo de verdade no vidro e no asfalto molhado (um segundo raio pela mesma grade) é a coisa de maior impacto visual que existe agora pelo menor custo de código: a cidade noturna refletida na rua molhada é exatamente o clima noir/Blade Runner do jogo, e a chuva já existe.
- **Emissão separada antes de PBR.** Antes dos materiais, separar o que é luz (letreiros, janelas, postes, holofotes) do que é cor de superfície. Isso conserta as luzes de dia, deixa o neon estourar de noite (bloom barato: borrar só o canal de emissão) e é a base que o PBR vai precisar.
- **Uma tela de calibração de debug** (uma tecla que mostra uma tabela de cores de fachada sob dia, entardecer e noite lado a lado) economizaria muitas rodadas de "está cinza / está saturado" entre nós dois: a paleta passa a ser decidida olhando a tabela, e não andando pela cidade.

### Sobre a reescrita da luz: "3D por baixo, ASCII por cima" (2026-10-03)

- **Concordo com a visão do usuário** (cena 3D fotorrealista por baixo, o ASCII como o último estágio). O projeto já está no meio do caminho (raio 3D por célula, emissão separada, materiais, reflexos); o que falta é **um só caminho de luz**: hoje a noite soma luz em sRGB sobre cores "pintadas para a noite" e o dia tenta desfazer isso para achar o albedo. Dois caminhos são a origem dos cinzas e da saturação errada.
- **A geometria não deve virar voxel** (as caixas, cilindros e peças analíticas são mais nítidas e mais baratas nesta resolução). **Os voxels servem para a luz:** uma grade grossa em volta do jogador guardando a luz é o jeito barato de ter iluminação global.
- **A vantagem do ASCII:** ~70 mil células contra ~2 milhões de pixels de um jogo em 1080p; dá para pagar por célula o que um jogo comum não paga.
- **O cuidado:** ruído vira glifo piscando. A iluminação global tem que ser estável (acumulada devagar na grade), nunca sorteada por célula a cada quadro.

### Ao fechar a fatia vertical (2026-10-04)

- **O laço existe; agora falta ele ter memória.** Os três trabalhos funcionam, mas cada um termina e some: o dinheiro só compra crédito do celular e o calor só cai. Um laço vira jogo quando o que sobra de um trabalho muda o seguinte. **A sugestão mais forte desta vez: três compras que mudam o jeito de fazer os trabalhos**, vendidas em lojas que já existem (penhor, eletrônicos): um **chip pré-pago descartável** (troca o número: a linha que a polícia segue no topo da escada some; o calor do "caso federal" cai), uma **antena direcional** para o notebook (pegar o Wi-Fi de manutenção de mais longe, fora da câmera do cruzamento) e uma **bateria extra** do notebook. Cada uma responde à pergunta "qual escolha ela cria?" e dá destino ao dinheiro.
- **O jogador precisa ver o que deixou para trás.** O calor sobe por rastros, mas hoje ele só sente o resultado (a polícia chegando). Um **SMS do contratante depois do serviço** dizendo o que a cidade sabe ("a câmera da 5th com a 12th te pegou; não use esse número de novo") ensina o sistema de calor pela própria história, sem tutorial, e é barato (texto pela gramática, lendo os rastros que já existem).
- **Achar o alvo deveria ser também físico, não só pelo mapa.** A busca do Maps resolve (F.8), mas o melhor é a rua contar: a placa da concessionária no portão da subestação, a antena da GRIDLINK num poste com um LED piscando, o armário de semáforos com o adesivo de manutenção. Quem aprende a ler a rua acha alvos sem o mapa; é a progressão por conhecimento das sugestões de 2026-10-02.
- **Os trabalhos não podem se esgotar em três.** Conferir (Trilha de hacking) se o contratante oferece outro depois do terceiro; se não, o mais barato é repetir os três tipos com alvos novos e pagamento que sobe com a reputação (quantos trabalhos limpos seguidos).
- **Antes de crescer, mostrar a amigos.** Um teste com alguém que não conhece o jogo vale mais que qualquer opinião minha: mostra onde a pessoa trava no primeiro minuto (o celular? o notebook? achar onde sentar?). Para isso faltam poucas coisas e quase todas técnicas (veja a Sessão G). *(O usuário adiou isso em 2026-10-04: quer mais missões antes.)*

### Opiniões técnicas e visuais (2026-10-04)

- **O maior risco para o teste com amigos é o WebGPU com 16 storage buffers.** O mínimo garantido é 8; num notebook com placa integrada fraca, a tela fica preta sem aviso. Juntar buffers até caber em 8 é trabalho chato mas mecânico (as quatro listas de luzes dinâmicas num buffer só, `subs` com `lampCol`, mais coisas no `fx`); no mínimo, um aviso claro com o limite do adaptador.
- **O salvamento precisa saber de que código veio.** O cache da população já tem um hash do código que a gera (`popCache.ts`); o save deveria guardar o mesmo hash e avisar ("este save é de uma versão anterior; a cidade pode ter mudado") em vez de carregar índices que não batem. É pequeno e evita bugs fantasmas que vão parecer do jogo.
- **Uma regra para as interfaces** (anotada nas decisões): todo efeito de luz das telas (halo, reflexo, bloom) passa no fim do compositor e **tinge** o que é claro em vez de só somar. O relógio foi o terceiro aparelho com o mesmo problema; vale para o que vier (o rádio, o tocador de música).
- **Visual:** o próximo ganho grande barato continua sendo de luz (a tela do celular estourando, a marquise sem emissão, o apagão claro demais, L.11). Eu faria esses retoques junto da Sessão G, porque é o que o amigo vê no primeiro minuto à noite.

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

### Sobre assinar o ChatGPT para código (pergunta do usuário em 2026-10-03; ele decidiu não assinar)

- **Onde ajudaria de verdade:** bugs pequenos e bem cercados (a lista de correções, que hoje vai para o Sonnet), scripts de conferência (validar JSON, contar combinações da gramática), e segunda opinião em planos. Com um briefing curto (o bug, os arquivos, como testar) ele resolve bem coisas desse tamanho.
- **Onde eu não delegaria:** o shader do mundo, a luz e tudo o que é identidade visual (dependem de muito contexto acumulado e de olhar o resultado), e mudanças que cruzam vários sistemas. O custo escondido é o contexto: o projeto tem convenções fortes (simulação sem render, semente, gramática para todo texto, "Lições da etapa N") que ele não conhece; o diff dele precisa de revisão, e uma revisão minha custa menos que um conserto meu, mas não é de graça.
- **O hacking:** a OpenAI também tem filtros para cibersegurança; para um jogo fictício provavelmente passa, mas não dá para garantir, e o Opus 4.8 já resolve sem bloqueio. Não trocaria o que funciona.
- **Regras se ele entrar:** um agente por vez no repositório, sempre a partir de um commit limpo; ele lê um `AGENTS.md` curto que aponta para as seções certas do CLAUDE.md (não o documento inteiro); eu reviso o diff antes do commit.
- **Recomendação:** antes de assinar, testar o grátis com um bug da lista de correções (por exemplo, a ligação atendida pelo mouse) e ver o diff. Se vier limpo, vale a assinatura sobretudo como substituto da fila do Sonnet.

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
- **13.8 ✅ (2026-10-04)** pessoas no formato do Minecraft: proporções e grade de pixels do Minecraft, a skin gerada no shader (`mcSkin`, `Mat.Skin`, `pedLook`) em vez de textura. Falta: a skin de arquivo do jogador (padrão Alex) quando o corpo dele aparecer; os balconistas dentro das lojas (etapa 16).
- **13.9 Achar o caminho sem o Maps** (retorno do usuário em 2026-10-04: "pense em mais assistências que deixariam o jogo quase inteiramente jogável sem o Maps, já que o celular pode ficar sem bateria; pedir direções a NPCs e se guiar pelas placas"). Depois da 13.8. Em ordem de valor:
  - **Pedir direção a quem passa** (uma versão simples antes do diálogo da etapa 14): F perto de um pedestre, escolher o lugar (os mesmos da busca do Maps) e ele responde pela gramática com a rota em quarteirões e ruas ("two blocks north, then left on 5th Ave"), apontando; uns não sabem, uns erram, à noite alguns não param. Vira a base da etapa 14.
  - **Número nos prédios e endereços** ("1240 5th Ave") na porta, usados também pelo Maps, pelas lojas no telefone e pelos sites: quem sabe o endereço acha pela placa da rua.
  - **Placas de distrito** nas entradas ("ENTERING OLD MARLOW") e o nome do distrito nos toldos e pontos de ônibus.
  - **Totens "YOU ARE HERE"** nas esquinas grandes e nos pontos de ônibus: um mapa de papel do bairro, lido com F.
  - **Mapa de papel / guia da cidade** à venda (farmácia, mercearia, loja de celular): item da mochila que abre sem bateria; mostra ruas e marcos, mas não onde você está.
  - **Lista telefônica** nos orelhões (páginas amarelas com endereço).
  - Já ajudam: as placas de rua e de direção (13.7), a bússola do relógio, os marcos altos no horizonte, os letreiros das lojas. Depois: placas de hospital, estacionamento e estação (etapa 18).
  - Conferir se a bateria do celular acaba de verdade e onde se carrega (tomada no café, cybercafé, em casa); se não acabar, combinar com o usuário.
- **Modelos do Blockbench:** as regras ficam em `docs/blockbench.md` (não decidido; só se um modelo gerado ficar ruim, ou para publicar).
- **Depois, na mesma linha:** mais escritórios perto do centro; a renda dos moradores segue o lugar; `homeUnit` (ainda não existe) em `sim/citizens.ts`; o resto do catálogo (cinema, karaokê, fliperama, escritórios…); **shopping** (hoje toda empresa fica no térreo, `B.shop`; lojas em andares de cima só num prédio marcado como shopping; bares e restaurantes sempre no térreo).
- **A diagonal está desligada** (P.1, `DIAGONAL` em `sim/city.ts`) e o Theater District tem uma praça de dois quarteirões. Se um dia voltar, os bugs dela voltam junto.

### Etapa 14: Diálogo com os NPCs (antes "13c")
- **Assunto + tom** (decidido em 2026-10-04): escolhe o assunto (preço, quem trabalha aqui, viu algo ontem?), depois o jeito de perguntar (educado, insistente, mentira); o tom pesa conforme a personalidade de quem ouve. As falas pela gramática e pela vida de cada um (`locale/text/`, `voice.ts`), com relacionamentos.
- Troca o balcão provisório da F.9 e os pedidos de comida pela conversa com o vendedor.
- Falar com as pessoas na rua e ao telefone; base da engenharia social; **a ligação do contratante** (canal decidido nas "Decisões": vem com o diálogo).

### Etapa 15: Web e celular (o resto da antiga etapa 12)
- **Sites das empresas** gerados da simulação (horário, endereço, o que vendem pela tabela da 13.1, quem trabalha lá), no notebook; alguns com versão para celular.
- **Portal de notícias e busca:** as manchetes da fila de eventos; uma busca que acha empresas, pessoas e lugares.
- **O resto da rede social:** respostas, compartilhamentos, assuntos em alta, o site do Streetwire no notebook, o jogador postar.
- **Registros dos cidadãos** (identidade e documentos): **Opus 4.8** (pode acionar o classificador).
- **E-mail** (canal do contratante para contratos longos e do mistério de fundo; veja "Canais do contratante").
- **Mais destinos do dinheiro:** lojas online, serviços, assinaturas, hardware pelo correio.
- **Tocador de música no celular:** músicas inclusas e lidas de uma pasta do computador do jogador (no Electron, uma pasta fixa ao lado do jogo; no navegador, escolhida); tocar, pausar, pular, volume; continua tocando com o celular abaixado. Se for para a grade principal, juntar o discador e os contatos num app só (os contatos numa aba) para abrir a vaga.
- **Maps:** o modo escuro (pedido de novo em 2026-10-04; pode vir antes, junto da lista de retoques); buscar ruas e esquinas ("5th Ave & 12th St").

### Etapa 16: Os NPCs usando a cidade e reagindo ao jogador (antes "13b" e parte da "13c")
- Usam a cidade: compram nas lojas, sentam nos bancos e nas mesas, esperam no ponto, usam os orelhões, entram nos cafés para fugir da chuva, reagem a apagões, batidas e sirenes (param, olham, fotografam), abrem guarda-chuvas, pegam táxi.
- **Pessoas dentro dos prédios** (a simulação ainda não põe ninguém dentro) e as portas de rua abrindo vistas de fora.
- Reagem ao jogador: desviam, olham, estranham alguém mexendo num poste, chamam a polícia.
- **O elevador com NPCs** (pedido do usuário em 2026-10-04): quem está dentro do prédio usa a cabine (`sim/lifts.ts`) e a move; **o jogador sempre tem prioridade**: se a cabine está ocupada quando ele chama, quem está nela vai direto para o andar dele (teleportado) e a cabine desce para o jogador.
- **Refinamento da polícia** (pedido em 2026-10-03): como ela procura, o que a atrai, como se despista. Easter egg: música tocando no celular chama a atenção quando o jogador se esconde.

### Etapa 17: Economia (antes "13")
- Empresas, preços, estoques e salários interligados (a tabela da 13.1 é a base); bolsa de valores com app e site; banco de dados de empresas com endereço físico; os fabricantes da cidade dando a marca dos celulares **e dos chips**; comprar pacote de dados com dinheiro de verdade.
- **Hackear o banco e os sistemas das empresas** é `[HACKING]` (Trilha de hacking).

### Etapa 18: Transporte e carros dos cidadãos (antes "12b" e "12c")
- Táxi (pedido por telefone ou sinal, destino dado ao motorista, que é um cidadão), monotrilho com estações e trens, interiores dos veículos (carros ocos por dentro). Transporte aéreo: talvez um helicóptero de passeio, a confirmar.
- Carros ligados às pessoas: estacionamentos, placa e registro com dono, os carros saem e voltam com as rotinas (se cada pedestre perto do jogador tivesse carro, seriam ~600 carros a mais).
- **Reavaliar o ritmo do tempo** depois disso: medir de novo a discrepância entre os planos e a viagem de verdade e decidir com o usuário se o dia pode ser mais longo.

### Etapa 19: `[HACKING]` Hacking completo (antes "14"; Opus 4.8, avisar o usuário)
- Computadores virtuais, redes, cybercafés com Wi-Fi por distância, portas físicas, apps de hacker instalados por cabo, impacto sistêmico; o modelo completo de "Design: pacotes de rede simulados"; o celular como modem do notebook (tethering) e talvez um cartão SD compartilhado. Detalhes na "Trilha de hacking".

### Etapa 20: Refinamento e variedade (antes "15")
- **Perguntar no começo:** as opiniões do usuário sobre a etapa 6 (interiores).
- Fachadas mais complexas (cornijas, arcos, pilastras, bases, coroas; referências 28–30 e 32); muito mais letreiros e publicidade (34, 35), outdoors de empresas que existem e mudam com a simulação; topos acesos à noite (36); contornos de neon; distrito estilo Times Square; detalhes de telhado e *greebles*; chaminés industriais com fumaça; cabine telefônica fechada (23); transmissor de rádio como treliça vazada e mais marcos; mais modelos de celular e capinhas, formatos BlackBerry e flip; uma passada nos ícones; carros menos arcaicos (rodas girando, pessoas visíveis, modelos variados); animais (bichos nos apartamentos, cachorros com os donos, gatos de rua, pombos; `Household.pet` já existe).
- **Pessoas no formato do Minecraft:** subiu para a 13.8.
- **Distrito de entretenimento** (decidido em 2026-10-03): o Theater District com a densidade de Kamurocho (letreiros perpendiculares densos com moldura de lâmpadas, letreiros-caixa, lixo, ar-condicionado, fios, cavaletes acesos, máquinas de venda, cones, bicicletas), sem portal; o portal aceso num distrito de periferia com um quarteirão de ruelas só a pé. Base: `docs/tarefas/retorno/05-distrito-entretenimento.json`.
- **Render:** telas em perspectiva no mundo (a tela do aparelho como textura amostrada pelo shader, ao tirar/guardar e de longe); o notebook com teclas e botão de ligar como peças do modelo (investigar o custo); letreiros de lâmpadas como esferas de perto e uma fonte de pontos 3×5 no meio do caminho (recalibrar as trocas pelo tamanho em células); paredes finas sem relevo (decidir com o usuário); o modo de blocos nas paredes e objetos cúbicos; o interior falso nas janelas (*interior mapping*) para os prédios distantes.
- **Materiais** (pedido em 2026-10-03, "o jogo precisa de mais voxels"): tijolo com relevo (mapa normal com paralaxe) e, se der certo, cantaria, calçadas de vários tipos pelo distrito (das limpas às com ladrilhos faltando), paralelepípedos, concreto com juntas, chapas onduladas, portas de enrolar, asfalto rachado da zona de fogo, grades de ventilação. Volume de verdade (sacadas, ar-condicionado, cornijas salientes) é geometria.
- **Geração do mundo animada no carregamento** (pedido em 2026-10-03, como a caixa de status do Minecraft): distritos, ruas, prédios subindo, a rede elétrica, as antenas, a população; mais curta com o cache.
- As anotações de "Refinamento: anotações" e os defeitos visuais das notas técnicas.

### Etapa 21: Sound design (antes "15b")
- Mixagem entre as fontes, reverb por lugar (rua, saguão, apartamento, túnel), variação dos sons repetidos, e a revisão de ouvido com o usuário dos sons sintetizados.

### Etapa 22: Vida do personagem (antes "16")
- Apartamento próprio (dormir, guardar hardware, o mural de pistas), stats, necessidades (a **temperatura**, que vem do clima, molha e esfria, e aparece no termômetro do relógio; o **cansaço**, pago dormindo num lugar seguro), customização pela lore. Efeitos leves, nunca morte.

### Marco: a demo para amigos (adiada pelo usuário em 2026-10-04)
> Quando houver mais missões e etapas prontas: (1) caber em **8 storage buffers** (hoje o shader do mundo usa 16; num PC com 8–10 a tela fica preta: juntar as listas das luzes dinâmicas, `subs` com `lampCol`, o que couber no `fx`) ou ao menos avisar com o limite do adaptador; (2) o **save** com o hash do código e o aviso de versão, guardar o `rng`, vários slots, salvar dormindo; (3) a **primeira mensagem do celular como tutorial** (ensina o celular e a tirar o notebook; o do notebook já existe, `~/start-here.txt`) e um tutorial em texto; (4) os retoques de luz que se veem no primeiro minuto; (5) o **`.exe`** do Electron (electron-builder; **sem a pasta `easter eggs/`**).

### Lista fixa: correções pequenas (Sonnet)
> Correções localizadas, sem sistemas novos (veja "Sessões com o Sonnet" em "Como trabalhar"). Avisar o usuário para trocar para o Sonnet.
- **A 200 linhas sobram linhas embaixo da linha de status** (celular transparente embaixo, faixa preta na BIOS): provavelmente resolvido pela R.38; só conferir.
- **Ligação recebida pelo mouse:** botão esquerdo atende, direito rejeita.
- **Discador: o nome do contato aparece por cima do número digitado:** levar o nome para cima ou para baixo do número (`calls` em `src/phone/apps.ts`).
- **Misclick no celular confirma/cancela:** clicar fora do teclado não deve confirmar nem cancelar (`phone.ts`, o clique do ponteiro livre).
- **Som de apagão só no quarteirão afetado** (`audio/blackout.ts`/`sound.ts`, pela distância ao corte).
- **Pelas janelas não se veem as portas internas** dos cômodos (`peekCell`).
- **As portas de rua não abrem sozinhas** quando o jogador chega perto.
- **Rede social:** espaçar posts com o mesmo motivo (`sim/social.ts`); juntar as peças de `docs/tarefas/retorno/03-posts-streetwire.json` (conferir por script).
- **Postes do andaime e dos pontos de ônibus não são sólidos.**
- **Notebook** (só `src/laptop/draw.ts`/`laptop.ts`, não o shell): limitar o olhar para baixo com ele aberto; os nomes das teclas aparecem através da tampa fechada; luzes de energia e disco, marca e câmera maiores, botão de ligar acima do Delete.
- **Chuva vista nas paredes internas** dos interiores (provavelmente o `fallOver` em `gpu/shader.ts`).
- **Agradecimentos pelo sobrenome** onde o nome inteiro soa estranho (`thanks()` em `locale/names.ts`).

### Lista fixa: retoques de luz (Opus)
- **Cores:** o usuário julga as paletas com a **F4**; falta a saturação da noite (perguntar: forte demais ou fraca?). **Saturação demais** (faixas roxas no vidro, saguão verde-água): pedir capturas com a posição (`POS`).
- **A tela do celular clara demais** (reforçado pelo usuário em 2026-10-04): as telas muito brancas do celular com um fundo um pouco mais escuro, **dependente do tema** (um branco gelo, um cinza claro), o que também tira o bloom excessivo; depois, se ainda precisar, o bloom e a adaptação do olho (`render/eye.ts`, `EYE.k`/`pageDim`, e o bloom em `gpu/shader.ts`).
- **O bloom do relógio parece falso** (retorno do usuário em 2026-10-04): muito bloom na borda e quase nenhum dentro do visor; os dígitos pretos não são cobertos pelo brilho. O halo da luz azul deve passar também por cima dos dígitos e do papel do visor (`watch.ts`, `WATCH_LCD`, `HALO_TINT` em `gpu/compositor.ts`).
- **A lâmpada das marquises verdes** sem a emissão nova: dar `gEm` como os letreiros.
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
- **Etapa 12:** rede social.
- **Etapa 13:** banco, com o saldo real; notícias; tocador de música.

**Apps de hacker não estão na loja.** São instalados por fora, pelo cabo do notebook (um "desbloqueio", como o jailbreak da época). Exemplos: scanner de Wi-Fi, farejador de Bluetooth e captura de pacotes, todos limitados pelo hardware fraco do celular. O notebook continua sendo a ferramenta principal.

**Os celulares dos cidadãos também existem:** modelo, apps instalados, contatos e mensagens são dados hackeáveis. Um app falso publicado na loja pode se espalhar pelos celulares da população, o que é um impacto sistêmico.

## Estado atual

### Resumo para começar uma sessão (atualizado em 2026-10-02)

> **⚠️ LEIA ISTO PRIMEIRO — regra do classificador de segurança.** Qualquer coisa que **se pareça com cibersegurança** (hacking, redes, portas, varredura, senhas, captura de pacotes, invasão, consoles remotos), mesmo no contexto de game dev, **pode ser bloqueada pelo classificador de segurança** no meio da resposta. O **Sonnet 5.5** bloqueou; o **Opus 4.8** (menos safeguards) fez sem bloqueio. Por isso:
> - **Esse trabalho é separado numa trilha própria** (veja "Trilha de hacking" no Roteiro). Ao começar uma sessão dessa trilha, **avise o usuário para trocar para o Opus 4.8 antes de prosseguir.**
> - **Quando a etapa atual NÃO for de hacking, não abra os arquivos de hacking nem leia as entradas de hacking** deste documento. Só de ter esse conteúdo na resposta pode disparar o classificador e travar o trabalho. **Arquivos de hacking:** `src/sim/network.ts`, `src/sim/packets.ts`, a parte de hacking de `src/laptop/shell.ts` (os comandos `mmap`/`bruter`/`tdump`/`tnet`/`mbus`, o builtin `job` que lê o contrato, e a sessão remota `conn`/`remote`, inclusive o comando `log` do host `omc` da operadora), o tutorial `home["start-here.txt"]` de `src/locale/laptop.en.json` (o resto do arquivo é a interface do shell e pode ficar nas sessões normais), os campos `util` e `omc` de `src/sim/wifi.ts` (e `cellLog`/`mastNear` das redes da operadora, em `network.ts`/`telco.ts`), **`src/sim/jobs.ts` e `src/locale/jobs.ts`** (o contratante/jobs; as linhas `[HACKING]` de `src/sim/gear.ts` são só o efeito do chip no calor; as poucas linhas `[HACKING]` em `src/sim/world.ts` e `src/phone/phone.ts` só chamam essa API e podem ficar como estão), **`src/sim/heat.ts`** (o calor e a polícia da fatia vertical; o `recordAct` em `world.ts` e o HUD de calor/prisão em `main.ts` só a chamam), e o manual `docs/manual-hacking.html`/`.pdf`. **As manchetes e os posts da investigação** (`manhunt`/`bust` em `news.ts`, `social.ts` e os `locale/text/*`) são texto de jornal/feed limpo e **não** são `[HACKING]`: podem ficar com as sessões normais, como já ficavam os posts de blackout. **Seções deste doc marcadas `[HACKING]`:** a 10.6 no Histórico, as "Lições da etapa 10", "Design: pacotes de rede simulados", os itens `[HACKING]` do Roteiro e a subseção "Feedback para o Opus 4.8" (na seção de feedback).
> - Se, mesmo fora de uma etapa de hacking, você **precisar** mexer num desses arquivos (um bug de build, por exemplo), avise o usuário e peça para ele confirmar o modelo antes.

- **Onde estamos (2026-10-04):** etapas 1 a 11, a R (render na GPU), a parte da 12 feita no celular (12.1–12.13), a iluminação (sessões A/B/L) e a fatia vertical (F.1–F.9: contratante, três trabalhos, banco, calor e polícia, relógio, salvamento, balcão) estão feitas; várias esperam o teste do usuário (lista no topo do Plano). **Agora: a etapa 13 (Lugares e lojas), com 13.1–13.8 feitas.** Veja **"Plano: etapas 13 a 22"** (renumerado em 2026-10-04: só etapas e subetapas numeradas, sem letras de sessão).
- **Na Trilha de hacking** a etapa 10 está fechada (10.6 e 10.11, Opus 4.8); o que falta dela está no Roteiro. O retorno do usuário sobre a 9 B/C, a 10 (grupo C, 10.7–10.11) e o manual de hacking (`docs/manual-hacking.pdf`) pode chegar a qualquer momento.
- **A nota "perguntar sobre a etapa 6"** é para o começo da etapa 20.
- **Antes de começar qualquer etapa, leia as seções "Lições da etapa N"** nas notas técnicas: são o conhecimento acumulado das sessões anteriores (a 7 tem como testar a simulação sem o jogador; a 8, como testar o celular).
- **Caches (A.3):** o Electron serve sempre na porta 47180 (a mesma origem, então o Chromium guarda os shaders compilados e o `localStorage`; o shader só recompila quando o texto muda, sem flag). A população de cada semente fica em IndexedDB (`src/popCache.ts`), com a chave pelo hash do código que a gera (`?raw` de `city`, `citizens`, `telco`, `power`, `interior`, `device`, `rng`, `world`); `?fresh` força gerar de novo. Se a população passar a depender de outro arquivo, acrescentá-lo à lista. O navegador do app (painel do Claude) não guarda o cache de shaders em disco: lá cada carregamento compila de novo (~6 s).
- **Rodar:** `iniciar.bat` ou `npm run dev` (porta 5173, a do usuário); **`jogar-electron.bat`** (ou `npm run electron`) faz o build e abre em tela cheia no Electron, que é como o usuário testa ao dar retorno (R.37). O Claude usa a configuração `claude-dev` (5180) ou `vite-auto`. `?seed=42` fixa a cidade; `?mute` começa sem som. **Precisa de WebGPU** (Chromium/Electron): o mundo inteiro é desenhado na GPU desde a R.17.
- **Teclas:**
  - jogo: WASD, mouse, Shift corre, Q/E (e as setas laterais) giram; **F** na frente de um orelhão tira o fone (e desliga); **F** mirando um produto numa prateleira o põe na mochila (sem pagar), e no caixa abre o balcão (←/→ dinheiro ou cartão); **B** abre a mochila (arrastar, R gira, E come, botão direito devolve/joga fora); no balcão de quem serve comida, Tab alterna comer aqui / para viagem; **N** tira o notebook onde dá para sentar ou apoiar, **Esc** fecha; **Esc** sem nada nas mãos pausa (menu com salvar, opções e debug); relógio de pulso: **I** abaixa/ergue, e os três botões **J** modo (hora, alarme, cronômetro), **K** start/stop (no modo alarme alterna alarme e sinal de hora; segurado acerta o alarme ou zera o cronômetro), **L** luz; com o notebook aberto, **Insert** ergue/abaixa o celular (usado pelo mouse);
  - celular (como no GTA IV): **seta para cima**, **P** ou o **botão do meio** tiram; **P** ou o botão do meio abaixam (a tela e o estado ficam); na tela inicial, o botão do meio (ou a seta para cima) abre o discador; a seta para baixo na tela inicial limpa as notificações; no discador vazio, as setas escolhem uma chamada recente e a tecla verde liga; a tecla 1 tem os símbolos (`. , ? ! ' - @ _ : / & ( ) " # $ %`); com o notebook aberto, o celular continua clicável (o teclado vai para o notebook); com ele fora, o ponteiro do sistema fica livre e clica nas teclas (segurar o botão direito olha em volta; a roda anda pelo menu e pelas listas); com ele fora, setas = d-pad, Enter ou botão esquerdo = OK, Backspace ou botão direito = Voltar (na tela inicial, guarda), dígitos = teclado, + = \*, − ou . = #, **Space** = tecla verde (abre o discador, liga), **Delete** = tecla vermelha (volta à tela inicial); no menu (grade 4×4), 1–9 e 0 abrem os dez primeiros apps; na câmera, setas para cima e para baixo dão zoom, esquerda liga e desliga o flash; no mapa, 1–4, \*/# ou a roda do mouse = zoom, OK = lista de lugares (ou centralizar);
  - visual: **só no menu de opções desde a F.7** (as teclas B/U/V/G/R/M saíram a pedido do usuário): som, fundo sólido (4 estágios), glifos de bloco, nitidez (SOFT, o padrão, SHARP, SHARPER, SHARPEST), fusão dos glifos distantes (desligada por padrão), resolução do mundo (80, 120 ou 200 linhas; **200 é o padrão**; as câmeras de CCTV têm a resolução própria do modelo, `camRows`; a interface não muda de tamanho, veja 10.9); **F3** esconde e mostra as linhas de debug (desligadas por padrão). As opções ficam em `localStorage` (`tc.opts`), separadas do save (IndexedDB): apagar o save não as perde;
  - interiores: entrar pela porta; subir de elevador (as escadas internas saíram por enquanto): mirar na botoeira e clicar (botão esquerdo); escadas de incêndio dos prédios de tijolo andando pela borda de fora do patamar;
  - debug: **F4** mostra a mesma vista ao meio-dia, no pôr do sol e à noite, lado a lado (para decidir as cores); **T** e Shift+T mudam a hora em ±1 h (o trânsito e os pedestres seguem a hora); **Y** percorre os climas fixos e volta ao automático; **F6** liga e desliga a subestação mais próxima (era o K até a F.7; a linha de debug acima do relógio diz qual, a que distância e para onde); **C** olha pela câmera de segurança mais próxima (C ou Esc sai); no jornal do celular, as setas escolhem a manchete, OK abre a matéria, a tecla esquerda atualiza; **Shift+F6** liga e desliga a cidade toda; **PageUp/PageDown** sobem e descem um andar dentro de um prédio (até existirem escadas e elevadores).
  - A linha de status mostra semente, posição, `DRAW x ms (MAX y)` e os modos. A linha de cima dela mostra data, hora, clima e `POWER x/y`.
- **Desempenho:** no PC do usuário (monitor de 180 Hz; ele nota quedas). Desde a R.17 o mundo é desenhado só na GPU (compute shader, um raio 3D por célula); o `DRAW` da linha de status é o tempo da fila da GPU (`onSubmittedWorkDone`, ~3 ms aqui, contando a espera). O thread principal ainda prepara as listas do quadro (luzes, objetos: ~1 ms). Toda novidade deve ser medida antes e depois.
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
    - `save.ts`: o salvamento do mundo (`snapWorld`/`applyWorld`; chama `saveJobs`/`saveHeat` dos arquivos `[HACKING]`, só as chamadas). O armazenamento fica em `src/saveGame.ts` (IndexedDB) e o menu em `src/menu.ts`.
    - `needs.ts`: a fome e o fôlego da corrida (`stepNeeds`, `FOOD`, `eat`).
    - `bag.ts`: a mochila (itens com tamanho em cm, `placeFor`, a física `settleBag`, o furto em `stepBag`, `pay` em dinheiro ou cartão).
    - `bank.ts`: a conta do jogador (`openAccount`, `post`, o extrato); os bancos são `city.banks` (`bankChains` em `city.ts`: redes de agências, cada uma uma empresa com frente na rua).
    - `jobs.ts` **`[HACKING]`**: os trabalhos que um contratante oferece (`buildJobs`, `jobReply`, `stepJobs`), agnóstico de canal, lido pelo celular. **Não abrir fora da Trilha de hacking.**
    - `wifi.ts`: os roteadores Wi-Fi das lojas e casas (nome, segurança, chave, canal) e os Wi-Fi de manutenção das subestações (`util`, WEP, nome `GRIDLINK-nn`).
    - `computer.ts`: o computador virtual (hardware, disco em árvore `FsNode`, processos, `workS`, bateria/temperatura, `BiosConfig` com relógio, rádio, ordem de boot e a senha de supervisor `supervisorPass`/`bootPass`); `playerLaptop(seed)`.
    - `network.ts`: os hosts por rede Wi-Fi (`lanHosts`: roteador, PCs; nas de manutenção o bridge, a RTU da subestação e o armário de semáforos ATC; na da operadora o `edge-gw` e o `omc-r`), as portas e serviços, a lista de senhas fracas (`WORDS`), `setBreaker`/`setSignals` (os efeitos no mundo), `modbusRegs` (a telemetria da RTU lida da rede elétrica, para o `mbus`), `cellLog` (o registro de antena de uma linha, para o comando `log` do OMC) e `techOnline` (quando um técnico está logado em claro, para o `tdump` capturar).
    - `packets.ts` **`[HACKING]`**: `capture(...)`, o gerador puro e determinístico de pacotes de uma rede Wi-Fi, materializados só quando o `tdump` captura (handshake, ARP/DHCP/DNS/TCP/HTTP, cifra pela segurança, perdas pelo dBm).
    - `citizens.ts`: a população (lares nos apartamentos, empregos nas lojas, escritórios e galpões, famílias, amigos, celulares e linhas fixas), o plano do dia de cada um (`dayPlan`) e `whereIs`, onde cada um está a uma hora (funções puras).
    - `peds.ts`: os cidadãos caminhando perto do jogador, da porta de um prédio à porta do outro.
    - `social.ts`: a rede social (posts de rotina e de testemunhas dos eventos, curtidas).
    - `device.ts`: os modelos de celular dos fabricantes da cidade (`phoneModel`, `playerPhone`).
    - `interior.ts`: plantas dos andares (sob demanda, em cache), portas de rua (a principal e as das lojas), móveis, escadas de incêndio (as internas saíram; o código delas ficou), elevadores (de vidro também) e a colisão de tudo isso.
  - **`src/render/`:**
    - `gpu/shader.ts` (o mundo por célula, WGSL), `gpu/objects.ts` (os objetos), `gpu/world.ts` (`GpuWorld`: sobe a cidade e as listas do quadro; `shot` lê de volta uma vista), `gpu/compositor.ts` (as camadas na tela).
    - `raycaster.ts`: o que a CPU ainda prepara por quadro para a GPU (`gpuPrepare`, `gpuInside`, `gpuObjects`: luzes, céu, objetos, o andar em volta). O desenho por coluna da CPU foi apagado na R.17 (o usuário guardou uma cópia).
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
  - **`src/phone/`** (a interface do celular, como o `main.ts`: lê a simulação, não é lida por ela): `phone.ts` (estado, teclas e a lógica dos apps; os apps de fábrica e a pasta), `shells.ts` (os modelos visuais e as capinhas), `ui.ts` (as peças da interface: caixas arredondadas, degradês, fotos com iniciais, papéis de parede, a barra de título), `wire.ts` (o Streetwire: feed, post com foto e comentários, perfil, curtidas), `calendar.ts` (o calendário: mês, dia, feriados, eventos da cidade, lembretes), `skins.ts` (o visual próprio da previsão do tempo e do jornal), `draw.ts` (o aparelho na mão, a luz nele, o boot, o mapa da cidade e o de interior, a lista de lugares), `apps.ts` (o menu em grade e as telas dos outros apps), `lcd.ts` (a tela: tamanho, cores, texto digitando, barra de status, teclas laterais, letras grandes), `gps.ts` (o receptor com os limites de 2008; o erro muda a cada 6 s e, na rua, cai na calçada), `places.ts` (a busca do Maps, a porta de cada lugar, a ficha, a rota a pé por A* no raster do mapa e a próxima curva), `radio.ts` (o rádio GSM/EDGE: sinal, barras, registro, dados), `call.ts` (a ligação: quem atende, o roteiro de falas, o menu por teclas, a cobrança), `ussd.ts` (o menu `*100#` da operadora e os cartões de recarga), `codes.ts` (os códigos secretos por semente), `camera.ts` (visor e fotos), `store.ts` (os apps da loja: Snake, conversor), `payphone.ts` (o orelhão), `wifi.ts` (o Wi-Fi do aparelho), `textinput.ts` (o editor Abc/T9/123), `mapdata.ts` (o raster da cidade para o mapa). O hardware do aparelho fica em `sim/device.ts`. A luz nas mãos (`VIEW_LIGHT`, `VIEW_GLINT`) vem do fim de `renderWorld`.
  - **`src/laptop/`** (a interface do notebook, como o celular: lê a simulação): `bios.ts` (a SETUP com as abas Main/Advanced/Boot/Security/Exit, o menu de boot, o diálogo de senha de supervisor e a tela de desbloqueio `unlock` no POST), `editor.ts` (o `nano`), `screen.ts` (telas cheias em células), `laptop.ts` (o objeto, tirar/guardar, achar onde sentar, a tampa, a bateria), `draw.ts` (o aparelho, a tela 80×22, o teclado, a BIOS, o painel de status, a máscara da senha `S.mask`), `shell.ts` (o shell tipo Unix: comandos, boot, o ritmo do trabalho real, a placa Wi-Fi `Shell.net`, os comandos de hacking `mmap`/`bruter`/`tdump`/`tnet`/`mbus`, o builtin `job` (o contrato de `world.jobs`) e a sessão remota `conn`/`remote`; o gate de senha no boot/SETUP). O hardware é um `Computer` de `sim/computer.ts`; os hosts e efeitos vêm de `sim/network.ts`.
  - **`src/audio/`:** `sound.ts` (ambiente, chuva, trovão, zumbidos) e `blackout.ts` (o som do apagão, versão A).
  - **`src/locale/`:** `en.json`, `names.ts` (nomes, operadora, fabricantes de celular, cidadãos com o primeiro nome pela geração e pelo gênero, bichos, firmas e os agradecimentos), `news.ts` (o letreiro; `madeHeadline`, as manchetes da gramática), `calls.json` (as falas das ligações, agora peças da gramática), `people.en.json` (firmas, papéis), `social.en.json` e `social.ts` (posts, comentários e perfis do Streetwire), `sms.ts` (os SMS dos cidadãos e das lojas), `jobs.ts` **`[HACKING]`** (os textos do contratante; não abrir fora da Trilha de hacking), `thanks.json` (os nomes dos amigos), e:
    - `gen.ts`: o gerador de textos (gramática com `#símbolo#`, pesos `3|`, condições `[old evening]`, `{slots}`, persona e a memória `Fresh` contra repetição);
    - `voice.ts`: a voz de cada cidadão (as condições de quem fala e do momento, os nomes da vida dele em `lifeCtx`, e o jeito de digitar em `voice`);
    - `text/`: os arquivos da gramática, juntados por `text/index.ts` (`TEXT`): `words`, `words-more`, `memes`, `sms`, `news`, `news2008`, `calendar`, `comments`, `profiles`, `names` (nomes por gênero e geração, sobrenomes, bichos), `promo` (as ofertas das lojas por SMS) e `posts/` (formas, emoções e assuntos).
  - **`src/counter.ts`, `src/shop.ts`, `src/bagUi.ts`** (interface, como o celular): o balcão do caixa, mirar e pegar um produto da prateleira, e a tela da mochila.
  - **`src/render/intro.ts`:** a abertura (terminal no preto, depois a cidade em blocos que se desfazem em glifos).
- **Ordem do quadro:** `main` em `gpu/shader.ts`, por célula: o andar em volta (`interiorCell`), a cidade (`cityCell`: céu, Sarcófago, chão, paredes, telhados, cerca), fumaça, objetos, o vidro visto de dentro, `finish`, e por fim chuva e neve (`fallOver`).
- **Bugs registrados para depois:** veja "Bugs conhecidos".

### Histórico

O registro detalhado de tudo o que foi feito, etapa por etapa (com nomes de funções, medições e o retorno do usuário), fica em **`docs/historico.md`** (movido em 2026-10-02 para o CLAUDE.md pesar menos em cada mensagem). Ler só a parte da etapa em que se está trabalhando. Lá também estão o plano da etapa 10, a preparação da etapa 6 e os designs já implementados (rede elétrica e blackout, física dos carros). **Ao fechar uma subetapa, a entrada nova do Histórico vai para lá** (no topo), e aqui só o Resumo é atualizado. As entradas `[HACKING]` de lá seguem a mesma regra: não ler fora da Trilha de hacking.

## Bugs conhecidos (para uma etapa de correção mais adiante)

Pedido do usuário em 2026-09-30: registrar os bugs sem perder tempo com eles agora; haverá uma etapa de correção de bugs mais para frente.

- Os bugs abertos agora estão no **Plano** (nas etapas e nas listas fixas). Bugs novos entram aqui até a próxima organização.
- **A notícia do apagão sai no instante do corte (retorno do usuário em 2026-10-03):** gerar a manchete (e talvez os posts de "voltou a luz") só depois que a energia volta, não durante o apagão. Para a sessão de correções.
- **`isOpen` não sabe o dia da semana (2026-10-04, visto na 13.3):** os bancos aparecem abertos no fim de semana sem ninguém no caixa (`sim/telco.ts`); dar os dias à tabela de `placeTypes.ts`.
- **A lua parece se esconder de noite (retorno do usuário em 2026-10-04):** conferir a trajetória (`sim/clock.ts`, o nascer e o pôr, e o desenho em `sky.ts`); pode ser só a fase (lua nova ou nascendo de madrugada) ou um erro de sinal na altura.
- **Acidentes demais no trânsito (retorno do usuário em 2026-10-03):** as batidas estão frequentes demais. Olhar na sessão de correções ou junto da fatia vertical (as "Lições da 10.10" têm como diagnosticar uma batida; contar por `w.events.list` com `kind === 'crash'` por minuto de simulação, antes e depois).
- **Fachada que muda bruscamente ao se aproximar:** a faixa de transição foi alongada na R.34 (esperando o teste do usuário). Se ainda aparecer, comparar as cores do visual de longe (`cF` em `wallCell`) com a média do detalhado: o de longe parece mais claro (parede marrom) que o de perto (vidros escuros).
- **Semáforo reverte / "pouco tempo antes de ser pego" (retorno do usuário em 2026-10-03):** no trabalho 2 o usuário sentiu que "não consegui deixar o semáforo por tempo suficiente" e anotou "o semáforo volta ao normal". Investigar (a) se algo zera `S.sig` sozinho (o trabalho fecha no instante em que fica fora do normal, então reverter não falha o trabalho, mas confunde); (b) se a pressão da polícia (F.2, `heat.ts`) chega rápido demais no trabalho 2 — talvez a janela/escala precise de folga. Diagnóstico de batidas nas "Lições da 10.10".

## Refinamento: anotações (para a etapa 20)

Ajustes que o usuário pediu para deixar para a etapa de refinamento e variedade (não são bugs):
- **Opiniões sobre a etapa 6:** o usuário testou e tem opiniões; perguntar no começo da etapa 20.
- **Carros ocos por dentro:** a carroceria é um bloco sólido; pelo vidro se veem o motorista e os passageiros, mas cortados pela caixa do corpo (só o que fica acima de 0,95 m aparece). Fazer o interior oco (laterais, piso, painel) para ver as pessoas inteiras.
- **Dois cones de farol:** hoje cada carro tem um só cone de luz. Devem ser dois, um por farol, com o da direita mais longo (o facho assimétrico de verdade).
- **A praça do X do theater district** e o X em geral: mais decoração (veja a 7.5 e a 7.6).

## Notas técnicas (para as próximas sessões)

### `[HACKING]` Lições da etapa 10 (notebook e hacking), para não repetir
*(pular esta seção fora de uma sessão de hacking; as lições não-hacking do notebook, como testar o shell e a máscara de senha, estão resumidas aqui mas o grosso é de rede)*

- **(F.1) O sistema de trabalho/contratante aciona o classificador** mesmo sendo "sessão normal" no plano (contratar um apagão lê como ataque real). Marcar os arquivos novos (`sim/jobs.ts`, `locale/jobs.ts`) `[HACKING]` no código e no documento, e fazer com o Opus 4.8. **Testar o fluxo sem o navegador:** `createWorld(42)` → `jobReply(w.jobs, from, 'yes', w.time)` → `w.power.subs[sub].on=false` → `stepJobs(w.jobs, w.power, w.bank, w.time)`, conferindo `w.jobs.jobs[0].state` e `w.bank.balance`. O caminho do celular (entrega dos SMS e o gancho no `send()`) precisa do jogo rodando; com o painel oculto o rAF pausa, então avançar à mão num laço (`stepWorld(w,input)` + `phone.update(dt, now)`, importando `stepWorld` de `/src/sim/world.ts`). Se o alvo for cortado no mesmo lote do aceite, o SMS de confirmação é pulado (o trabalho já fica `done`); com o intervalo normal de jogo, ele chega.

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

### Lições da F.6 (salvamento e menu), para não repetir

- **Testar o salvamento sem pointer lock:** no título, `document.getElementById('start'|'continue').click()`; mudar o estado à mão (`world.bank.balance`, `world.power.subs[0].on`, `phone.contacts.push(...)` e esperar 0,6 s para o disco do celular sincronizar); `dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))` abre a pausa; clicar "SAVE & QUIT TO TITLE" recarrega; CONTINUE e conferir. O script do `javascript_tool` é cortado quando a página recarrega: esperar o `#ready` aparecer numa chamada nova.
- **O que um sistema novo precisa para ser salvo:** estado mutável em dados puros (Map/Set/typed arrays passam, funções e classes com métodos não) e entrar em `snapWorld`/`applyWorld` (`sim/save.ts`) ou no `snapshot`/`restore` do aparelho. Coisas feitas "na primeira vez" (os contatos de fábrica no primeiro boot do celular) precisam saber que já aconteceram, senão duplicam a cada carga.
- **Python gerando TypeScript:** `'\u0000'` dentro de um heredoc virou um NUL de verdade no arquivo (o grep passa a dizer "Binary file"); `'\n'` virou quebra de linha dentro de uma string. Para escapes, usar a ferramenta Edit.

### Lições da reescrita da luz (L), para não repetir

- **Medir pela GPU:** `gpuNow().gpuMs` (timestamp-query) é o custo real do passe do mundo (~1 ms aqui); o `DRAW` é a espera da fila.
- **Comparar com a versão antiga:** `git stash`, recarregar, a mesma posição, hora (`world.time = 5184000 + h*3600`, dia 1º de março da semente 42) e clima (a previsão é pura: a mesma hora dá o mesmo clima), captura, `git stash pop`.
- **O olho:** `gpuNow().adapt`, `meterLog` (log da luz média, como seria com o olho em repouso) e `autoExposure = false` para travar. Medir uma cena nova com o olho travado antes de mexer nas faixas.
- **Elevar a 2,2 uma soma que passa do branco explode** (vários faróis num carro): limitar antes da potência.
- **(L.10) Raios perto do chão por uma grade de pegadas:** `footGrid` (`fx[OB + 9]`) e `footStart`/`footStep` servem para qualquer raio novo contra os objetos (sombras de outras luzes, reflexos). O cabeçalho dos objetos no `fx` tem 10 palavras; uma palavra nova empurra as listas por faixa (`OB + 10u + tile` em `objectsOver` e `tab` em `GpuWorld.objects`).
- **(L.10) Conferir um efeito novo pintando de magenta** o que ele produz (e comparar com a constante de alcance em ~0): o modo mais rápido de saber se aparece e onde. Lembrar de desfazer.
- **(L.10) Sombras em cunhas retas** no chão vêm de qualquer coisa medida em poucas direções fixas (a luz do céu tinha 8): mais direções antes de sorteio por célula, que pisca.

### Lições da etapa R (render na GPU), para não repetir

- **Erros do WGSL não aparecem sozinhos:** a tela fica preta e o console mudo (o pipeline inválido só reclama ao ser usado). Conferir com `device.createShaderModule({code}).getCompilationInfo()` no console (cada mensagem tem linha e coluna) ou com `pushErrorScope('validation')` em volta de um `encode`.
- **`a < x … y > b` no WGSL vira template:** um identificador seguido de `<` com um `>` mais adiante na mesma expressão é lido como `tipo<…>`. Pôr cada comparação entre parênteses.
- **Mais de 8 storage buffers num estágio** precisa pedir o limite no `requestDevice` (`maxStorageBuffersPerShaderStage`). **O adaptador daqui permite 16, e o shader do mundo já usa os 16** (desde a R.11): o que vier depois (objetos, carros, plantas) entra no buffer `fx` (binding 16), que tem um cabeçalho de 8 palavras para isso, ou junta buffers que já existem (as quatro listas das luzes dinâmicas, `subs` com `lampCol`).
- **O que é por quadro fica na CPU e sobe como lista** (lâmpadas com falhas e energia, luzes dinâmicas, números do céu: `gpuPrepare`); o que é por célula vai para o shader. A energia (`power`) é uma função pura e foi portada inteira, para cada janela apagar no seu tempo.
- **Ler o que a GPU desenhou:** `await gpuText(x0, y0, x1, y1)` (a comparação com a CPU, `cmpText`, saiu com ela na R.17).
- **Objetos (R.13):** os modelos sobem uma vez por identidade da lista de `Part` (`WeakMap`); uma lista nova a cada quadro (as setas de um carro: `[...parts, ...signalLamps]`) sobe toda vez e só enche a área mais cedo. Juntar os objetos no thread principal custa: sempre cortar pelo cone (`seen`).
- **(13.8) Nada de vetor indexado em tempo de execução no shader** (`array<…>` com índice variável, mesmo `var`): custou ~5 ms em todo o passe de objetos; usar `select`.
- **Palavras reservadas do WGSL** (`std`, `common`, `shared`, `pass`, entre outras; o erro aparece pelo `getCompilationInfo()` de um módulo criado no console) deixam o pipeline inválido sem erro no console; ver com `getCompilationInfo()`.
- **`round()` do WGSL arredonda o meio para o par** (2,5 → 2), o `Math.round` para cima: onde a CPU usa `Math.round`, usar `floor(x + 0.5)`.
- **(R.21) Emissão e luz recebida por célula:** quem faz a célula (`wallCell`, o chão, `objectsOver`) grava em variáveis privadas `gEm`/`gIl` com a profundidade em `gTag`; o `finish` só as usa se `o.depth == gTag` (assim um objeto ou outra coisa por cima não herda a luz da parede). O brilho do bloom vai no **alfa do fundo** (`store`); a leitura de volta (`shot`) devolve o alfa a 255, porque o celular copia o fundo da foto para a tela dele, onde alfa 0 é transparente.
- **(R.24) Um segundo raio pela cidade:** `cityCell`/`wallCell`/`groundCell` leem a origem de `gOX/gOY/gOZ` (privadas, postas no começo do `main`), nunca de `u.px/u.py/u.eye`; para outro raio, mudar a origem, chamar `cityCell` e devolver a origem. Tudo o que um produtor grava (`gEm`, `gIl`, `gTag`, `gGlowK`, `gMat`, `gNrm`, `gWet`, `gRay`) precisa ser guardado e restaurado em volta, e a célula refletida passa pelo `light` **antes** do `light` da principal (o `gGlow` que fica é o da principal). WGSL não tem recursão: o raio refletido não pode ser chamado de dentro de `wallCell`. `sign` é nome de variável em `wallCell` (a cor do letreiro): `sign()` ali não compila.
- **(R.25) Achar uma cor que estoura ou vira cinza:** pintar no fim do `light` as células suspeitas de uma cor pura (por exemplo, parede com luz e saturação < 15% em magenta) e ler as cores do buffer `out` (cópia para um buffer `MAP_READ`, como o `gpuText`). Um `R == G` exato numa cor iluminada é a assinatura de um corte por canal (`sat`) antes da curva de tom. Nenhum `sat` pode ficar entre a soma das luzes e o `nightTone`/`tone`.
- **(R.22c) Teste por célula contra todos os objetos do quadro custa caro** (~50 ms no painel com ~400 objetos): sempre por uma estrutura espacial montada na CPU. Para sombras do sol, a grade no chão com a sombra projetada de cada objeto (`shadowGrid`) é exata: todo ponto de um raio para o sol cai no mesmo ponto do chão quando projetado ao longo do sol. **Para achar ao sol no teste:** o distrito financeiro fica quase todo na sombra dos prédios; procurar um quarteirão baixo (`city.blocks` com `maxH < 14`).
- **O `fx` tem `COPY_SRC` desde a R.18:** dá para lê-lo de volta (`copyBufferToBuffer` para um buffer `MAP_READ`) e comparar com a cópia da CPU (`gpuNow().fxW`/`fxF`).
- **Testes por cor ou por glifo enganam:** o `finish` muda as cores (luz, névoa) e o modo SOFT (o padrão) troca o glifo pela densidade. Para um diagnóstico no shader, apertar V três vezes (SHARPEST) e marcar com um glifo raro (`H`), contando com `gpuText`; nunca concluir "não aparece" por uma cor pura que não sobreviveu.
- **Nunca passar `NaN` à câmera num teste** (um `yaw` vindo de uma busca que falhou): o quadro lança uma exceção e o laço para; recarregar.
- **Medir pelo `onSubmittedWorkDone`** dá ~3 ms mesmo com pouco trabalho (é a espera da fila); serve para ver se cresce, não como o custo real do shader.
- **O primeiro `gpuText` depois de mover o jogador lê um quadro velho da GPU:** chamar uma vez, descartar, e chamar de novo.
- **Mais de uma vista por quadro na GPU** (R.16, `GpuWorld.shot`): cada vista em um `submit` próprio, logo depois dos seus `writeBuffer` (a fila respeita a ordem; no mesmo `submit`, a segunda vista sobrescreveria os uniforms da primeira). Um bind group feito antes de um buffer ser refeito fica velho em silêncio: por isso o contador `gen`. O que é global da CPU (`VIEW_LIGHT`, `VIEW_GLINT`) é guardado e restaurado em volta da vista avulsa.
- **O que a CPU desenha passando pela câmera inclinada** (gotas, pingos) vira, por célula, a distância em linhas a partir da cabeça da gota (`Y = 0,5 + (z da célula − z da gota) · scale / dist`): igual à CPU na câmera dela e serve também para a câmera 3D.

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
- **Sessões com o Sonnet para o que é simples (pedido do usuário em 2026-10-03):** a própria Anthropic indica o Sonnet para tarefas mais simples, e ele gasta menos limite e é mais rápido. Correções pequenas e localizadas (bugs de interface, teclas, um ajuste num arquivo que já existe), sem arquivos novos nem sistemas novos, vão para a **fila do Sonnet** (a "Lista fixa: correções pequenas" do Plano). Ao montar o plano de uma sessão, separar o que é dessa fila e **avisar o usuário quando for prudente trocar para o Sonnet**, do mesmo jeito que se avisa para o Opus 4.8 na Trilha de hacking. O que é de projeto (render, simulação, sistemas novos) fica com o Opus.
- **Olhar o limite de 5 h (regra do usuário em 2026-10-04):** no começo e de tempos em tempos, ler o uso (`get_usage`: limite de 5 h e semanal) e planejar a sessão pelo que sobra. Um agente custa pelo menos ~5% do limite por uso (ele relê o contexto): só chamar quando valer.
- **Opinar sempre (pedido do usuário em 2026-10-03):** dar sugestões técnicas e criativas ao longo do trabalho, não só quando ele pede; as que valem guardar vão datadas para "Opiniões e sugestões do Claude".
- **Separar o hacking (classificador de segurança):** veja a regra no topo de "Estado atual". Trabalho de cibersegurança vai para a "Trilha de hacking" do Roteiro, com o Opus 4.8 e aviso ao usuário no começo. **Fora de uma sessão dessa trilha, não abra os arquivos de hacking nem leia as entradas `[HACKING]`**, para não travar a resposta no classificador.
- **Delegar a Trilha de hacking ao agente `hacking` no mesmo chat (regra do usuário; teste passou em 2026-10-03):** o agente `.claude/agents/` roda no Opus 4.8 e escreveu conteúdo de hacking (as dicas da tela de carregamento em `src/locale/tips.json`) sem bloqueio. Fica a critério do Opus 5.5 o que delegar e quando, pesando se vale gastar os tokens do agente (ele começa sem contexto) em vez de abrir um chat novo com o Opus 4.8: tarefas pequenas e bem cercadas vão para o agente; sessões grandes da trilha continuam num chat próprio. O Opus 5.5 não lê o que o agente escreveu de hacking além do relatório dele.
- **Registrar o hacking a CADA subetapa (regra do usuário em 2026-10-03):** sempre que uma subetapa criar ou tocar conteúdo que **se pareça** com cibersegurança (um arquivo, uma função, uma seção), marcar **no código** (comentário `[HACKING]` no topo do arquivo e nas linhas) **e no documento** (a lista "Arquivos de hacking" e, se for o caso, uma entrada `[HACKING]`), para as sessões normais (Opus 5.5) não abrirem e travarem no classificador. **O próprio contratante/jobs aciona o classificador** (contratar um apagão lê como ataque real), por isso ele é Trilha de hacking mesmo sendo "sessão normal" no plano.
- **Agrupar subetapas e pedir retorno só no fim do grupo (regra do usuário em 2026-10-03; TEM PRIORIDADE sobre as outras regras de ritmo):** conforme o tamanho, o Claude junta várias subetapas num grupo e faz tudo de uma vez, sem perguntar no meio, e só pede o retorno no fim do grupo. Cada subetapa continua com o próprio commit. A leitura da caixa de feedback, a limpeza do documento e o aviso de chat novo acontecem **no começo e no fim do grupo**, não a cada subetapa (quando outra regra diz "a cada subetapa", vale "a cada grupo"). Isso evita perguntas, economiza contexto e diminui os chats novos.
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
